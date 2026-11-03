import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("Vercel deployment ignores local build and smoke-test artifacts", async () => {
  const ignoreFile = await readFile(new URL("../.vercelignore", import.meta.url), "utf8");

  for (const pattern of ["artifacts/", "dist/", "desktop/", "output/", ".local/", ".vercel/"]) {
    assert.match(ignoreFile, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }

  assert.doesNotMatch(ignoreFile, /^!\.env\.example$/m);
});

test("Vercel deployment config gives the Node backend the maximum Hobby duration", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.functions?.["server.mjs"]?.maxDuration, 300);
});

test("Vercel deployment installs production dependencies without desktop tooling", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.installCommand, "npm ci --omit=dev");
});

test("Vercel deployment config includes PPT export runtime dependencies", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.functions?.["server.mjs"]?.includeFiles, "node_modules/pptxgenjs/**");
});

test("server import completes without binding a local listener in Vercel runtime", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-vercel-capture-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const source = `
import { createServer, request as httpRequest } from "node:http";
const runtime = await import("./server.mjs?vercel-capture-probe");
if (!runtime.studioServer || typeof runtime.default !== "function") {
  throw new Error("Vercel default request handler was not exported");
}
if (runtime.studioServer.listening) {
  throw new Error("Vercel runtime must not bind a local listener during import");
}
const handlerServer = createServer(runtime.default);
await new Promise((resolve, reject) => {
  handlerServer.once("error", reject);
  handlerServer.listen(0, "127.0.0.1", resolve);
});
const statusCode = await new Promise((resolve, reject) => {
  const request = httpRequest({
    hostname: "127.0.0.1",
    port: handlerServer.address().port,
    path: "/",
    headers: { Host: "gpt-image2-studio.vercel.app" },
  }, (response) => {
    response.resume();
    response.on("end", () => resolve(response.statusCode));
  });
  request.once("error", reject);
  request.end();
});
handlerServer.closeAllConnections?.();
await new Promise((resolve, reject) => handlerServer.close((error) => error ? reject(error) : resolve()));
if (statusCode !== 200) {
  throw new Error("captured request handler returned " + statusCode);
}
console.log("CAPTURE_IMPORT_RESOLVED");
`;
  const result = await execFileAsync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: rootDir,
    env: {
      ...process.env,
      VERCEL: "1",
      VERCEL_REGION: "iad1",
      HOST: "0.0.0.0",
      PORT: "0",
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    },
    timeout: 5000,
    windowsHide: true,
  });

  assert.match(result.stdout, /CAPTURE_IMPORT_RESOLVED/);
});

test("Vercel returns generated image bytes on the original request despite background submission", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-vercel-generation-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const source = `
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { consumeSse } from "./lib/generation-client.mjs";
import { assertGenerationStreamDeliveryOrder } from "./lib/generation-stream-protocol.mjs";
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => String(input).startsWith("https://api64.ipify.org/")
  ? Promise.resolve(Response.json({ ip: "192.0.2.1" }))
  : originalFetch(input, init);
const outputDir = process.env.IMAGE_STUDIO_OUTPUT_DIR;
const firstRuntime = await import("./server.mjs?vercel-generation-first");
process.env.IMAGE_STUDIO_OUTPUT_DIR = outputDir + "-other-instance";
process.env.IMAGE_STUDIO_LOCAL_DATA_DIR += "-other-instance";
const secondRuntime = await import("./server.mjs?vercel-generation-second");
const servers = [firstRuntime, secondRuntime].map((runtime) => createServer(runtime.default));
try {
  for (const server of servers) {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  }
  const [firstUrl, secondUrl] = servers.map((server) => "http://127.0.0.1:" + server.address().port);
  for (const backgroundField of ["background", "backgroundGeneration"]) {
    const form = new FormData();
    form.set("jobId", "vercel-generation-" + backgroundField);
    form.set("clientSessionId", "vercel-generation-session");
    form.set(backgroundField, "1");
    form.set("prompt", "Vercel image delivery regression");
    form.set("ratio", "1:1");
    form.set("size", "1024x1024");
    form.set("format", "png");
    form.set("baseUrl", "http://127.0.0.1:9/v1");
    form.set("apiKey", "test-key");
    const response = await fetch(firstUrl + "/api/generate", {
      method: "POST",
      headers: { Host: "gpt-image2-studio-gules.vercel.app" },
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    const events = [];
    await consumeSse(response.body, (eventName, payload) => events.push({ eventName, payload }));
    assert.equal(events.some((event) => event.eventName === "queued"), false,
      "Vercel must not end the request and hand image delivery to instance-local polling");
    assert.equal(events.some((event) => event.eventName === "error"), false);
    assertGenerationStreamDeliveryOrder(events);
    const finalImage = events.find((event) => event.eventName === "final_image");
    const saved = events.find((event) => event.eventName === "saved");
    assert.match(finalImage?.payload.dataUrl || "", /^data:image\\/png;base64,/);
    assert.ok(saved?.payload.item?.relativePath);
    assert.equal(events.at(-1).eventName, "complete");
    const imageBytes = Buffer.from(finalImage.payload.dataUrl.split(",")[1], "base64");
    assert.deepEqual(imageBytes, await readFile(join(outputDir, saved.payload.item.relativePath)));
    const otherTasks = await fetch(secondUrl + "/api/generation/tasks", {
      headers: { "x-client-session-id": "vercel-generation-session" },
    });
    assert.deepEqual(await otherTasks.json(), []);
    const otherImage = await fetch(secondUrl + saved.payload.item.imageUrl);
    assert.equal(otherImage.status, 404);
    await otherImage.arrayBuffer();
  }
  console.log("VERCEL_IMAGE_DELIVERY_VERIFIED");
} finally {
  for (const server of servers) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}
`;
  const result = await execFileAsync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: rootDir,
    env: {
      ...process.env,
      VERCEL: "1",
      VERCEL_REGION: "iad1",
      HOST: "0.0.0.0",
      PORT: "0",
      IMAGE_STUDIO_ENABLE_TEST_MOCKS: "1",
      IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "1",
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    },
    timeout: 15000,
    windowsHide: true,
  });

  assert.match(result.stdout, /VERCEL_IMAGE_DELIVERY_VERIFIED/);
});
