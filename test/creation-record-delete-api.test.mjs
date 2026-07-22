import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getFreePort() {
  const server = createTcpServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
  return address.port;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    delay(1500).then(() => {
      if (server.exitCode === null && !server.signalCode) server.kill("SIGKILL");
    }),
  ]);
}

async function waitForServer(baseUrl, server) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`server exited early (${server.exitCode})`);
    try {
      const response = await fetch(`${baseUrl}/api/creation/sets`);
      if (response.status < 500) return;
    } catch {}
    await delay(100);
  }
  throw new Error("server did not start");
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeCreationSet(outputDir, setId, folderName) {
  const relativeDir = `2026-07/07-22/2026-07-22-creation/${folderName}`;
  const manifestDir = join(outputDir, "json", "creation-sets");
  const imageDir = join(outputDir, ...relativeDir.split("/"));
  const metadataDir = join(outputDir, "json", ...relativeDir.split("/"));
  await Promise.all([
    mkdir(manifestDir, { recursive: true }),
    mkdir(imageDir, { recursive: true }),
    mkdir(metadataDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(imageDir, "01-hero.png"), "image"),
    writeFile(join(metadataDir, "01-hero.json"), "{}\n"),
    writeFile(join(manifestDir, `${setId}.json`), `${JSON.stringify({
      setId,
      productName: folderName,
      relativeDir,
      createdAt: "2026-07-22T08:00:00.000Z",
      updatedAt: "2026-07-22T08:00:00.000Z",
      status: "completed",
      items: [],
    }, null, 2)}\n`),
  ]);
  return {
    manifestPath: join(manifestDir, `${setId}.json`),
    imageDir,
    metadataDir,
  };
}

test("local creation record deletion endpoint deletes a distinct batch and dedicated assets", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-record-delete-api-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const deleted = await writeCreationSet(outputDir, "set-delete", "delete-me");
  const preserved = await writeCreationSet(outputDir, "set-keep", "keep-me");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });
  await waitForServer(baseUrl, server);

  const emptyResponse = await fetch(`${baseUrl}/api/creation/sets/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setIds: [] }),
  });
  assert.equal(emptyResponse.status, 400);

  const response = await fetch(`${baseUrl}/api/creation/sets/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setIds: ["set-delete", "set-delete", "set-missing"] }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.ok, true);
  assert.equal(payload.deletedCount, 1);
  assert.deepEqual(payload.deletedSetIds, ["set-delete"]);
  assert.deepEqual(payload.notFoundSetIds, ["set-missing"]);
  assert.equal(await pathExists(deleted.manifestPath), false);
  assert.equal(await pathExists(deleted.imageDir), false);
  assert.equal(await pathExists(deleted.metadataDir), false);
  assert.equal(await pathExists(preserved.manifestPath), true);
  assert.equal(await pathExists(preserved.imageDir), true);
  assert.equal(await pathExists(preserved.metadataDir), true);

  const listResponse = await fetch(`${baseUrl}/api/creation/sets`);
  const listed = await listResponse.json();
  assert.deepEqual(listed.map((set) => set.setId), ["set-keep"]);
  assert.match(await readFile(preserved.manifestPath, "utf8"), /"setId": "set-keep"/);
});
