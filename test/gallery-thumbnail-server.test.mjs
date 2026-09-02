import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { resolveGalleryImageAsset } from "../lib/gallery-thumbnail.mjs";
import { saveGeneratedAsset } from "../lib/gallery-store.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAE0lEQVR4AWP8b5z2nwEImBigAAAoQQKbZzoQzQAAAABJRU5ErkJggg==",
  "base64",
);

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
      throw new Error(`server exited early (${server.exitCode})\n${diagnostics.stderr}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/config`);
      await response.arrayBuffer();
      if (response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`server did not start: ${lastError?.message || "timeout"}\n${diagnostics.stderr}`);
}

async function startTemporaryServer(t, outputDir) {
  const tempRoot = await mkdtemp(join(tmpdir(), "gallery-thumbnail-server-"));
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
  return baseUrl;
}

test("gallery thumbnail route returns WebP, rejects unsafe paths, and falls back to the original", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "gallery-thumbnail-output-"));
  const outputDir = join(tempRoot, "output");
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const source = await saveGeneratedAsset({
    outputDir,
    filename: "thumbnail-source.png",
    imageBuffer: VALID_PNG,
    metadata: {
      createdAt: "2026-09-01T10:00:00.000Z",
      format: "png",
    },
  });
  const damaged = await saveGeneratedAsset({
    outputDir,
    filename: "damaged.png",
    imageBuffer: Buffer.from("not-a-decodable-image"),
    metadata: {
      createdAt: "2026-09-01T10:01:00.000Z",
      format: "png",
    },
  });
  const baseUrl = await startTemporaryServer(t, outputDir);

  const galleryResponse = await fetch(`${baseUrl}/api/gallery`);
  assert.equal(galleryResponse.status, 200);
  const gallery = await galleryResponse.json();
  const sourceItem = gallery.find((item) => item.filename === source.filename);
  const damagedItem = gallery.find((item) => item.filename === damaged.filename);
  assert.ok(sourceItem);
  assert.ok(damagedItem);
  assert.notEqual(sourceItem.imageUrl, sourceItem.thumbnailUrl);

  const thumbnailResponse = await fetch(`${baseUrl}${sourceItem.thumbnailUrl}`);
  const thumbnailBytes = Buffer.from(await thumbnailResponse.arrayBuffer());
  assert.equal(thumbnailResponse.status, 200);
  assert.match(thumbnailResponse.headers.get("content-type") || "", /^image\/webp/);
  assert.equal(thumbnailBytes.subarray(0, 4).toString("ascii"), "RIFF");
  const thumbnailAsset = resolveGalleryImageAsset({ outputDir, relativeImagePath: source.relativePath });
  assert.ok(thumbnailAsset);
  await access(thumbnailAsset.thumbnailPath);

  const fallbackResponse = await fetch(`${baseUrl}${damagedItem.thumbnailUrl}`);
  assert.equal(fallbackResponse.status, 200);
  assert.match(fallbackResponse.headers.get("content-type") || "", /^image\/png/);
  assert.deepEqual(Buffer.from(await fallbackResponse.arrayBuffer()), Buffer.from("not-a-decodable-image"));

  for (const path of [
    "../thumbnail-source.png",
    "json/thumbnail-source.png",
    "thumbnail-source.txt",
    "/thumbnail-source.png",
    "carrier:secret.png",
    "nested/image:stream.webp",
  ]) {
    const response = await fetch(`${baseUrl}/api/gallery/thumbnail?${new URLSearchParams({ path }).toString()}`);
    assert.equal(response.status, 404, path);
  }
});
