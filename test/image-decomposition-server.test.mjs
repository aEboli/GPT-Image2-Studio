import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { File } from "node:buffer";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
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

async function findJsonFiles(root) {
  const results = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        results.push(fullPath);
      }
    }
  }
  await walk(root);
  return results;
}

function makeImageDecompositionForm(overrides = {}) {
  const formData = new FormData();
  formData.set("jobId", "image-decomposition-local");
  formData.set("mode", "image-decomposition");
  formData.set("targetLanguage", "en");
  formData.set("featureCardsEnabled", "0");
  formData.set("ratio", "1:1");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("clientSessionId", "image-decomposition-session");
  formData.append("referenceImages", new File(["source-image"], "source.png", { type: "image/png" }));

  for (const [key, value] of Object.entries(overrides.fields || {})) {
    formData.set(key, value);
  }
  for (const file of overrides.extraFiles || []) {
    formData.append("referenceImages", file);
  }

  return formData;
}

test("local generate accepts image decomposition without a user prompt and saves metadata", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-decomposition-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
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
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeImageDecompositionForm(),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.ok(saved, "expected saved SSE event");
  assert.equal(saved.payload.item.generationMode, "image-decomposition");
  assert.equal(saved.payload.item.assetKind, "image-decomposition");
  assert.equal(saved.payload.item.targetLanguage, "English");
  assert.equal(saved.payload.item.sourceImageName, "source.png");
  assert.equal(saved.payload.item.featureCardsEnabled, false);
  assert.match(saved.payload.item.prompt, /English/);
  assert.match(saved.payload.item.prompt, /visible/);

  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  const metadata = await Promise.all(jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))));
  assert.ok(metadata.some((entry) =>
    entry.assetKind === "image-decomposition" &&
    entry.targetLanguage === "English" &&
    entry.sourceImageName === "source.png" &&
    entry.featureCardsEnabled === false &&
    entry.referenceImageNames?.includes("source.png")
  ));

  const gallery = await fetch(`${baseUrl}/api/gallery`).then((entry) => entry.json());
  const galleryItem = gallery.find((entry) => entry.assetKind === "image-decomposition");
  assert.ok(galleryItem, "expected gallery item");
  assert.equal(galleryItem.generationMode, "image-decomposition");
  assert.equal(galleryItem.sourceImageName, "source.png");
  assert.equal(galleryItem.featureCardsEnabled, false);
});

test("local generate rejects image decomposition when reference image count is not exactly one", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-decomposition-count-"));
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

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeImageDecompositionForm({
      extraFiles: [new File(["second"], "second.png", { type: "image/png" })],
    }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /一张|exactly one/i);
});
