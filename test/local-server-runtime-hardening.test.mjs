import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
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

function makePortraitForm({ valid = true } = {}) {
  const formData = new FormData();
  if (valid) {
    formData.set("subjectSummary", "adult subject in a navy jacket, neutral expression");
  }
  formData.set("imageCount", "1");
  formData.set("selectedStyles", JSON.stringify(["business-profile"]));
  formData.set("selectedShotTypes", JSON.stringify(["medium-shot"]));
  formData.set("selectedActions", JSON.stringify(["standing-relaxed"]));
  formData.set("ratio", "4:5");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("apiKey", "test-key");
  formData.set("clientSessionId", "portrait-runtime-test");
  return formData;
}

function postWithHost({ port, hostHeader, path = "/api/config" }) {
  return new Promise((resolveRequest, rejectRequest) => {
    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Host: hostHeader,
          "Content-Type": "application/json",
          "Content-Length": "2",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => resolveRequest({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    request.once("error", rejectRequest);
    request.end("{}");
  });
}

function getNonLoopbackIpv4Address() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return "";
}

async function startServer(t) {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-runtime-hardening-"));
  const outputDir = join(tempRoot, "output");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    VERCEL: "1",
    TMP: tempRoot,
    TEMP: tempRoot,
    IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "1",
    IMAGE_STUDIO_OUTPUT_DIR: outputDir,
    IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    IMAGE_STUDIO_REQUEST_TOKEN: "runtime-test-token",
  };
  delete env.HOST;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);
  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });
  await waitForServer(baseUrl, server, diagnostics);
  return { baseUrl, diagnostics, outputDir, port };
}

test("plain HTTP non-loopback binding fails closed without explicit opt-in", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-remote-bind-"));
  const env = {
    ...process.env,
    PORT: String(await getFreePort()),
    HOST: "0.0.0.0",
    VERCEL: "1",
    TMP: tempRoot,
    TEMP: tempRoot,
    IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
    IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
  };
  delete env.IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);
  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  const [exitCode] = await Promise.race([
    once(server, "exit"),
    delay(7000).then(() => { throw new Error("remote bind did not fail before listening"); }),
  ]);

  assert.notEqual(exitCode, 0);
  assert.match(diagnostics.stderr, /IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP=1/);
  assert.match(diagnostics.stderr, /TLS/);
});

test("local portrait mock emits non-empty success and error SSE and persists the completed set", async (t) => {
  const { baseUrl, outputDir } = await startServer(t);

  const successResponse = await fetch(`${baseUrl}/api/portrait/generate`, {
    method: "POST",
    body: makePortraitForm(),
  });
  const successText = await successResponse.text();
  const successEvents = parseSseEvents(successText);
  const complete = successEvents.find((event) => event.eventName === "complete");

  assert.equal(successResponse.status, 200);
  assert.ok(successText.trim(), "success SSE body must not be empty");
  assert.ok(complete, successText);
  assert.equal(complete.payload.set.status, "completed");
  assert.equal(complete.payload.set.items.length, 1);
  assert.equal(complete.payload.set.items[0].status, "completed");

  const manifestDir = join(outputDir, "json", "portrait-sets");
  const manifestFiles = (await readdir(manifestDir)).filter((entry) => entry.endsWith(".json"));
  assert.equal(manifestFiles.length, 1);
  const manifest = JSON.parse(await readFile(join(manifestDir, manifestFiles[0]), "utf8"));
  assert.equal(manifest.setId, complete.payload.set.setId);
  assert.equal(manifest.status, "completed");
  assert.equal(manifest.items[0].status, "completed");

  const errorResponse = await fetch(`${baseUrl}/api/portrait/generate`, {
    method: "POST",
    body: makePortraitForm({ valid: false }),
  });
  const errorText = await errorResponse.text();
  const errorEvents = parseSseEvents(errorText);
  const error = errorEvents.find((event) => event.eventName === "error");

  assert.equal(errorResponse.status, 200);
  assert.ok(errorText.trim(), "error SSE body must not be empty");
  assert.ok(error, errorText);
  assert.match(error.payload.message, /人物描述不能为空/);
});

test("local server defaults to loopback and rejects cross-origin or non-loopback-host POST requests", async (t) => {
  const { baseUrl, diagnostics, port } = await startServer(t);

  assert.match(diagnostics.stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}`));
  assert.match(diagnostics.stdout, /远程浏览器认证用户名: studio/);
  assert.match(diagnostics.stdout, /远程访问令牌: runtime-test-token/);

  const localAddress = getNonLoopbackIpv4Address();
  if (localAddress) {
    await assert.rejects(
      fetch(`http://${localAddress}:${port}/api/config`, { signal: AbortSignal.timeout(1000) }),
      /fetch failed|aborted|timeout/i,
    );
  }

  const crossOrigin = await fetch(`${baseUrl}/api/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
    body: "{}",
  });
  assert.equal(crossOrigin.status, 403);

  const hostileHost = await postWithHost({ port, hostHeader: `evil.example:${port}` });
  assert.equal(hostileHost.status, 403);

  for (const malformedHost of [
    `evil.example@127.0.0.1:${port}`,
    `127.0.0.1#@evil.example:${port}`,
  ]) {
    const malformed = await postWithHost({ port, hostHeader: malformedHost });
    assert.equal(malformed.status, 403, malformedHost);
  }

  const sameOrigin = await fetch(`${baseUrl}/api/portrait/plan`, {
    method: "POST",
    headers: { Origin: baseUrl },
    body: makePortraitForm(),
  });
  assert.equal(sameOrigin.status, 200);
  assert.equal((await sameOrigin.json()).ok, true);

  const localCli = await fetch(`${baseUrl}/api/portrait/plan`, {
    method: "POST",
    body: makePortraitForm(),
  });
  assert.equal(localCli.status, 200);
  assert.equal((await localCli.json()).ok, true);

  const tokenAuthorized = await fetch(`${baseUrl}/api/portrait/plan`, {
    method: "POST",
    headers: {
      Origin: "http://evil.example",
      "X-Image-Studio-Token": "runtime-test-token",
    },
    body: makePortraitForm(),
  });
  assert.equal(tokenAuthorized.status, 200);
  assert.equal((await tokenAuthorized.json()).ok, true);
});
