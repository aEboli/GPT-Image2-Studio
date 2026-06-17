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

function makeQuickBlendForm(overrides = {}) {
  const formData = new FormData();
  formData.set("jobId", "quick-blend-local");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "2");
  formData.set("quickBlendAImageName", "a-dress.png");
  formData.set("quickBlendBImageName", "b-shoe.png");
  formData.set("ratio", "4:5");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("clientSessionId", "quick-blend-session");
  formData.append("referenceImages", new File(["a"], "a-dress.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["b"], "b-shoe.png", { type: "image/png" }));

  for (const [key, value] of Object.entries(overrides.fields || {})) {
    formData.set(key, value);
  }
  if (overrides.referenceFiles) {
    formData.delete("referenceImages");
    for (const file of overrides.referenceFiles) {
      formData.append("referenceImages", file);
    }
  }

  return formData;
}

test("local generate accepts quick blend without a user prompt and saves pair metadata", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "quick-blend-"));
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
    body: makeQuickBlendForm(),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.ok(saved, "expected saved SSE event");
  assert.equal(saved.payload.item.generationMode, "quick-blend");
  assert.equal(saved.payload.item.assetKind, "quick-blend");
  assert.equal(saved.payload.item.quickBlendPairIndex, "2");
  assert.equal(saved.payload.item.quickBlendAImageName, "a-dress.png");
  assert.equal(saved.payload.item.quickBlendBImageName, "b-shoe.png");
  assert.match(saved.payload.item.filename, /^\d{4}-a-dress-b-shoe-\d{4}-[a-z0-9]{4}\.png$/);
  assert.doesNotMatch(saved.payload.item.filename, /^\d{6}-/);
  assert.deepEqual(saved.payload.item.referenceImageNames, ["a-dress.png", "b-shoe.png"]);
  assert.match(saved.payload.item.prompt, /A subject group above the B subject group/i);
  assert.match(saved.payload.item.prompt, /assigned layout slot using contain-style proportional scaling/i);
  assert.match(saved.payload.item.prompt, /Do not stretch, squash, warp, bend, elongate, compress, crop, or force any subject/i);
  assert.match(saved.payload.item.relativePath, /quick-blend/);

  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  const metadata = await Promise.all(jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))));
  assert.ok(metadata.some((entry) =>
    entry.assetKind === "quick-blend" &&
    entry.quickBlendPairIndex === "2" &&
    entry.quickBlendAImageName === "a-dress.png" &&
    entry.quickBlendBImageName === "b-shoe.png"
  ));
});

test("local generate accepts quick blend optional C and D groups with layout metadata", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "quick-blend-groups-"));
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
    body: makeQuickBlendForm({
      fields: {
        quickBlendCImageName: "c-compass.png",
        quickBlendDImageName: "d-bottle.png",
        quickBlendLayoutOrder: "horizontal",
        quickBlendPlacementShape: "rectangle",
      },
      referenceFiles: [
        new File(["a"], "a-dress.png", { type: "image/png" }),
        new File(["b"], "b-shoe.png", { type: "image/png" }),
        new File(["c"], "c-compass.png", { type: "image/png" }),
        new File(["d"], "d-bottle.png", { type: "image/png" }),
      ],
    }),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.ok(saved, "expected saved SSE event");
  assert.equal(saved.payload.item.quickBlendCImageName, "c-compass.png");
  assert.equal(saved.payload.item.quickBlendDImageName, "d-bottle.png");
  assert.equal(saved.payload.item.quickBlendLayoutOrder, "horizontal");
  assert.equal(saved.payload.item.quickBlendPlacementShape, "rectangle");
  assert.deepEqual(saved.payload.item.referenceImageNames, [
    "a-dress.png",
    "b-shoe.png",
    "c-compass.png",
    "d-bottle.png",
  ]);
  assert.match(saved.payload.item.prompt, /Reference image 3 is product group C/i);
  assert.match(saved.payload.item.prompt, /Reference image 4 is product group D/i);
  assert.match(saved.payload.item.prompt, /left to right, then continue on the next row/i);
  assert.match(saved.payload.item.prompt, /rectangular sorting layout/i);
  assert.match(saved.payload.item.prompt, /use a 2 by 2 matrix inside the rectangular canvas/i);
  assert.match(saved.payload.item.prompt, /assigned layout slot using contain-style proportional scaling/i);
  assert.doesNotMatch(saved.payload.item.prompt, /placement zones/i);

  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  const metadata = await Promise.all(jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))));
  assert.ok(metadata.some((entry) =>
    entry.assetKind === "quick-blend" &&
    entry.quickBlendCImageName === "c-compass.png" &&
    entry.quickBlendDImageName === "d-bottle.png" &&
    entry.quickBlendLayoutOrder === "horizontal" &&
    entry.quickBlendPlacementShape === "rectangle"
  ));
});

test("local generate rejects quick blend when reference image count is not exactly two", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "quick-blend-count-"));
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
    body: makeQuickBlendForm({
      referenceFiles: [new File(["a"], "a-dress.png", { type: "image/png" })],
    }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /Quick Blend|快速溶图|exactly two|两张/);
});
