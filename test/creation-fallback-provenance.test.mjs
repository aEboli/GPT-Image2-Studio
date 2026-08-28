import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function getFunctionSource(source, name, nextName) {
  const pattern = new RegExp(`function ${name}\\([\\s\\S]*?(?=\\nfunction ${nextName}\\()`);
  const matched = source.match(pattern)?.[0];
  assert.ok(matched, `could not extract ${name}`);
  return matched;
}

// Evaluate the real label function rather than regex-asserting its text, so the
// assertions break if the wording or the condition changes.
const statusLabel = new Function(
  "CREATION_ITEM_STATUS_LABELS",
  `${getFunctionSource(app, "getCreationStatusLabel", "getCreationItemStatusLabel")}
   ${getFunctionSource(app, "getCreationItemStatusLabel", "getCreationSellingPoints")}
   return getCreationItemStatusLabel;`,
)({ completed: "已完成", failed: "失败", generating: "生成中" });

test("a partial-image fallback result is labelled as not fully rendered", () => {
  const label = statusLabel({ status: "completed", partialImageFallback: true });

  assert.match(label, /已完成/);
  assert.match(label, /中途预览/);
  assert.match(label, /未完全渲染/);
});

test("a retained preview is labelled as retained", () => {
  assert.match(statusLabel({ status: "failed", previewRetained: true }), /保留中途预览/);
});

test("an ordinary item keeps its plain status label", () => {
  assert.equal(statusLabel({ status: "completed" }), "已完成");
  assert.equal(statusLabel({ status: "generating" }), "生成中");
});

test("the fallback flag wins over the retained-preview flag", () => {
  const label = statusLabel({ status: "completed", partialImageFallback: true, previewRetained: true });

  assert.match(label, /未完全渲染/);
  assert.equal(/保留中途预览/.test(label), false);
});

test("the item normalizer allowlists both provenance flags", () => {
  const normalizer = getFunctionSource(app, "normalizeCreationItemForView", "normalizeCreationSetForView");

  assert.match(normalizer, /partialImageFallback:/, "normalizer must allowlist partialImageFallback");
  assert.match(normalizer, /previewRetained:/, "normalizer must allowlist previewRetained");
});

test("the creation stream carries the fallback flag onto the item", () => {
  assert.equal(
    app.includes("...(payload.partialImageFallback ? { partialImageFallback: true } : {})"),
    true,
    "item_final_image handler must carry the fallback flag",
  );
});

// Counting the substring in server.mjs proved nothing: the flag was reaching
// saveGeneratedAsset and then being dropped by the gallery-store allowlist, so the
// count passed while the provenance never survived a reload. Assert the round trip.
test("a fallback result keeps its provenance on disk", async () => {
  const { mkdtemp, rm, readdir, readFile: read } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { saveGeneratedAsset } = await import("../lib/gallery-store.mjs");

  const outputDir = await mkdtemp(join(tmpdir(), "creation-provenance-"));
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
    "hex",
  );

  async function sidecarFor(relativePath) {
    const found = [];
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const next = join(dir, entry.name);
        if (entry.isDirectory()) await walk(next);
        else if (entry.name.endsWith(".json") && !entry.name.includes("index")) found.push(next);
      }
    }
    await walk(outputDir);
    const stem = relativePath.split("/").pop().replace(/.[^.]+$/, "");
    const match = found.find((p) => p.endsWith(`${stem}.json`));
    assert.ok(match, `no sidecar for ${relativePath}`);
    return JSON.parse(await read(match, "utf8"));
  }

  try {
    const fallback = await saveGeneratedAsset({
      outputDir,
      relativeDir: "set",
      filename: "fallback.png",
      imageBuffer: png,
      metadata: { prompt: "p", createdAt: new Date().toISOString(), partialImageFallback: true },
    });
    assert.equal(fallback.metadata.partialImageFallback, true, "normalized metadata must carry the flag");
    assert.equal((await sidecarFor(fallback.relativePath)).partialImageFallback, true, "sidecar must persist the flag");

    const ordinary = await saveGeneratedAsset({
      outputDir,
      relativeDir: "set",
      filename: "ordinary.png",
      imageBuffer: png,
      metadata: { prompt: "p", createdAt: new Date().toISOString() },
    });
    const ordinarySidecar = await sidecarFor(ordinary.relativePath);
    assert.equal(
      Object.hasOwn(ordinarySidecar, "partialImageFallback"),
      false,
      "an ordinary result must not carry the flag at all",
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

// Every creation route that can deliver a partial fallback must mark what it saves.
test("each creation route that streams partials marks its saved metadata", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  // Count assignments only; the function definition matches the bare name too.
  const routes = server.split("= createCreationItemPartialImageWriter(response)").length - 1;
  const marks = server.split("partialImageFallback: generationResult.partialImageFallbackUsed === true,").length - 1;

  assert.ok(routes > 0, "expected at least one creation route");
  assert.equal(marks, routes, "every creation route streaming partials must mark the saved metadata");
});
