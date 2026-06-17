import test from "node:test";
import assert from "node:assert/strict";

import * as galleryOrganizer from "../lib/gallery-organizer.mjs";
import {
  buildGalleryReferenceFilterOptions,
  buildGallerySections,
  buildGallerySizeFilterOptions,
  buildGalleryTimeFilterOptions,
  distributeGalleryItemsIntoColumns,
  filterGalleryItems,
  filterGalleryItemsByWindow,
  getPromptGenerationGalleryItems,
  getGalleryColumnCountForWidth,
  getGalleryLayoutModeForWidth,
  getRecentGalleryItems,
  normalizeGalleryFilters,
  normalizeGalleryReferenceFilter,
  normalizeGalleryWindowFilter,
  sortGalleryItemsByCreatedAtDesc,
} from "../lib/gallery-organizer.mjs";

const referenceNow = new Date("2026-04-25T10:00:00.000Z");

const fixtures = [
  {
    filename: "today-b.jpeg",
    createdAt: "2026-04-25T08:00:00.000Z",
    prompt: "直播 护肤 礼盒 主视觉",
    size: "1024x1536",
    hasReferenceImage: true,
    referenceImageNames: ["skin-kit.png"],
  },
  {
    filename: "today-a.jpeg",
    createdAt: "2026-04-25T01:00:00.000Z",
    prompt: "直播 汉服 新品 预告",
    size: "1024x1536",
    hasReferenceImage: false,
    referenceImageNames: [],
  },
  {
    filename: "yesterday.jpeg",
    createdAt: "2026-04-24T12:00:00.000Z",
    prompt: "耳机 科技 蓝光",
    size: "1536x1024",
    hasReferenceImage: true,
    referenceImageNames: ["headphones.jpg"],
  },
  {
    filename: "week.jpeg",
    createdAt: "2026-04-21T12:00:00.000Z",
    prompt: "厨房 静物 构图",
    size: "1024x1024",
    hasReferenceImage: false,
    referenceImageNames: [],
  },
  {
    filename: "older.jpeg",
    createdAt: "2026-04-10T12:00:00.000Z",
    prompt: "护肤 详情页",
    size: "1024x1536",
    hasReferenceImage: false,
    referenceImageNames: [],
  },
];

test("gallery organizer sorts items by createdAt descending", () => {
  const sorted = sortGalleryItemsByCreatedAtDesc(fixtures);
  assert.deepEqual(sorted.map((item) => item.filename), [
    "today-b.jpeg",
    "today-a.jpeg",
    "yesterday.jpeg",
    "week.jpeg",
    "older.jpeg",
  ]);
});

test("gallery organizer distributes newest outputs left-to-right across columns", () => {
  const columns = distributeGalleryItemsIntoColumns(sortGalleryItemsByCreatedAtDesc(fixtures), 3);

  assert.deepEqual(
    columns.map((column) => column.map((item) => item.filename)),
    [
      ["today-b.jpeg", "week.jpeg"],
      ["today-a.jpeg", "older.jpeg"],
      ["yesterday.jpeg"],
    ],
  );
});

test("gallery organizer returns the four most recent outputs for the studio sidebar", () => {
  const recent = getRecentGalleryItems(fixtures);
  assert.deepEqual(recent.map((item) => item.filename), [
    "today-b.jpeg",
    "today-a.jpeg",
    "yesterday.jpeg",
    "week.jpeg",
  ]);
});

test("gallery organizer excludes quick blend outputs from prompt generation thumbnails", () => {
  const mixedItems = [
    {
      filename: "quick-latest.png",
      createdAt: "2026-04-25T09:00:00.000Z",
      prompt: "quick blend",
      generationMode: "quick-blend",
      assetKind: "quick-blend",
    },
    {
      filename: "prompt-latest.png",
      createdAt: "2026-04-25T08:00:00.000Z",
      prompt: "prompt latest",
    },
    {
      filename: "style-transfer.png",
      createdAt: "2026-04-25T07:00:00.000Z",
      prompt: "style transfer",
      generationMode: "style-transfer",
    },
    {
      filename: "prompt-older.png",
      createdAt: "2026-04-25T06:00:00.000Z",
      prompt: "prompt older",
      assetKind: "prompt",
    },
  ];

  const promptItems = getPromptGenerationGalleryItems(mixedItems);

  assert.deepEqual(promptItems.map((item) => item.filename), ["prompt-latest.png", "prompt-older.png"]);
});

test("gallery organizer derives gallery-only responsive layout modes", () => {
  assert.equal(getGalleryLayoutModeForWidth(680), "mobile");
  assert.equal(getGalleryLayoutModeForWidth(920), "tablet");
  assert.equal(getGalleryLayoutModeForWidth(1280), "desktop");
});

test("gallery organizer increases masonry density as the gallery widens", () => {
  assert.equal(getGalleryColumnCountForWidth(0), 1);
  assert.equal(getGalleryColumnCountForWidth(420), 1);
  assert.equal(getGalleryColumnCountForWidth(560), 2);
  assert.equal(getGalleryColumnCountForWidth(960), 3);
  assert.equal(getGalleryColumnCountForWidth(1280), 4);
  assert.equal(getGalleryColumnCountForWidth(1520), 5);
  assert.equal(getGalleryColumnCountForWidth(1750), 6);
});

test("gallery organizer builds stable time filter options", () => {
  const options = buildGalleryTimeFilterOptions(fixtures, referenceNow);
  assert.deepEqual(options, [
    { value: "all", label: "全部", count: 5 },
    { value: "today", label: "今天", count: 2 },
    { value: "recent", label: "近 7 天", count: 4 },
    { value: "older", label: "更早", count: 1 },
  ]);
});

test("gallery organizer builds size filter options from known outputs", () => {
  const options = buildGallerySizeFilterOptions(fixtures);

  assert.deepEqual(options, [
    { value: "all", label: "全部尺寸", count: 5 },
    { value: "1024x1536", label: "1024 × 1536", count: 3 },
    { value: "1536x1024", label: "1536 × 1024", count: 1 },
    { value: "1024x1024", label: "1024 × 1024", count: 1 },
  ]);
});

test("gallery organizer builds reference filter options", () => {
  const options = buildGalleryReferenceFilterOptions(fixtures);

  assert.deepEqual(options, [
    { value: "all", label: "全部来源", count: 5 },
    { value: "with-reference", label: "带参考图", count: 2 },
    { value: "without-reference", label: "无参考图", count: 3 },
  ]);
});

test("gallery organizer filters items by selected time window", () => {
  assert.deepEqual(
    filterGalleryItemsByWindow(fixtures, "today", referenceNow).map((item) => item.filename),
    ["today-b.jpeg", "today-a.jpeg"],
  );
  assert.deepEqual(
    filterGalleryItemsByWindow(fixtures, "recent", referenceNow).map((item) => item.filename),
    ["today-b.jpeg", "today-a.jpeg", "yesterday.jpeg", "week.jpeg"],
  );
  assert.deepEqual(
    filterGalleryItemsByWindow(fixtures, "older", referenceNow).map((item) => item.filename),
    ["older.jpeg"],
  );
});

test("gallery organizer normalizes invalid filter values back to all", () => {
  assert.equal(normalizeGalleryWindowFilter("today"), "today");
  assert.equal(normalizeGalleryWindowFilter("something-else"), "all");
  assert.equal(normalizeGalleryReferenceFilter("with-reference"), "with-reference");
  assert.equal(normalizeGalleryReferenceFilter("unknown"), "all");
});

test("gallery organizer normalizes compound filter state", () => {
  assert.deepEqual(
    normalizeGalleryFilters(
      {
        query: "  直播   礼盒  ",
        window: "something-else",
        date: "2026-99-99",
        size: "404x404",
        reference: "nope",
      },
      fixtures,
    ),
    {
      query: "直播 礼盒",
      window: "all",
      date: "",
      size: "all",
      reference: "all",
    },
  );
});

test("gallery organizer filters by keyword, date, size, and reference source", () => {
  const items = filterGalleryItems(
    fixtures,
    {
      query: "直播 礼盒",
      date: "2026-04-25",
      size: "1024x1536",
      reference: "with-reference",
    },
    referenceNow,
  );

  assert.deepEqual(items.map((item) => item.filename), ["today-b.jpeg"]);
});

test("gallery organizer groups visible items into dated sections", () => {
  const sections = buildGallerySections(
    filterGalleryItemsByWindow(fixtures, "recent", referenceNow),
    referenceNow,
  );

  assert.equal(sections.length, 3);
  assert.deepEqual(
    sections.map((section) => ({
      key: section.key,
      label: section.label,
      dateText: section.dateText,
      count: section.count,
      filenames: section.items.map((item) => item.filename),
    })),
    [
      {
        key: "2026-04-25",
        label: "今天",
        dateText: "2026-04-25",
        count: 2,
        filenames: ["today-b.jpeg", "today-a.jpeg"],
      },
      {
        key: "2026-04-24",
        label: "昨天",
        dateText: "2026-04-24",
        count: 1,
        filenames: ["yesterday.jpeg"],
      },
      {
        key: "2026-04-21",
        label: "2026-04-21",
        dateText: "2026-04-21",
        count: 1,
        filenames: ["week.jpeg"],
      },
    ],
  );
});

test("gallery organizer paginates waterfall history by five dated sections", () => {
  assert.equal(typeof galleryOrganizer.paginateGallerySections, "function");

  const datedFixtures = Array.from({ length: 7 }, (_, index) => {
    const day = 25 - index;
    return {
      filename: `history-${day}.jpeg`,
      createdAt: `2026-04-${String(day).padStart(2, "0")}T08:00:00.000Z`,
      prompt: `历史记录 ${day}`,
    };
  });
  const sections = buildGallerySections(datedFixtures, referenceNow);

  const firstPage = galleryOrganizer.paginateGallerySections(sections, 0);
  assert.equal(firstPage.page, 0);
  assert.equal(firstPage.pageSize, 5);
  assert.equal(firstPage.totalPages, 2);
  assert.equal(firstPage.hasPrevious, false);
  assert.equal(firstPage.hasNext, true);
  assert.deepEqual(
    firstPage.sections.map((section) => section.key),
    ["2026-04-25", "2026-04-24", "2026-04-23", "2026-04-22", "2026-04-21"],
  );

  const secondPage = galleryOrganizer.paginateGallerySections(sections, 1);
  assert.equal(secondPage.page, 1);
  assert.equal(secondPage.hasPrevious, true);
  assert.equal(secondPage.hasNext, false);
  assert.deepEqual(
    secondPage.sections.map((section) => section.key),
    ["2026-04-20", "2026-04-19"],
  );
});
