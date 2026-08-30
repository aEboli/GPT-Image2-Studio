import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreationGenerationReferenceImageLabels,
  buildCreationItemReferenceImages,
  buildCreationReferenceImageLabels,
  MAX_CREATION_ITEM_REFERENCE_BYTES,
  MAX_CREATION_ITEM_REFERENCE_IMAGES,
} from "../lib/creation-reference-labels.mjs";
import { normalizeCreationCoverageFields } from "../lib/creation-reference-coverage.mjs";

test("creation reference labels state uploaded count, file list, image order, and roles", () => {
  const labels = buildCreationReferenceImageLabels(
    [
      { filename: "F2J32257.png" },
      { filename: "F2J32258.png" },
      { filename: "F2J32259.png" },
      { filename: "F2J32260.png" },
    ],
    [
      {
        filename: "F2J32258.png",
        rolePromptLabel: "style reference",
        promptInstruction: "Use this for color and lighting.",
      },
      {
        filename: "F2J32257.png",
        rolePromptLabel: "product subject",
        promptInstruction: "Preserve shape and hardware.",
      },
    ],
  );

  assert.equal(labels.length, 4);
  assert.match(labels[0], /Creation reference image 1 of 4: F2J32257\.png\./);
  assert.match(labels[0], /Uploaded reference count: 4\./);
  assert.match(
    labels[0],
    /Uploaded reference files: 1\. F2J32257\.png; 2\. F2J32258\.png; 3\. F2J32259\.png; 4\. F2J32260\.png\./,
  );
  assert.match(labels[0], /Role: product subject\. Preserve shape and hardware\./);
  assert.match(labels[0], /Product identity authority/);
  assert.match(labels[1], /Creation reference image 2 of 4: F2J32258\.png\./);
  assert.match(labels[1], /Role: style reference\. Use this for color and lighting\./);
  assert.match(labels[1], /Supporting-only reference/);
});

test("creation reference labels are empty when no images are attached", () => {
  assert.deepEqual(buildCreationReferenceImageLabels([], []), []);
});

test("creation SKU item reference images only include the matching subject files", () => {
  const item = {
    role: "sku",
    skuSubject: {
      filenames: ["silver-lure.png"],
    },
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "package.png" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images), [
    { filename: "silver-lure.png" },
  ]);
});

test("creation infographic rebuild item reference images keep only its source infographic", () => {
  const item = {
    role: "infographic-rebuild",
    sourceInfographic: {
      filename: "size-card.png",
      role: "dimensions",
    },
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-anchor.png" },
    { filename: "package-list.png" },
    { filename: "size-card.png" },
    { filename: "usage-guide.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-anchor.png", role: "reference-product" },
    { filename: "package-list.png", role: "package" },
    { filename: "size-card.png", role: "dimensions" },
    { filename: "usage-guide.png", role: "usage" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages(item, images, roles).map((image) => image.filename),
    ["size-card.png"],
  );
});

test("creation infographic rebuild resolves compressed source renames by stable reference index", () => {
  const item = {
    role: "infographic-rebuild",
    sourceInfographic: {
      filename: "original-size-card.png",
      index: 2,
    },
  };
  const images = [
    { filename: "compressed-product.webp" },
    { filename: "compressed-size-card.webp" },
    { filename: "compressed-package-card.webp" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images).map((image) => image.filename), [
    "compressed-size-card.webp",
  ]);
});

test("creation infographic rebuild prefers stable source index when filenames repeat", () => {
  const item = {
    role: "infographic-rebuild",
    sourceInfographic: {
      filename: "same-name.png",
      index: 2,
    },
  };
  const images = [
    { filename: "same-name.png", referenceIndex: 1, marker: "wrong" },
    { filename: "same-name.png", referenceIndex: 2, marker: "source" },
  ];

  assert.equal(buildCreationItemReferenceImages(item, images)[0].marker, "source");
});

test("creation infographic rebuild accepts historical itemKind-only records", () => {
  const item = {
    itemKind: "infographic-rebuild",
    sourceInfographic: { filename: "source-card.png", index: 2 },
  };
  const images = [
    { filename: "product-reference.jpg" },
    { filename: "source-card-reference.jpg" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images), [images[1]]);
});

test("creation infographic rebuild fails closed when its source image is missing", () => {
  assert.throws(
    () => buildCreationItemReferenceImages(
      {
        role: "infographic-rebuild",
        sourceInfographic: { filename: "missing-source.png", index: 4 },
      },
      [
        { filename: "product.png" },
        { filename: "other-infographic.png" },
      ],
    ),
    /信息图重构源图缺失.*missing-source\.png/,
  );
});

test("creation infographic rebuild adds no reference labels", () => {
  const item = { role: "infographic-rebuild", logoPolicy: "allow-supplied" };
  const sourceImages = [{ filename: "source-infographic.png" }];

  assert.deepEqual(
    buildCreationGenerationReferenceImageLabels(
      sourceImages,
      [{ filename: "source-infographic.png", role: "dimensions", note: "OTHER_NOTE_SENTINEL" }],
      item,
    ),
    [],
  );
});

test("creation SKU item reference images keep package-list content text-only and include dimension references", () => {
  const item = {
    role: "sku",
    skuSubject: {
      filenames: ["silver-lure.png"],
    },
    skuSupportingReferenceRoles: ["package", "dimensions"],
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "package-list.png" },
    { filename: "size-card.png" },
    { filename: "lifestyle.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-lure.png", role: "product" },
    { filename: "package-list.png", role: "package" },
    { filename: "size-card.png", role: "dimensions" },
    { filename: "lifestyle.png", role: "scene" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages(item, images, roles).map((image) => image.filename),
    ["silver-lure.png", "size-card.png"],
  );
});

test("creation non-SKU item reference images fall back to the subject anchor without role metadata", () => {
  const item = {
    role: "hero",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images), [images[0]]);
});

test("creation hero item reference images keep the primary product instead of every product variant", () => {
  const item = {
    role: "hero",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "package.png" },
    { filename: "lighting-style.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-lure.png", role: "product" },
    { filename: "package.png", role: "package" },
    { filename: "lighting-style.png", role: "style" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images, roles), [
    { filename: "blue-lure.png" },
  ]);
});

test("creation legacy style roles cannot shift onto a product image by array position", () => {
  const images = [
    { filename: "legacy-style.png" },
    { filename: "product.png" },
  ];
  const roles = [
    { filename: "product.png", role: "product" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "hero" }, images, roles).map((image) => image.filename),
    ["product.png"],
  );
});

test("creation hero item reference images prefer the selected reference subject", () => {
  const images = [
    { filename: "ordinary-product.png" },
    { filename: "reference-subject.png" },
    { filename: "lighting-style.png" },
  ];
  const roles = [
    { filename: "ordinary-product.png", role: "product" },
    { filename: "reference-subject.png", role: "reference-product" },
    { filename: "lighting-style.png", role: "style" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "hero" }, images, roles).map((image) => image.filename),
    ["reference-subject.png"],
  );

  const labels = buildCreationReferenceImageLabels(images, [
    {
      filename: "reference-subject.png",
      role: "reference-product",
      rolePromptLabel: "reference subject",
      promptInstruction: "Use this as the subject anchor.",
    },
  ]);
  assert.match(labels[1], /Product identity authority/);
});

test("creation material item reference images keep primary product plus material details", () => {
  const item = {
    role: "product-detail",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "scale-detail.png" },
    { filename: "package.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-lure.png", role: "product" },
    { filename: "scale-detail.png", role: "material" },
    { filename: "package.png", role: "package" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images, roles), [
    { filename: "blue-lure.png" },
    { filename: "scale-detail.png" },
  ]);
});

test("creation item reference images prefer explicit coverage sources plus the primary product", () => {
  const item = {
    role: "product-detail",
    coverageSources: [
      {
        filename: "scale-detail.png",
        role: "material",
        note: "macro scale texture",
      },
    ],
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
    { filename: "scale-detail.png" },
    { filename: "package.png" },
    { filename: "lighting-style.png" },
  ];
  const roles = [
    { filename: "blue-lure.png", role: "product" },
    { filename: "silver-lure.png", role: "reference-product" },
    { filename: "scale-detail.png", role: "material" },
    { filename: "package.png", role: "package" },
    { filename: "lighting-style.png", role: "style" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages(item, images, roles).map((image) => image.filename),
    ["silver-lure.png", "scale-detail.png"],
  );
});

test("creation usage-step item reference images keep usage instruction references", () => {
  const item = {
    role: "usage-suggestion",
  };
  const images = [
    { filename: "lure-main.png" },
    { filename: "charging-guide.png" },
    { filename: "campaign-style.png" },
  ];
  const roles = [
    { filename: "lure-main.png", role: "product" },
    { filename: "charging-guide.png", role: "usage" },
    { filename: "campaign-style.png", role: "style" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages(item, images, roles).map((image) => image.filename),
    ["lure-main.png", "charging-guide.png"],
  );
});

test("creation package references stay scoped to the package image role", () => {
  const images = [
    { filename: "lure-main.png" },
    { filename: "lure-alt.png" },
    { filename: "package-info.png" },
    { filename: "joint-detail.png" },
    { filename: "lake-scene.png" },
    { filename: "campaign-style.png" },
  ];
  const roles = [
    { filename: "lure-main.png", role: "product" },
    { filename: "lure-alt.png", role: "product" },
    { filename: "package-info.png", role: "package" },
    { filename: "joint-detail.png", role: "material" },
    { filename: "lake-scene.png", role: "scene" },
    { filename: "campaign-style.png", role: "style" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "product-detail" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "effect-comparison" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "after-sales" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "ingredient-material" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "package-info.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "accessory-gift" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "package-info.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "brand-story" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png", "lake-scene.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "atmosphere" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "lake-scene.png"],
  );
});

test("creation dimensions item keeps the dimensions reference image", () => {
  const images = [
    { filename: "lure-main.png" },
    { filename: "lure-size-card.png" },
    { filename: "joint-detail.png" },
  ];
  const roles = [
    { filename: "lure-main.png", role: "product" },
    { filename: "lure-size-card.png", role: "dimensions" },
    { filename: "joint-detail.png", role: "material" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "size-capacity-fit" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "lure-size-card.png"],
  );
});

test("creation expanded suite roles keep the selected reference subject as the subject anchor", () => {
  const images = [
    { filename: "blue-backpack.png" },
    { filename: "black-backpack.png" },
    { filename: "orange-reference-subject.png" },
    { filename: "mesh-detail.png" },
    { filename: "trail-scene.png" },
    { filename: "size-card.png" },
    { filename: "usage-guide.png" },
    { filename: "lighting-style.png" },
  ];
  const roles = [
    { filename: "blue-backpack.png", role: "product" },
    { filename: "black-backpack.png", role: "product" },
    { filename: "orange-reference-subject.png", role: "reference-product" },
    { filename: "mesh-detail.png", role: "material" },
    { filename: "trail-scene.png", role: "scene" },
    { filename: "size-card.png", role: "dimensions" },
    { filename: "usage-guide.png", role: "usage" },
    { filename: "lighting-style.png", role: "style" },
  ];

  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "craft-process" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "usage-guide.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "spec-table" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "size-card.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "size-capacity-fit" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "size-card.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "usage-suggestion" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "trail-scene.png", "usage-guide.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "after-sales" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "usage-guide.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "brand-story" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "trail-scene.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "ingredient-material" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "series-showcase" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "blue-backpack.png", "black-backpack.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "multi-angle" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "atmosphere" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "trail-scene.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "product-detail" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png"],
  );
});

test("creation reference scheduling admits several relevant small references without a per-role cap", () => {
  const images = [
    { filename: "product.png", byteLength: 400_000 },
    { filename: "detail-front.png", byteLength: 300_000 },
    { filename: "detail-side.png", byteLength: 300_000 },
    { filename: "detail-closeup.png", byteLength: 300_000 },
    { filename: "scene.png", byteLength: 300_000 },
  ];
  const roles = [
    { filename: "product.png", role: "product" },
    { filename: "detail-front.png", role: "material" },
    { filename: "detail-side.png", role: "material" },
    { filename: "detail-closeup.png", role: "material" },
    { filename: "scene.png", role: "scene" },
  ];

  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  assert.equal(selected.length, 4);
  assert.deepEqual(selected.map((image) => image.filename), [
    "product.png",
    "detail-front.png",
    "detail-side.png",
    "detail-closeup.png",
  ]);
  assert.ok(selected.length > 3);
  assert.ok(selected.length <= MAX_CREATION_ITEM_REFERENCE_IMAGES);
});

test("creation reference scheduling keeps distinct uploads with the same filename", () => {
  const images = [
    { filename: "product.png", byteLength: 400_000 },
    { filename: "detail.png", byteLength: 300_000, view: "front" },
    { filename: "detail.png", byteLength: 300_000, view: "back" },
  ];
  const roles = [
    { filename: "product.png", role: "product" },
    { index: 2, role: "material" },
    { index: 3, role: "material" },
  ];

  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  assert.equal(selected.length, 3);
  assert.equal(selected[1], images[1]);
  assert.equal(selected[2], images[2]);
});

test("creation reference scheduling honors indexed roles for distinct uploads with the same filename", () => {
  const images = [
    { filename: "product.png", byteLength: 400_000 },
    { filename: "reference.png", byteLength: 300_000, view: "material" },
    { filename: "reference.png", byteLength: 300_000, view: "scene" },
  ];
  const roles = [
    { filename: "product.png", index: 1, role: "product" },
    { filename: "reference.png", index: 2, role: "material" },
    { filename: "reference.png", index: 3, role: "scene" },
  ];

  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  assert.deepEqual(selected, [images[0], images[1]]);
});

test("creation reference labels retain each selected image role after the scheduler removes other uploads", () => {
  const images = [
    { filename: "product.png" },
    { filename: "package.png" },
    { filename: "detail.png" },
  ];
  const roles = [
    { filename: "product.png", index: 1, role: "product", rolePromptLabel: "product subject" },
    { filename: "package.png", index: 2, role: "package", rolePromptLabel: "package details" },
    { filename: "detail.png", index: 3, role: "material", rolePromptLabel: "material detail" },
  ];
  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  const labels = buildCreationReferenceImageLabels(selected, roles);

  assert.equal(selected.length, 2);
  assert.match(labels[1], /Role: material detail\./);
  assert.doesNotMatch(labels[1], /package details/);
});

test("creation reference labels keep roles after compression renames and subset reordering", () => {
  const selected = [
    { filename: "anchor-reference.jpg", referenceIndex: 2 },
    { filename: "detail-reference.jpg", referenceIndex: 3 },
  ];
  const roles = [
    { index: 1, filename: "unrelated.png", role: "scene" },
    { index: 2, filename: "anchor.png", role: "reference-product", rolePromptLabel: "reference subject" },
    { index: 3, filename: "detail.png", role: "material", rolePromptLabel: "material detail" },
  ];

  const labels = buildCreationReferenceImageLabels(selected, roles);
  assert.match(labels[0], /Role: reference subject\./);
  assert.match(labels[0], /Primary subject anchor:/);
  assert.match(labels[1], /Role: material detail\./);
  assert.match(labels[1], /supporting reference after the primary subject anchor/i);
  assert.doesNotMatch(labels[0], /Role: scene\./);
  assert.doesNotMatch(labels[1], /Role: reference subject\./);
});

test("creation reference labels do not promote a later product view to another identity authority", () => {
  const labels = buildCreationReferenceImageLabels(
    [
      { filename: "anchor-reference.jpg", referenceIndex: 2 },
      { filename: "alternate-reference.jpg", referenceIndex: 3 },
    ],
    [
      { index: 2, filename: "anchor.png", role: "reference-product", rolePromptLabel: "reference subject" },
      { index: 3, filename: "alternate.png", role: "product", rolePromptLabel: "product subject" },
    ],
  );

  assert.match(labels[0], /Product identity authority:/);
  assert.match(labels[1], /Supporting product reference:/);
  assert.doesNotMatch(labels[1], /Product identity authority:/);
});

test("creation reference scheduling uses stable indexes for reordered coverage and SKU sources", () => {
  const images = [
    { filename: "anchor-reference.jpg", referenceIndex: 2 },
    { filename: "detail-reference.jpg", referenceIndex: 3 },
  ];
  const roles = [
    { index: 1, filename: "discarded-scene.png", role: "scene" },
    { index: 2, filename: "anchor.png", role: "reference-product" },
    { index: 3, filename: "detail.png", role: "material" },
  ];

  const coverageSelection = buildCreationItemReferenceImages(
    {
      role: "scene",
      coverageSources: [{ index: 3, filename: "detail.png", role: "material" }],
    },
    images,
    roles,
  );
  const skuSelection = buildCreationItemReferenceImages(
    {
      role: "sku",
      skuSubject: { referenceIndexes: [2], filenames: ["anchor.png"] },
      skuSupportingReferenceRoles: ["material"],
    },
    images,
    roles,
  );

  assert.deepEqual(coverageSelection, images);
  assert.deepEqual(skuSelection, images);
});

test("creation coverage normalization retains reference indexes from browser payloads", () => {
  const normalized = normalizeCreationCoverageFields({
    coverageSources: [
      {
        reference_index: 3,
        filename: "detail.png",
        role: "material",
        note: "Preserve the material detail.",
      },
    ],
  });

  assert.deepEqual(normalized.coverageSources, [
    {
      index: 3,
      filename: "detail.png",
      role: "material",
      roleLabel: "",
      rolePromptLabel: "",
      note: "Preserve the material detail.",
    },
  ]);
});

test("creation reference scheduling enforces the eight-image hard cap", () => {
  const images = [
    { filename: "product.png", byteLength: 200_000 },
    ...Array.from({ length: 14 }, (_, index) => ({
      filename: `detail-${index + 1}.png`,
      byteLength: 200_000,
    })),
  ];
  const roles = images.map((image, index) => ({
    filename: image.filename,
    role: index === 0 ? "product" : "material",
  }));

  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  assert.equal(selected.length, MAX_CREATION_ITEM_REFERENCE_IMAGES);
  assert.deepEqual(selected.map((image) => image.filename), images.slice(0, MAX_CREATION_ITEM_REFERENCE_IMAGES).map((image) => image.filename));
});

test("creation reference scheduling stops on the shared byte budget while keeping the anchor", () => {
  const images = [
    { filename: "product.png", byteLength: 1_000_000 },
    { filename: "detail-1.png", byteLength: 2_000_000 },
    { filename: "detail-2.png", byteLength: 2_000_000 },
    { filename: "detail-3.png", byteLength: 2_000_000 },
  ];
  const roles = images.map((image, index) => ({
    filename: image.filename,
    role: index === 0 ? "product" : "material",
  }));

  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  assert.deepEqual(selected.map((image) => image.filename), ["product.png", "detail-1.png", "detail-2.png"]);
  assert.ok(selected.reduce((total, image) => total + image.byteLength, 0) <= MAX_CREATION_ITEM_REFERENCE_BYTES);
  assert.notEqual(selected.length, images.length);
});

test("creation reference scheduling keeps an oversized subject anchor", () => {
  const images = [
    { filename: "product.png", byteLength: MAX_CREATION_ITEM_REFERENCE_BYTES + 1 },
    { filename: "detail.png", byteLength: 200_000 },
  ];
  const roles = [
    { filename: "product.png", role: "product" },
    { filename: "detail.png", role: "material" },
  ];

  const selected = buildCreationItemReferenceImages({ role: "product-detail" }, images, roles);
  assert.deepEqual(selected, [images[0]]);
});

// 浏览器端主体锚点的压缩上限必须为支撑候选留出剩余字节额度。若两者相等，一张压到上限的主体图
// 会独占整项预算，使 coverage 来源和支撑参考图全部被字节检查跳过，等于静默关闭智能调度。
test("a primary subject compressed to the browser ceiling still leaves room for supporting references", () => {
  const browserPrimarySubjectMaxBytes = 3 * 1024 * 1024;
  assert.ok(browserPrimarySubjectMaxBytes < MAX_CREATION_ITEM_REFERENCE_BYTES);

  const images = [
    { filename: "product.png", byteLength: browserPrimarySubjectMaxBytes },
    { filename: "size-card.png", byteLength: 400_000 },
    { filename: "detail.png", byteLength: 400_000 },
  ];
  const roles = [
    { filename: "product.png", role: "product" },
    { filename: "size-card.png", role: "dimensions" },
    { filename: "detail.png", role: "material" },
  ];
  const item = {
    role: "effect-comparison",
    coverageSources: [{ filename: "size-card.png", role: "dimensions" }],
  };

  const selected = buildCreationItemReferenceImages(item, images, roles);
  assert.deepEqual(selected.map((image) => image.filename), ["product.png", "size-card.png", "detail.png"]);
  assert.ok(
    selected.reduce((total, image) => total + image.byteLength, 0) <= MAX_CREATION_ITEM_REFERENCE_BYTES,
  );
});

test("coverage metadata that does not match an uploaded file never falls back to all references", () => {
  const images = [
    { filename: "product.png" },
    { filename: "unrelated-detail.png" },
    { filename: "unrelated-scene.png" },
  ];
  const roles = [
    { filename: "product.png", role: "product" },
    { filename: "unrelated-detail.png", role: "material" },
    { filename: "unrelated-scene.png", role: "scene" },
  ];

  const selected = buildCreationItemReferenceImages(
    {
      role: "size-capacity-fit",
      coverageSources: [{ filename: "missing-size-card.png", role: "dimensions" }],
    },
    images,
    roles,
  );
  assert.deepEqual(selected.map((image) => image.filename), ["product.png"]);
});
