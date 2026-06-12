import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { File } from "node:buffer";
import { createServer as createHttpServer } from "node:http";
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

async function stopHttpServer(server) {
  if (!server) {
    return;
  }
  await new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
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

async function createUpstreamEditServer(options = {}) {
  const requests = [];
  const upstreamResponses = Array.isArray(options.responses) && options.responses.length > 0
    ? options.responses
    : [{ base64: "ZWRpdC1zZXJ2ZXItZmluYWw=" }];
  const server = createHttpServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });

    if (request.method !== "POST" || request.url !== "/v1/images/edits") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: `unexpected ${request.method} ${request.url}` } }));
      return;
    }

    const configuredResponse = upstreamResponses[Math.min(requests.length - 1, upstreamResponses.length - 1)];
    const status = Number(configuredResponse.status || 200);
    const payload = configuredResponse.payload || {
      data: [{ b64_json: configuredResponse.base64 || "ZWRpdC1zZXJ2ZXItZmluYWw=" }],
    };
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });

  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
  };
}

async function startLocalStudioServer(t, { upstream = null, tempPrefix = "image-edit-server-" } = {}) {
  const tempRoot = await mkdtemp(join(tmpdir(), tempPrefix));
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
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    if (upstream) {
      await stopHttpServer(upstream.server);
    }
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  return {
    baseUrl,
    outputDir,
    localDataRootDir,
    tempRoot,
  };
}

function makeLocalMaskRegions(overrides = []) {
  const defaults = [
    {
      id: "region-1",
      index: 1,
      color: "#f5506e",
      instruction: "Replace the cup with glossy red ceramic.",
      hasMask: true,
    },
    {
      id: "region-2",
      index: 2,
      color: "#14b8a6",
      instruction: "Remove the bright reflection from the table.",
      hasMask: true,
    },
  ];

  return defaults.map((region, index) => ({
    ...region,
    ...(overrides[index] || {}),
  }));
}

function makeMaskFile(contents = "mask-bytes", name = "local-mask.png", type = "image/png") {
  return new File([contents], name, { type });
}

function makeImageEditForm(overrides = {}) {
  const formData = new FormData();
  formData.set("jobId", "image-edit-local");
  formData.set("mode", "image-edit");
  formData.set("prompt", "把背景改成干净的白色摄影棚，保留主体材质和比例。");
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", overrides.baseUrl || "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("clientSessionId", "image-edit-session");
  formData.append("referenceImages", new File(["source-image"], "source-product.png", { type: "image/png" }));

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

function makeDirectReferenceGenerationForm({ baseUrl }) {
  const formData = new FormData();
  formData.set("jobId", "direct-reference-local");
  formData.set("clientSessionId", "direct-reference-session");
  formData.set("prompt", "Create a phone snapshot from this product reference.");
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("reasoningEffort", "high");
  formData.set("imageRoute", "b");
  formData.set("baseUrl", baseUrl);
  formData.set("apiKey", "route-a-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("directBaseUrl", baseUrl);
  formData.set("directApiKey", "direct-key");
  formData.set("directEndpointPath", "images/generations");
  formData.set("directImageModel", "gpt-image-2");
  formData.set("directResponsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["source-image"], "source-product.png", { type: "image/png" }));
  return formData;
}

function makeLocalMaskForm(options = {}) {
  const executionStrategy = options.executionStrategy || "merge";
  const regions = options.regions || makeLocalMaskRegions();
  const fields = {
    prompt: "Frontend local-mask prompt should be rebuilt by the backend.",
    editMode: "local-mask",
    executionStrategy,
    regionInstructions: options.regionInstructions ?? JSON.stringify(regions),
    ...(options.fields || {}),
  };
  const formData = makeImageEditForm({
    baseUrl: options.baseUrl,
    fields,
    referenceFiles: options.referenceFiles,
  });

  if (executionStrategy === "sequential") {
    for (const mask of options.masks || []) {
      formData.append("masks[]", mask);
    }
    return formData;
  }

  const mask = Object.hasOwn(options, "mask") ? options.mask : makeMaskFile("merged-mask", "merged-mask.png");
  if (mask) {
    formData.set("mask", mask);
  }

  return formData;
}

async function readSavedMetadataEntries(outputDir) {
  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  return Promise.all(jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))));
}

test("local generate sends image edit requests to the edits endpoint and saves metadata", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-edit-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const upstream = await createUpstreamEditServer();
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
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await stopHttpServer(upstream.server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeImageEditForm({ baseUrl: upstream.baseUrl }),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.equal(upstream.requests.length, 1);
  assert.equal(upstream.requests[0].method, "POST");
  assert.equal(upstream.requests[0].url, "/v1/images/edits");
  assert.match(upstream.requests[0].headers.authorization, /^Bearer test-key$/);
  assert.match(upstream.requests[0].headers["content-type"], /^multipart\/form-data;/);
  assert.match(upstream.requests[0].body, /name="model"/);
  assert.match(upstream.requests[0].body, /gpt-image-2/);
  assert.match(upstream.requests[0].body, /name="prompt"/);
  assert.match(upstream.requests[0].body, /source-product\.png/);

  assert.ok(saved, "expected saved SSE event");
  assert.equal(saved.payload.item.generationMode, "image-edit");
  assert.equal(saved.payload.item.assetKind, "image-edit");
  assert.equal(saved.payload.item.sourceImageName, "source-product.png");
  assert.equal(saved.payload.item.editInstruction, "把背景改成干净的白色摄影棚，保留主体材质和比例。");
  assert.match(saved.payload.item.relativePath, /image-edit/);

  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  const metadata = await Promise.all(jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))));
  assert.ok(metadata.some((entry) =>
    entry.assetKind === "image-edit" &&
    entry.generationMode === "image-edit" &&
    entry.sourceImageName === "source-product.png" &&
    entry.editInstruction === "把背景改成干净的白色摄影棚，保留主体材质和比例。"
  ));
});

test("local direct generation with one reference uses image edits and the image field", async (t) => {
  const upstream = await createUpstreamEditServer();
  const { baseUrl, outputDir } = await startLocalStudioServer(t, {
    upstream,
    tempPrefix: "direct-reference-edit-",
  });

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeDirectReferenceGenerationForm({ baseUrl: upstream.baseUrl }),
  });
  const text = await response.text();
  const events = parseSseEvents(text);

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.equal(upstream.requests.length, 1);
  assert.equal(upstream.requests[0].url, "/v1/images/edits");
  assert.match(upstream.requests[0].body, /name="image"; filename="source-product\.png"/);
  assert.doesNotMatch(upstream.requests[0].body, /name="image\[\]"/);

  const saved = events.find((event) => event.eventName === "saved");
  assert.equal(saved?.payload?.item?.endpointPath, "images/edits");

  const metadata = await readSavedMetadataEntries(outputDir);
  assert.ok(metadata.some((entry) =>
    entry.imageRoute === "b" &&
    entry.endpointPath === "images/edits" &&
    entry.referenceImageName === "source-product.png"
  ), JSON.stringify(metadata, null, 2));
});

test("local generate rejects invalid local-mask requests before upstream edits", async (t) => {
  const cases = [
    {
      name: "missing merge mask",
      form: (upstreamBaseUrl) => makeLocalMaskForm({ baseUrl: upstreamBaseUrl, mask: null }),
      message: /mask/i,
    },
    {
      name: "non-image merge mask",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        mask: makeMaskFile("plain text", "mask.txt", "text/plain"),
      }),
      message: /mask.*image|image.*mask/i,
    },
    {
      name: "oversized merge mask",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        mask: makeMaskFile(new Uint8Array((50 * 1024 * 1024) + 1), "oversized-mask.png"),
      }),
      message: /50 MB|smaller|size/i,
    },
    {
      name: "invalid execution strategy",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        executionStrategy: "invalid-strategy",
      }),
      message: /executionStrategy|strategy/i,
    },
    {
      name: "sequential mask count mismatch",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        executionStrategy: "sequential",
        masks: [makeMaskFile("region-one-mask", "region-1-mask.png")],
      }),
      message: /mask/i,
    },
    {
      name: "malformed region instructions",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        regionInstructions: "not-json",
      }),
      message: /regionInstructions/i,
    },
    {
      name: "empty region instructions",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        regions: [],
      }),
      message: /region/i,
    },
    {
      name: "painted region missing instruction",
      form: (upstreamBaseUrl) => makeLocalMaskForm({
        baseUrl: upstreamBaseUrl,
        regions: makeLocalMaskRegions([{ instruction: "   " }]).slice(0, 1),
      }),
      message: /Region 1|instruction/i,
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async (subtest) => {
      const upstream = await createUpstreamEditServer();
      const { baseUrl } = await startLocalStudioServer(subtest, {
        upstream,
        tempPrefix: "image-edit-local-mask-validation-",
      });

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        body: testCase.form(upstream.baseUrl),
      });
      const events = parseSseEvents(await response.text());
      const error = events.find((event) => event.eventName === "error");

      assert.equal(response.status, 200);
      assert.ok(error, "expected error SSE event");
      assert.match(error.payload.message, testCase.message);
      assert.equal(upstream.requests.length, 0);
    });
  }
});

test("local generate rejects image edit without a source image", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-edit-missing-"));
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
    body: makeImageEditForm({ referenceFiles: [] }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /图片编辑模式需要且只支持上传一张源图/);
});

test("local generate rejects image edit with multiple source images", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-edit-multiple-"));
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
    body: makeImageEditForm({
      referenceFiles: [
        new File(["source"], "source-product.png", { type: "image/png" }),
        new File(["second"], "second-source.png", { type: "image/png" }),
      ],
    }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /图片编辑模式需要且只支持上传一张源图/);
});

test("local generate rejects image edit without an edit instruction", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-edit-empty-prompt-"));
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
    body: makeImageEditForm({ fields: { prompt: "" } }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /编辑指令不能为空/);
});

test("local generate executes merge local-mask image edit and saves metadata", async (t) => {
  const regions = makeLocalMaskRegions();
  const upstream = await createUpstreamEditServer();
  const { baseUrl, outputDir } = await startLocalStudioServer(t, {
    upstream,
    tempPrefix: "image-edit-local-mask-merge-",
  });

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeLocalMaskForm({ baseUrl: upstream.baseUrl, regions }),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.equal(upstream.requests.length, 1);

  const body = upstream.requests[0].body;
  assert.match(body, /name="model"/);
  assert.match(body, /gpt-image-2/);
  assert.match(body, /name="image"; filename="source-product\.png"/);
  assert.match(body, /name="mask"; filename="merged-mask\.png"/);
  assert.match(body, /name="size"[\s\S]*1024x1024/);
  assert.match(body, /name="quality"[\s\S]*high/);
  assert.match(body, /name="output_format"[\s\S]*png/);
  assert.match(body, /Edit only the transparent masked areas/i);
  assert.match(body, /Keep all opaque unmasked areas unchanged/i);
  assert.match(body, /Region 1: Replace the cup with glossy red ceramic\./);
  assert.match(body, /Region 2: Remove the bright reflection from the table\./);

  assert.ok(saved, "expected saved SSE event");
  assert.equal(saved.payload.item.generationMode, "image-edit");
  assert.equal(saved.payload.item.assetKind, "image-edit");
  assert.equal(saved.payload.item.editMode, "local-mask");
  assert.equal(saved.payload.item.executionStrategy, "merge");
  assert.equal(saved.payload.item.regionCount, 2);
  assert.deepEqual(saved.payload.item.regionInstructions, regions);
  assert.equal(saved.payload.item.sourceImageName, "source-product.png");
  assert.equal(
    saved.payload.item.editInstruction,
    "Region 1: Replace the cup with glossy red ceramic.\nRegion 2: Remove the bright reflection from the table.",
  );

  const metadata = await readSavedMetadataEntries(outputDir);
  const localMaskEntry = metadata.find((entry) => entry.editMode === "local-mask");
  assert.ok(localMaskEntry, "expected saved local-mask metadata JSON");
  assert.equal(localMaskEntry.generationMode, "image-edit");
  assert.equal(localMaskEntry.assetKind, "image-edit");
  assert.equal(localMaskEntry.executionStrategy, "merge");
  assert.equal(localMaskEntry.regionCount, 2);
  assert.deepEqual(localMaskEntry.regionInstructions, regions);
  assert.equal(localMaskEntry.sourceImageName, "source-product.png");
  assert.equal(
    localMaskEntry.editInstruction,
    "Region 1: Replace the cup with glossy red ceramic.\nRegion 2: Remove the bright reflection from the table.",
  );
});

test("local generate executes sequential local-mask image edit in region order", async (t) => {
  const regions = makeLocalMaskRegions();
  const firstOutput = Buffer.from("region-one-output").toString("base64");
  const finalOutput = Buffer.from("region-two-final").toString("base64");
  const upstream = await createUpstreamEditServer({
    responses: [
      { base64: firstOutput },
      { base64: finalOutput },
    ],
  });
  const { baseUrl, outputDir } = await startLocalStudioServer(t, {
    upstream,
    tempPrefix: "image-edit-local-mask-sequential-",
  });

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeLocalMaskForm({
      baseUrl: upstream.baseUrl,
      executionStrategy: "sequential",
      regions,
      masks: [
        makeMaskFile("region-one-mask", "region-1-mask.png"),
        makeMaskFile("region-two-mask", "region-2-mask.png"),
      ],
    }),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvents = events.filter((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.equal(upstream.requests.length, 2);

  assert.match(upstream.requests[0].body, /name="image"; filename="source-product\.png"/);
  assert.match(upstream.requests[0].body, /name="mask"; filename="region-1-mask\.png"/);
  assert.match(upstream.requests[0].body, /Region 1 of 2/);
  assert.match(upstream.requests[0].body, /Replace the cup with glossy red ceramic\./);

  assert.match(upstream.requests[1].body, /region-one-output/);
  assert.match(upstream.requests[1].body, /name="mask"; filename="region-2-mask\.png"/);
  assert.match(upstream.requests[1].body, /Region 2 of 2/);
  assert.match(upstream.requests[1].body, /Remove the bright reflection from the table\./);

  assert.equal(savedEvents.length, 1);
  assert.equal(savedEvents[0].payload.item.editMode, "local-mask");
  assert.equal(savedEvents[0].payload.item.executionStrategy, "sequential");
  assert.equal(savedEvents[0].payload.item.regionCount, 2);
  assert.deepEqual(savedEvents[0].payload.item.regionInstructions, regions);

  const metadata = await readSavedMetadataEntries(outputDir);
  const localMaskEntries = metadata.filter((entry) => entry.editMode === "local-mask");
  assert.equal(localMaskEntries.length, 1);
  assert.equal(localMaskEntries[0].executionStrategy, "sequential");
  assert.equal(localMaskEntries[0].regionCount, 2);
  assert.deepEqual(localMaskEntries[0].regionInstructions, regions);
});

test("local generate reuses sequential JPG outputs with matching filename and mime type", async (t) => {
  const regions = makeLocalMaskRegions();
  const firstOutput = Buffer.from("region-one-jpg-output").toString("base64");
  const finalOutput = Buffer.from("region-two-jpg-final").toString("base64");
  const upstream = await createUpstreamEditServer({
    responses: [
      { base64: firstOutput },
      { base64: finalOutput },
    ],
  });
  const { baseUrl } = await startLocalStudioServer(t, {
    upstream,
    tempPrefix: "image-edit-local-mask-sequential-jpg-",
  });

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeLocalMaskForm({
      baseUrl: upstream.baseUrl,
      executionStrategy: "sequential",
      fields: { format: "jpg" },
      regions,
      masks: [
        makeMaskFile("region-one-mask", "region-1-mask.png"),
        makeMaskFile("region-two-mask", "region-2-mask.png"),
      ],
    }),
  });
  const events = parseSseEvents(await response.text());

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), []);
  assert.equal(upstream.requests.length, 2);
  assert.match(upstream.requests[0].body, /name="output_format"[\s\S]*jpeg/);
  assert.match(upstream.requests[1].body, /name="image"; filename="local-mask-region-1-output\.jpg"/);
  assert.match(upstream.requests[1].body, /Content-Type: image\/jpeg/);
  assert.doesNotMatch(upstream.requests[1].body, /local-mask-region-1-output\.png/);
});

test("local generate reports sequential local-mask intermediate failure without saving", async (t) => {
  const regions = makeLocalMaskRegions();
  const upstream = await createUpstreamEditServer({
    responses: [
      { base64: Buffer.from("region-one-output").toString("base64") },
      {
        status: 500,
        payload: { error: { message: "region two failed upstream" } },
      },
    ],
  });
  const { baseUrl, outputDir } = await startLocalStudioServer(t, {
    upstream,
    tempPrefix: "image-edit-local-mask-sequential-fail-",
  });

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeLocalMaskForm({
      baseUrl: upstream.baseUrl,
      executionStrategy: "sequential",
      regions,
      masks: [
        makeMaskFile("region-one-mask", "region-1-mask.png"),
        makeMaskFile("region-two-mask", "region-2-mask.png"),
      ],
    }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.equal(upstream.requests.length, 2);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /Region 2/i);
  assert.equal(events.some((event) => event.eventName === "saved"), false);
  assert.deepEqual(await findJsonFiles(join(outputDir, "json")), []);
});
