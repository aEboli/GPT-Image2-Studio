import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

const SET_ID = "article-set-under-test";

function makeSeedManifest() {
  return {
    setId: SET_ID,
    title: "测试文章",
    sourceSummary: "用于验证文章插图生图路径的最小文章。",
    contentType: "narrative",
    stylePreset: "cinematic",
    styleBible: "统一冷色调，人物保持同一发型。",
    recommendedImageCount: 2,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    status: "planned",
    relativeDir: "2026-08-26-article/article-set-under-test",
    characters: [{ name: "主角", description: "短发，深蓝外套。" }],
    scenes: [{ name: "码头", description: "清晨的海边码头。" }],
    referenceCards: [
      {
        cardId: "card-hero",
        kind: "character",
        name: "主角",
        prompt: "Character reference card for 主角.",
      },
    ],
    items: [
      {
        itemId: "item-card-hero",
        itemKind: "reference-card",
        cardId: "card-hero",
        title: "主角参考卡",
        prompt: "Character reference card for 主角.",
        captionText: "",
        status: "planned",
      },
      {
        itemId: "item-scene-1",
        itemKind: "storyboard",
        title: "码头清晨",
        paragraphIndex: 1,
        timelineIndex: 1,
        narrativeBeat: "开场",
        prompt: "主角站在清晨的码头上远望海面。",
        captionText: "清晨的码头。",
        referencedCardIds: ["card-hero"],
        status: "planned",
      },
    ],
  };
}

async function startArticleStudioServer(t, { tempPrefix }) {
  const tempRoot = await mkdtemp(join(tmpdir(), tempPrefix));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const manifestsDir = join(outputDir, "json", "article-illustration-sets");
  await mkdir(manifestsDir, { recursive: true });
  await writeFile(
    join(manifestsDir, `${SET_ID}.json`),
    `${JSON.stringify(makeSeedManifest(), null, 2)}\n`,
    "utf8",
  );

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
  return { baseUrl, outputDir, diagnostics };
}

function makeArticleGenerateForm({ itemIds = [] } = {}) {
  const formData = new FormData();
  formData.set("setId", SET_ID);
  formData.set("ratio", "3:2");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("clientSessionId", "article-illustration-session");
  formData.set("regenerate", "1");
  if (itemIds.length > 0) {
    formData.set("itemIds", JSON.stringify(itemIds));
  }
  return formData;
}

test("article illustration generation completes items without a scope error", async (t) => {
  const { baseUrl, outputDir } = await startArticleStudioServer(t, {
    tempPrefix: "article-illustration-generate-",
  });

  const response = await fetch(`${baseUrl}/api/article-illustration/generate`, {
    method: "POST",
    body: makeArticleGenerateForm(),
  });
  const text = await response.text();
  const events = parseSseEvents(text);

  assert.equal(response.status, 200);

  const failures = events.filter((event) => event.eventName === "item_failed");
  const referenceErrors = failures.filter((event) => /ReferenceError/.test(String(event.payload?.message || "")));
  assert.deepEqual(
    referenceErrors.map((event) => event.payload.message),
    [],
    "no item may fail with a ReferenceError from the generation call site",
  );
  assert.deepEqual(failures.map((event) => event.payload?.message), [], text);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);

  const savedEvents = events.filter((event) => event.eventName === "item_saved");
  assert.equal(savedEvents.length, 2, text);
  for (const savedEvent of savedEvents) {
    assert.equal(savedEvent.payload.item.status, "completed");
    assert.ok(savedEvent.payload.item.relativePath, "saved item must carry a stored asset path");
  }

  const complete = events.find((event) => event.eventName === "complete");
  assert.ok(complete, "expected a complete event");
  assert.equal(complete.payload.set.status, "completed");
  assert.equal(complete.payload.set.items.length, 2);

  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  const metadata = await Promise.all(
    jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))),
  );
  const articleAssets = metadata.filter((entry) => entry?.assetKind === "article-illustration-image");
  assert.equal(
    articleAssets.length,
    2,
    `expected two saved article assets, got ${JSON.stringify(metadata.map((entry) => entry?.assetKind))}`,
  );
  // The generation call must not carry an image-edit shape, so no saved asset may
  // claim a mask or a local-mask execution strategy.
  for (const entry of articleAssets) {
    assert.equal(entry.editMode, undefined);
    assert.equal(entry.executionStrategy, undefined);
  }
});

test("article reference card generation completes and saves its card", async (t) => {
  const { baseUrl } = await startArticleStudioServer(t, {
    tempPrefix: "article-illustration-references-",
  });

  const response = await fetch(`${baseUrl}/api/article-illustration/generate-references`, {
    method: "POST",
    body: makeArticleGenerateForm(),
  });
  const text = await response.text();
  const events = parseSseEvents(text);

  assert.equal(response.status, 200);
  assert.deepEqual(
    events
      .filter((event) => event.eventName === "item_failed")
      .map((event) => event.payload?.message),
    [],
    text,
  );
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);

  const started = events.find((event) => event.eventName === "references_started");
  assert.ok(started, "expected references_started event");
  assert.equal(started.payload.targetCount, 1, "only the reference card is targeted");

  const savedEvents = events.filter((event) => event.eventName === "item_saved");
  assert.equal(savedEvents.length, 1, text);
  assert.equal(savedEvents[0].payload.item.itemId, "item-card-hero");
  assert.equal(savedEvents[0].payload.item.status, "completed");
  assert.ok(savedEvents[0].payload.item.relativePath);
});
