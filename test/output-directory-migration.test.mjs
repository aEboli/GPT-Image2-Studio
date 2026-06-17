import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrateOutputDirectoryMonths } from "../lib/output-directory-migration.mjs";

test("output directory migration moves legacy date folders into year-month folders and rewrites PPT manifests", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "output-month-migration-"));
  const manifestPath = join(outputDir, "json", "ppt-decks", "deck-demo.json");

  await mkdir(join(outputDir, "2026-05-05", "2026-05-05-image"), { recursive: true });
  await mkdir(join(outputDir, "2026-05-05", "2026-05-05-ppt", "演示文稿-1234abcd"), { recursive: true });
  await mkdir(join(outputDir, "json", "2026-05-05", "2026-05-05-image"), { recursive: true });
  await mkdir(join(outputDir, "json", "creation-sets"), { recursive: true });
  await mkdir(join(outputDir, "json", "ppt-decks"), { recursive: true });
  await writeFile(join(outputDir, "2026-05-05", "2026-05-05-image", "demo.png"), "image");
  await writeFile(join(outputDir, "2026-05-05", "2026-05-05-ppt", "演示文稿-1234abcd", "slide-1.png"), "slide");
  await writeFile(join(outputDir, "2026-05-05", "2026-05-05-ppt", "演示文稿-1234abcd", "演示文稿-1234abcd.pptx"), "pptx");
  await writeFile(join(outputDir, "json", "2026-05-05", "2026-05-05-image", "demo.json"), "{}");
  await writeFile(
    join(outputDir, "json", "creation-sets", "creation-set-demo.json"),
    `${JSON.stringify(
      {
        setId: "creation-set-demo",
        createdAt: "2026-05-05T10:00:00.000Z",
        relativeDir: "05/2026-05-05/2026-05-05-creation/demo",
        items: [
          {
            itemId: "1-hero",
            slotIndex: 1,
            relativePath: "05/2026-05-05/2026-05-05-creation/demo/01-hero.png",
            imageUrl: "/output/05/2026-05-05/2026-05-05-creation/demo/01-hero.png",
            thumbnailUrl: "/output/05/2026-05-05/2026-05-05-creation/demo/01-hero.png",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        deckId: "deck-demo",
        title: "演示文稿",
        createdAt: "2026-05-05T10:00:00.000Z",
        slides: [
          {
            slideNumber: 1,
            relativePath: "2026-05-05/2026-05-05-ppt/演示文稿-1234abcd/slide-1.png",
            imageUrl: "/output/2026-05-05/2026-05-05-ppt/演示文稿-1234abcd/slide-1.png",
            thumbnailUrl: "/output/2026-05-05/2026-05-05-ppt/演示文稿-1234abcd/slide-1.png",
          },
        ],
        pptxRelativePath: "2026-05-05/2026-05-05-ppt/演示文稿-1234abcd/演示文稿-1234abcd.pptx",
        pptxUrl: "/output/2026-05-05/2026-05-05-ppt/演示文稿-1234abcd/演示文稿-1234abcd.pptx",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const result = await migrateOutputDirectoryMonths({ outputDir });
  await migrateOutputDirectoryMonths({ outputDir });

  const migratedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const migratedCreationManifest = JSON.parse(
    await readFile(join(outputDir, "json", "creation-sets", "creation-set-demo.json"), "utf8"),
  );
  assert.equal(result.movedDateFolders, 1);
  assert.equal(result.movedMetadataDateFolders, 1);
  assert.equal(result.updatedPptManifests, 1);
  assert.equal(result.updatedCreationManifests, 1);
  await access(join(outputDir, "2026-05", "05-05", "2026-05-05-image", "demo.png"));
  await access(join(outputDir, "2026-05", "05-05", "2026-05-05-ppt", "演示文稿-1234abcd", "slide-1.png"));
  await access(join(outputDir, "2026-05", "05-05", "2026-05-05-ppt", "演示文稿-1234abcd", "演示文稿-1234abcd.pptx"));
  await access(join(outputDir, "json", "2026-05", "05-05", "2026-05-05-image", "demo.json"));
  await assert.rejects(access(join(outputDir, "2026-05-05", "2026-05-05-image", "demo.png")));
  assert.equal(migratedCreationManifest.relativeDir, "2026-05/05-05/2026-05-05-creation/demo");
  assert.equal(
    migratedCreationManifest.items[0].relativePath,
    "2026-05/05-05/2026-05-05-creation/demo/01-hero.png",
  );
  assert.equal(
    migratedCreationManifest.items[0].imageUrl,
    "/output/2026-05/05-05/2026-05-05-creation/demo/01-hero.png",
  );
  assert.equal(
    migratedManifest.pptxRelativePath,
    "2026-05/05-05/2026-05-05-ppt/演示文稿-1234abcd/演示文稿-1234abcd.pptx",
  );
  assert.equal(
    migratedManifest.pptxUrl,
    "/output/2026-05/05-05/2026-05-05-ppt/演示文稿-1234abcd/演示文稿-1234abcd.pptx",
  );
  assert.equal(migratedManifest.slides[0].relativePath, "2026-05/05-05/2026-05-05-ppt/演示文稿-1234abcd/slide-1.png");
  assert.equal(migratedManifest.slides[0].imageUrl, "/output/2026-05/05-05/2026-05-05-ppt/演示文稿-1234abcd/slide-1.png");
  assert.equal(
    migratedManifest.slides[0].thumbnailUrl,
    "/output/2026-05/05-05/2026-05-05-ppt/演示文稿-1234abcd/slide-1.png",
  );
});
