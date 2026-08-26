import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 2x2 PNG: passes generated-image validation's minimum dimension.
const VALID_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=";

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

async function startServer(t) {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-preview-save-"));
  const outputDir = join(tempRoot, "output");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    TMP: tempRoot,
    TEMP: tempRoot,
    IMAGE_STUDIO_OUTPUT_DIR: outputDir,
    IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    IMAGE_STUDIO_REQUEST_TOKEN: "preview-save-token",
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
  return { baseUrl, outputDir, diagnostics };
}

async function collectOutputFiles(outputDir) {
  const files = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        files.push(entry.name);
      }
    }
  }
  await walk(outputDir);
  return files;
}

function postPreviewSave(baseUrl, body) {
  return fetch(`${baseUrl}/api/prompt-preview/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("另存未完成预览写入输出目录并标记来源", async (t) => {
  const { baseUrl, outputDir } = await startServer(t);

  const response = await postPreviewSave(baseUrl, {
    imageBase64: VALID_PNG_BASE64,
    prompt: "一只在窗台上的橘猫",
    ratio: "3:2",
    format: "png",
    size: "1536x1024",
    quality: "high",
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.ok(payload.filename);
  assert.ok(payload.item, "应返回可并入画廊的条目");
  assert.equal(payload.item.previewOrigin, "partial-attempt-preview");

  const files = await collectOutputFiles(outputDir);
  assert.ok(files.some((name) => name === payload.filename), "预览应已落盘");

  const galleryResponse = await fetch(`${baseUrl}/api/gallery`);
  const gallery = await galleryResponse.json();
  const items = Array.isArray(gallery) ? gallery : gallery.items || [];
  assert.ok(items.some((item) => item.filename === payload.filename), "另存结果应出现在画廊中");
});

test("非法图像数据被拒绝且不落盘", async (t) => {
  const { baseUrl, outputDir } = await startServer(t);

  const response = await postPreviewSave(baseUrl, {
    imageBase64: Buffer.from("not-an-image").toString("base64"),
    prompt: "非法数据",
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.match(payload.message, /预览|无效/);

  assert.deepEqual(await collectOutputFiles(outputDir), [], "拒绝的请求不应产生任何文件");
});

test("缺少图片数据被拒绝", async (t) => {
  const { baseUrl, outputDir } = await startServer(t);

  const response = await postPreviewSave(baseUrl, { prompt: "没有图" });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).ok, false);
  assert.deepEqual(await collectOutputFiles(outputDir), []);
});

test("超过字节上限的请求体被拒绝且不落盘", async (t) => {
  const { baseUrl, outputDir } = await startServer(t);

  const response = await fetch(`${baseUrl}/api/prompt-preview/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 超过 32 MiB 上限。
    body: `{"imageBase64":"${"A".repeat(33 * 1024 * 1024)}"}`,
  });

  assert.equal(response.status, 413);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.deepEqual(await collectOutputFiles(outputDir), []);
});

test("客户端提供的文件名不影响落盘位置", async (t) => {
  const { baseUrl, outputDir } = await startServer(t);

  const response = await postPreviewSave(baseUrl, {
    imageBase64: VALID_PNG_BASE64,
    prompt: "路径穿越尝试",
    filename: "../../escaped.png",
    relativePath: "../../escaped.png",
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.notEqual(payload.filename, "escaped.png");
  assert.ok(!payload.filename.includes(".."), "文件名不得包含父目录引用");
  assert.ok(!payload.filename.includes("/") && !payload.filename.includes("\\"));

  const files = await collectOutputFiles(outputDir);
  assert.ok(files.includes(payload.filename));
  assert.ok(!files.includes("escaped.png"));
});

test("另存不触发上游生成任务", async (t) => {
  const { baseUrl } = await startServer(t);

  await postPreviewSave(baseUrl, {
    imageBase64: VALID_PNG_BASE64,
    prompt: "不应产生生成任务",
  });

  const tasksResponse = await fetch(`${baseUrl}/api/generation/tasks`, {
    headers: { "x-client-session-id": "preview-save-session" },
  });
  const tasks = await tasksResponse.json();
  const taskList = Array.isArray(tasks) ? tasks : tasks.tasks || [];
  assert.equal(taskList.length, 0, "另存不应创建生成任务");
});
