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

test("server import completes when Vercel captures the listen call", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-vercel-capture-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const source = `
import { Server, createServer, request as httpRequest } from "node:http";
const originalListen = Server.prototype.listen;
Server.prototype.listen = function () {
  Server.prototype.listen = originalListen;
  return this;
};
const runtime = await import("./server.mjs?vercel-capture-probe");
if (!runtime.studioServer || typeof runtime.default !== "function") {
  throw new Error("Vercel default request handler was not exported");
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
      PORT: "0",
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    },
    timeout: 5000,
    windowsHide: true,
  });

  assert.match(result.stdout, /CAPTURE_IMPORT_RESOLVED/);
});
