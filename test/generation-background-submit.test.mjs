import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getFreePort() {
  const server = createTcpServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return address.port;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode) {
    return;
  }

  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    delay(1500).then(() => {
      if (server.exitCode === null && !server.signalCode) {
        server.kill("SIGKILL");
      }
    }),
  ]);
}

function collectDiagnostics(server) {
  const diagnostics = { stdout: "", stderr: "" };
  server.stdout?.setEncoding("utf8");
  server.stderr?.setEncoding("utf8");
  server.stdout?.on("data", (chunk) => {
    diagnostics.stdout += chunk;
  });
  server.stderr?.on("data", (chunk) => {
    diagnostics.stderr += chunk;
  });
  return diagnostics;
}

async function waitForServer(baseUrl, server, diagnostics) {
  const deadline = Date.now() + 7000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`server exited early (${server.exitCode})\n${diagnostics.stderr}\n${diagnostics.stdout}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/config`);
      if (response.status < 500) {
        await response.arrayBuffer();
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(`server did not start: ${lastError?.message || "timeout"}\n${diagnostics.stderr}`);
}

function parseSseEvents(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((chunk) => {
      const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1] || "";
      const data = [...chunk.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]).join("\n");
      return eventName && data ? { eventName, payload: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

function makePromptForm(jobId, { imageRoute = "a" } = {}) {
  const formData = new FormData();
  formData.set("jobId", jobId);
  formData.set("prompt", `background submit regression ${jobId}`);
  formData.set("ratio", "1:1");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("clientSessionId", "background-submit-session");
  formData.set("background", "1");
  formData.set("imageRoute", imageRoute);
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("directBaseUrl", "http://127.0.0.1:9/v1");
  formData.set("directApiKey", "test-key");
  formData.set("directImageModel", "gpt-image-2");
  formData.set("directResponsesModel", "gpt-5.5");
  return formData;
}

async function fetchTasks(baseUrl) {
  const response = await fetch(`${baseUrl}/api/generation/tasks`, {
    headers: {
      "x-client-session-id": "background-submit-session",
    },
  });
  assert.equal(response.ok, true);
  return response.json();
}

async function waitForCompletedTasks(baseUrl, expectedIds) {
  const expected = new Set(expectedIds);
  const deadline = Date.now() + 7000;

  while (Date.now() < deadline) {
    const tasks = await fetchTasks(baseUrl);
    const completed = tasks.filter((task) => expected.has(task.id) && task.status === "completed");
    if (completed.length === expected.size) {
      return completed;
    }
    await delay(100);
  }

  assert.fail(`timed out waiting for completed tasks: ${expectedIds.join(", ")}`);
}

test("local background generate releases request connections and completes through task polling", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "generation-background-submit-"));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "1",
      IMAGE_STUDIO_ENABLE_TEST_MOCKS: "1",
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const jobIds = Array.from({ length: 7 }, (_, index) => `background-submit-${index + 1}`);
  const responses = await Promise.all(
    jobIds.map(async (jobId, index) => {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        body: makePromptForm(jobId, { imageRoute: index === 6 ? "b" : "a" }),
      });
      const text = await response.text();
      return { response, text, events: parseSseEvents(text) };
    }),
  );

  for (const { response, text, events } of responses) {
    assert.equal(response.status, 200);
    assert.equal(events.some((event) => event.eventName === "queued"), true, text);
    assert.equal(events.some((event) => event.eventName === "saved"), false, text);
    assert.equal(events.some((event) => event.eventName === "complete"), false, text);
  }

  const completed = await waitForCompletedTasks(baseUrl, jobIds);
  assert.equal(completed.length, 7);
  assert.equal(completed.find((task) => task.id === "background-submit-7")?.imageRoute, "b");
  assert.equal(completed.every((task) => task.item?.filename), true);
  assert.equal(completed.every((task) => /^\d{4}-\d{2}-\d{2}T/.test(task.generationStartedAt)), true);
  assert.equal(completed.every((task) => task.generationStartedAt === task.item?.generationStartedAt), true);
});
