import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildCreationRelativeDir,
  createCreationSetStore,
  normalizeCreationSetManifest,
} from "../lib/creation-store.mjs";
import { buildCreationItemReferenceImages } from "../lib/creation-reference-labels.mjs";

async function writeOutputFile(outputDir, relativePath, content = "image") {
  const segments = String(relativePath).split("/");
  const filename = segments.pop();
  await mkdir(join(outputDir, ...segments), { recursive: true });
  await writeFile(join(outputDir, ...segments, filename), content);
}

async function creationStorePathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

test("creation store builds dated creation directories beside image and ppt folders", () => {
  assert.equal(
    buildCreationRelativeDir({
      createdAt: new Date(2026, 4, 5, 9, 8, 7),
      productName: "AeroPress Clear",
      setId: "creation-set-abc12345",
    }),
    "2026-05/05-05/2026-05-05-creation/0908-AeroPressClear-abc12345",
  );
});

test("creation store normalizes set manifests with output URLs and item ordering", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-demo",
      productName: "云感防晒衣",
      targetLanguage: "zh-CN",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [
        {
          itemId: "2-benefit",
          slotIndex: 2,
          role: "benefit",
          title: "卖点图",
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/02-benefit.png",
        },
        {
          itemId: "1-hero",
          slotIndex: 1,
          role: "hero",
          title: "主图",
          conversionIntent: { conversionGoal: "建立首图识别" },
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/01-hero.png",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(
    manifest.items.map((item) => item.itemId),
    ["1-hero", "2-benefit"],
  );
  assert.equal(
    manifest.items[0].imageUrl,
    "/output/2026-05/05-05/2026-05-05-creation/demo/01-hero.png",
  );
  assert.deepEqual(manifest.items[0].conversionIntent, { conversionGoal: "建立首图识别" });
});

test("creation store reconciles saved counts with actual plan items", () => {
  const manifest = normalizeCreationSetManifest({
    setId: "creation-set-stale-counts",
    imageCount: 10,
    carouselImageCount: 10,
    skuImageCount: 7,
    infographicRebuildCount: 6,
    totalPlannedItemCount: 23,
    effectivePlan: {
      imageCount: 10,
      carouselImageCount: 10,
      skuImageCount: 7,
      infographicRebuildCount: 6,
      totalPlannedItemCount: 23,
      items: [
        { itemId: "rebuild", slotIndex: 1, role: "infographic-rebuild", itemKind: "infographic-rebuild" },
        { itemId: "sku", slotIndex: 2, role: "sku", itemKind: "sku" },
      ],
    },
    items: [
      { itemId: "rebuild", slotIndex: 1, role: "infographic-rebuild", itemKind: "infographic-rebuild" },
      { itemId: "sku", slotIndex: 2, role: "sku", itemKind: "sku" },
    ],
  });

  assert.equal(manifest.imageCount, 0);
  assert.equal(manifest.carouselImageCount, 0);
  assert.equal(manifest.skuImageCount, 1);
  assert.equal(manifest.infographicRebuildCount, 1);
  assert.equal(manifest.totalPlannedItemCount, 2);
  assert.equal(manifest.effectivePlan.imageCount, 0);
  assert.equal(manifest.effectivePlan.carouselImageCount, 0);
  assert.equal(manifest.effectivePlan.skuImageCount, 1);
  assert.equal(manifest.effectivePlan.infographicRebuildCount, 1);
  assert.equal(manifest.effectivePlan.totalPlannedItemCount, 2);
});

test("creation store preserves scenario image count and reference image metadata", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-demo",
      productName: "AeroPress Clear",
      scenario: "social-seeding",
      scenarioLabel: "社媒种草",
      platform: "amazon",
      platformLabel: "Amazon",
      visualLanguage: "premium-studio",
      visualLanguageLabel: "高端棚拍",
      industryTemplate: "food",
      industryTemplateLabel: "食品饮料",
      industryTemplatePath: "食品生鲜 > 休闲食品 > 坚果炒货 > 混合坚果",
      dimensionSpecs: "高 14.5 cm\n容量 350 ml",
      dimensionUnitMode: "both",
      imageCount: 6,
      selectedRoles: ["hero", "benefit", "comparison"],
      referenceImageNames: ["product-front.png", "package.png"],
      referenceImageRoles: [
        { filename: "product-front.png", role: "product", roleLabel: "商品主体" },
        { filename: "package.png", role: "package", roleLabel: "包装清单" },
      ],
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "generating",
      items: [],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.scenario, "social-seeding");
  assert.equal(manifest.scenarioLabel, "社媒种草");
  assert.equal(manifest.platform, "amazon");
  assert.equal(manifest.platformLabel, "Amazon");
  assert.equal(manifest.visualLanguage, "premium-studio");
  assert.equal(manifest.visualLanguageLabel, "高端棚拍");
  assert.equal(manifest.industryTemplate, "food");
  assert.equal(manifest.industryTemplateLabel, "食品饮料");
  assert.equal(manifest.industryTemplatePath, "食品生鲜 > 休闲食品 > 坚果炒货 > 混合坚果");
  assert.equal(manifest.dimensionSpecs, "高 14.5 cm\n容量 350 ml");
  assert.equal(manifest.dimensionUnitMode, "both");
  assert.equal(manifest.imageCount, 6);
  assert.equal(manifest.skuGenerationEnabled, true);
  assert.deepEqual(manifest.selectedRoles, ["hero", "benefit", "comparison"]);
  assert.deepEqual(manifest.referenceImageNames, ["product-front.png", "package.png"]);
  assert.deepEqual(
    manifest.referenceImageRoles.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [
      ["product-front.png", "product", "商品主体"],
      ["package.png", "package", "包装清单"],
    ],
  );
  assert.deepEqual(manifest.referenceImageRoles.map((entry) => entry.index), [1, 2]);
});

test("creation store preserves zero carousel image count with appended rebuild items", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-zero-carousel",
      productName: "Cooling towel 4-pack",
      imageCount: 0,
      selectedRoles: [],
      infographicRebuildEnabled: true,
      items: [
        {
          itemId: "queued-infographic-rebuild-1",
          slotIndex: 1,
          role: "infographic-rebuild",
          title: "Infographic rebuild 1",
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/01-rebuild.png",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.imageCount, 0);
  assert.deepEqual(manifest.selectedRoles, []);
  assert.equal(manifest.infographicRebuildEnabled, true);
  assert.equal(manifest.items.length, 1);
});

test("creation store does not treat blank image counts as zero carousel sets", () => {
  for (const imageCount of ["", null]) {
    const manifest = normalizeCreationSetManifest(
      {
        setId: `creation-set-blank-${String(imageCount)}`,
        productName: "Legacy set",
        imageCount,
        items: [
          { itemId: "hero", slotIndex: 1, role: "hero" },
          { itemId: "scene", slotIndex: 2, role: "scene" },
        ],
      },
      { publicBasePath: "/output" },
    );

    assert.equal(manifest.imageCount, 2);
  }
});

test("creation store falls back legacy set manifests to classic commercial visual language", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-legacy",
      productName: "Legacy product",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.visualLanguage, "classic-commercial");
  assert.equal(manifest.visualLanguageLabel, "经典商业摄影");
});

test("creation store preserves item generation telemetry", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-demo",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [
        {
          itemId: "1-hero",
          slotIndex: 1,
          status: "completed",
          filename: "01-hero.jpg",
          relativePath: "2026-05/05-05/2026-05-05-creation/demo/01-hero.jpg",
          generationStartedAt: "2026-05-05T09:00:01.000Z",
          generationCompletedAt: "2026-05-05T09:00:31.000Z",
          generationDurationMs: 30000,
          size: "1024x1024",
          format: "jpg",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.items[0].generationStartedAt, "2026-05-05T09:00:01.000Z");
  assert.equal(manifest.items[0].generationCompletedAt, "2026-05-05T09:00:31.000Z");
  assert.equal(manifest.items[0].generationDurationMs, 30000);
  assert.equal(manifest.items[0].size, "1024x1024");
  assert.equal(manifest.items[0].format, "jpg");
});

test("creation store preserves infographic rebuild setting and source metadata", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-infographic",
      productName: "Infographic rebuild product",
      skuGenerationEnabled: false,
      infographicRebuildEnabled: true,
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "partial_failed",
      items: [
        {
          itemId: "17-infographic-rebuild-1",
          slotIndex: 17,
          role: "infographic-rebuild",
          title: "Infographic rebuild 1",
          prompt: "Keep the original source information unchanged.",
          sourceInfographic: {
            filename: "size-chart.jpg",
            role: "dimensions",
            roleLabel: "Dimensions",
            rolePromptLabel: "dimension chart",
            note: "Keep measurements",
            index: 2,
          },
          status: "failed",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.equal(manifest.skuGenerationEnabled, false);
  assert.equal(manifest.infographicRebuildEnabled, true);
  assert.deepEqual(manifest.items[0].sourceInfographic, {
    filename: "size-chart.jpg",
    role: "dimensions",
    roleLabel: "Dimensions",
    rolePromptLabel: "dimension chart",
    note: "Keep measurements",
    index: 2,
  });
});

test("creation store preserves optional logo metadata for creation set detail display", async () => {
  const logo = {
    enabled: true,
    filename: "ALURES.png",
    placement: "top-left",
    placementLabel: "左上",
    promptPosition: "top-left corner",
    background: "transparent",
    backgroundLabel: "透明底，直接放置",
    backgroundInstruction: "Treat the supplied reference as a transparent logo and place the transparent logo directly.",
  };
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-logo",
      productName: "Fishing lure",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "generating",
      logo,
      items: [],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(manifest.logo, logo);

  const outputDir = await mkdtemp(join(tmpdir(), "creation-store-logo-"));
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const saved = await store.saveManifest(manifest);
  const raw = await readFile(store.manifestPath("creation-set-logo"), "utf8");

  assert.deepEqual(saved.logo, logo);
  assert.deepEqual(JSON.parse(raw).logo, logo);
});

test("creation store preserves listing drafts on manifest updates", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-listing-store-"));
  const store = createCreationSetStore({ outputDir: rootDir });

  const saved = await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Fishing Lure",
    listingDrafts: [
      {
        id: "listing-blue",
        skuSubjectId: "blue",
        evidenceMode: "input-only",
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
        sellingPoints: ["Bright color for visibility"],
        painPoints: ["Hard to track bait in stained water"],
        fiveBullets: ["2 Pack 3.5 in profile for compact tackle boxes."],
        description: "Blue fishing lure listing draft.",
        backendSearchTerms: "blue fishing lure bass bait",
      },
    ],
  });

  assert.equal(saved.listingDrafts.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.listingDrafts[0], "marketplace"), false);

  const read = await store.readManifest("creation-set-listing");
  assert.equal(read.listingDrafts[0].title, "2 Pack 3.5 in Blue Fishing Lures for Bass");

  const heroRelativePath = "2026-05/05-05/2026-05-05-creation/listing/01-hero.png";
  await writeOutputFile(rootDir, heroRelativePath);

  await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Updated Fishing Lure",
    status: "completed",
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "Hero image",
        relativePath: heroRelativePath,
      },
    ],
  });

  const updated = await store.readManifest("creation-set-listing");
  assert.equal(updated.productName, "Updated Fishing Lure");
  assert.equal(updated.status, "completed");
  assert.equal(updated.items.length, 1);
  assert.equal(updated.listingDrafts.length, 1);
  assert.equal(updated.listingDrafts[0].id, "listing-blue");

  await store.saveManifest({
    setId: "creation-set-listing",
    productName: "Updated Fishing Lure",
    listingDrafts: [],
  });

  const cleared = await store.readManifest("creation-set-listing");
  assert.equal(cleared.listingDrafts.length, 0);

  await rm(rootDir, { recursive: true, force: true });
});

test("creation store preserves historical V1 Listing fields without read-time migration", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-listing-v1-store-"));
  const store = createCreationSetStore({ outputDir: rootDir });
  const legacyDraft = {
    id: "legacy-amazon-draft",
    marketplace: "amazon-us",
    language: "en-US",
    title: "Original legacy title",
    painPoints: ["Original buyer concern"],
    fiveBullets: ["Original bullet one", "Original bullet two"],
    backendSearchTerms: "original backend phrase",
    zhDisplay: {
      title: "原始旧标题",
      painPoints: ["原始购买疑虑"],
      fiveBullets: ["原始要点一", "原始要点二"],
      backendSearchTerms: "原始后台词",
    },
    legacyOnlyField: { keep: true },
  };

  await store.saveManifest({
    setId: "creation-set-listing-v1",
    productName: "Legacy Product",
    listingDrafts: [legacyDraft],
  });
  await store.saveManifest({
    setId: "creation-set-listing-v1",
    productName: "Updated without listing changes",
    status: "completed",
  });

  const raw = JSON.parse(await readFile(store.manifestPath("creation-set-listing-v1"), "utf8"));
  assert.deepEqual(raw.listingDrafts, [legacyDraft]);
  const read = await store.readManifest("creation-set-listing-v1");
  assert.deepEqual(read.listingDrafts, [legacyDraft]);

  await rm(rootDir, { recursive: true, force: true });
});

test("creation store does not resurrect listing drafts after concurrent clear", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-listing-clear-store-"));
  const store = createCreationSetStore({ outputDir: rootDir });

  await store.saveManifest({
    setId: "creation-set-listing-clear",
    productName: "Fishing Lure",
    listingDrafts: [
      {
        id: "listing-blue",
        title: "2 Pack 3.5 in Blue Fishing Lures for Bass",
      },
    ],
  });

  const staleUpdate = store.saveManifest({
    setId: "creation-set-listing-clear",
    productName: "Updated without drafts",
  });
  const explicitClear = store.saveManifest({
    setId: "creation-set-listing-clear",
    productName: "Cleared",
    listingDrafts: [],
  });
  await Promise.all([staleUpdate, explicitClear]);

  const read = await store.readManifest("creation-set-listing-clear");
  assert.equal(read.listingDrafts.length, 0);

  await rm(rootDir, { recursive: true, force: true });
});

test("creation store preserves concurrent explicit listing draft replacements", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-listing-replace-store-"));
  const store = createCreationSetStore({ outputDir: rootDir });

  async function runConcurrentUpdate(setId, firstOperation) {
    await store.saveManifest({
      setId,
      productName: "Original Fishing Lure",
      listingDrafts: [
        {
          id: "listing-original",
          title: "2 Pack Original Fishing Lures",
        },
      ],
    });

    const explicitSave = () => store.saveManifest({
      setId,
      productName: "New Draft",
      listingDrafts: [
        {
          id: "listing-new",
          title: "2 Pack New Fishing Lures",
        },
      ],
    });
    const omittedUpdate = () => store.saveManifest({
      setId,
      productName: "Updated without drafts",
      status: "completed",
    });

    const first = firstOperation === "explicit" ? explicitSave() : omittedUpdate();
    const second = firstOperation === "explicit" ? omittedUpdate() : explicitSave();
    await Promise.all([first, second]);

    const read = await store.readManifest(setId);
    assert.equal(read.listingDrafts.length, 1);
    assert.equal(read.listingDrafts[0].id, "listing-new");
  }

  await runConcurrentUpdate("creation-set-listing-replace-explicit-first", "explicit");
  await runConcurrentUpdate("creation-set-listing-replace-omitted-first", "omitted");

  await rm(rootDir, { recursive: true, force: true });
});

test("creation set store marks completed items with missing image files as repairable", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "creation-store-missing-files-"));
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const existingRelativePath = "2026-05/05-05/2026-05-05-creation/demo/01-hero.png";
  const missingRelativePath = "2026-05/05-05/2026-05-05-creation/demo/02-benefit.png";

  await writeOutputFile(outputDir, existingRelativePath);
  await store.saveManifest({
    setId: "creation-set-missing-files",
    productName: "Fishing lure",
    status: "completed",
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "Hero",
        status: "completed",
        filename: "01-hero.png",
        relativePath: existingRelativePath,
      },
      {
        itemId: "2-benefit",
        slotIndex: 2,
        role: "benefit",
        title: "Benefit",
        status: "completed",
        filename: "02-benefit.png",
        relativePath: missingRelativePath,
      },
    ],
  });

  const read = await store.readManifest("creation-set-missing-files");
  const listed = await store.listManifests();

  assert.equal(read.status, "partial_failed");
  assert.equal(read.items[0].status, "completed");
  assert.equal(read.items[0].imageUrl, `/output/${existingRelativePath}`);
  assert.equal(read.items[1].status, "failed");
  assert.equal(read.items[1].missingAsset, true);
  assert.equal(read.items[1].imageUrl, "");
  assert.equal(read.items[1].thumbnailUrl, "");
  assert.equal(read.items[1].error, "图片文件缺失，可一键补图。");
  assert.equal(listed[0].status, "partial_failed");
  assert.equal(listed[0].items[1].status, "failed");
  assert.equal(listed[0].items[1].missingAsset, true);

  await rm(outputDir, { recursive: true, force: true });
});

test("creation set store treats directories and paths outside output as missing images", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-store-unsafe-paths-"));
  const outputDir = join(rootDir, "output");
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const directoryRelativePath = "2026-05/05-05/2026-05-05-creation/demo/01-directory.png";
  const outsideRelativePath = "../outside.png";

  await mkdir(join(outputDir, ...directoryRelativePath.split("/")), { recursive: true });
  await writeFile(join(rootDir, "outside.png"), "outside image");
  await store.saveManifest({
    setId: "creation-set-unsafe-paths",
    productName: "Fishing lure",
    status: "completed",
    items: [
      {
        itemId: "1-directory",
        slotIndex: 1,
        status: "completed",
        filename: "01-directory.png",
        relativePath: directoryRelativePath,
      },
      {
        itemId: "2-outside",
        slotIndex: 2,
        status: "completed",
        filename: "outside.png",
        relativePath: outsideRelativePath,
      },
    ],
  });

  const read = await store.readManifest("creation-set-unsafe-paths");

  assert.equal(read.status, "failed");
  assert.deepEqual(read.items.map((item) => item.status), ["failed", "failed"]);
  assert.deepEqual(read.items.map((item) => item.missingAsset), [true, true]);
  assert.deepEqual(read.items.map((item) => item.imageUrl), ["", ""]);

  await rm(rootDir, { recursive: true, force: true });
});

test("creation store preserves SKU subject metadata for repair reference binding", () => {
  const manifest = normalizeCreationSetManifest(
    {
      setId: "creation-set-sku",
      productName: "Jointed fishing lure",
      referenceImageNames: ["yellow-lure.png", "silver-lure.png", "package.png"],
      referenceImageRoles: [
        { filename: "yellow-lure.png", role: "product", note: "yellow SKU" },
        { filename: "silver-lure.png", role: "product", note: "silver SKU" },
        { filename: "package.png", role: "package", note: "retail package" },
      ],
      skuSubjects: [
        {
          id: "silver",
          title: "Silver lure",
          filenames: ["silver-lure.png"],
          referenceIndexes: [2],
          note: "preserve the silver finish and body segments",
          bundleCount: 3,
        },
      ],
      items: [
        {
          itemId: "13-sku-silver",
          slotIndex: 13,
          role: "sku",
          title: "SKU image 1",
          prompt: "Create one SKU product image for the distinct sellable subject: Silver lure.",
          skuSubject: {
            id: "silver",
            title: "Silver lure",
            filenames: ["silver-lure.png"],
            referenceIndexes: [2],
            note: "preserve the silver finish and body segments",
            bundleCount: 3,
          },
          status: "failed",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(manifest.items[0].skuSubject, manifest.skuSubjects[0]);
  assert.deepEqual(
    buildCreationItemReferenceImages(
      manifest.items[0],
      [
        { filename: "yellow-lure.png" },
        { filename: "silver-lure.png" },
        { filename: "package.png" },
      ],
      manifest.referenceImageRoles,
    ),
    [{ filename: "silver-lure.png" }],
  );
});

test("creation set store writes and lists manifests newest first", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "creation-store-"));
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const newHeroRelativePath = "2026-05/05-05/2026-05-05-creation/new/01-hero.png";

  await writeOutputFile(outputDir, newHeroRelativePath);

  await store.saveManifest({
    setId: "creation-set-old",
    productName: "旧商品",
    targetLanguage: "zh-CN",
    createdAt: "2026-05-04T10:00:00.000Z",
    status: "completed",
    items: [],
  });
  await store.saveManifest({
    setId: "creation-set-new",
    productName: "新商品",
    targetLanguage: "en",
    createdAt: "2026-05-05T10:00:00.000Z",
    status: "partial_failed",
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "主图",
        relativePath: newHeroRelativePath,
      },
    ],
  });

  const manifests = await store.listManifests();
  const raw = await readFile(store.manifestPath("creation-set-new"), "utf8");

  assert.deepEqual(
    manifests.map((manifest) => manifest.setId),
    ["creation-set-new", "creation-set-old"],
  );
  assert.equal(manifests[0].status, "partial_failed");
  assert.equal(manifests[0].items[0].thumbnailUrl, manifests[0].items[0].imageUrl);
  assert.match(raw, /"setId": "creation-set-new"/);
});

test("creation set store deletes distinct manifests with dedicated images and sidecars", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-store-delete-"));
  const outputDir = join(rootDir, "output");
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const deletedDir = "2026-07/07-22/2026-07-22-creation/delete-set";
  const keptDir = "2026-07/07-22/2026-07-22-creation/keep-set";
  const deletedImage = `${deletedDir}/01-hero.png`;
  const keptImage = `${keptDir}/01-hero.png`;
  const deletedMetadataDir = join(outputDir, "json", ...deletedDir.split("/"));

  await writeOutputFile(outputDir, deletedImage);
  await writeOutputFile(outputDir, keptImage);
  await mkdir(deletedMetadataDir, { recursive: true });
  await writeFile(join(deletedMetadataDir, "01-hero.json"), "{}\n");
  await store.saveManifest({ setId: "set-delete", relativeDir: deletedDir, items: [] });
  await store.saveManifest({ setId: "set-keep", relativeDir: keptDir, items: [] });

  const result = await store.deleteManifests(["set-delete", "set-delete", "set-missing"]);

  assert.deepEqual(result.deletedSetIds, ["set-delete"]);
  assert.deepEqual(result.notFoundSetIds, ["set-missing"]);
  assert.equal(await creationStorePathExists(store.manifestPath("set-delete")), false);
  assert.equal(await creationStorePathExists(join(outputDir, ...deletedDir.split("/"))), false);
  assert.equal(await creationStorePathExists(deletedMetadataDir), false);
  assert.equal(await creationStorePathExists(store.manifestPath("set-keep")), true);
  assert.equal(await creationStorePathExists(join(outputDir, ...keptDir.split("/"))), true);

  await rm(rootDir, { recursive: true, force: true });
});

test("creation set store requires exact IDs and never recursively deletes an unsafe relative directory", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "creation-store-delete-safety-"));
  const outputDir = join(rootDir, "output");
  const store = createCreationSetStore({ outputDir, publicBasePath: "/output" });
  const outsideDir = join(rootDir, "outside");
  await mkdir(outsideDir, { recursive: true });
  await writeFile(join(outsideDir, "keep.txt"), "keep");

  await store.saveManifest({ setId: "requestedid", relativeDir: "../outside", items: [] });
  const collisionResult = await store.deleteManifests(["requested/id"]);
  assert.deepEqual(collisionResult.deletedSetIds, []);
  assert.deepEqual(collisionResult.notFoundSetIds, ["requested/id"]);
  assert.equal(await creationStorePathExists(store.manifestPath("requestedid")), true);

  const unsafeResult = await store.deleteManifests(["requestedid"]);
  assert.deepEqual(unsafeResult.deletedSetIds, ["requestedid"]);
  assert.equal(await creationStorePathExists(store.manifestPath("requestedid")), false);
  assert.equal(await creationStorePathExists(join(outsideDir, "keep.txt")), true);
  assert.equal(unsafeResult.skippedUnsafePaths.length, 1);

  await rm(rootDir, { recursive: true, force: true });
});
