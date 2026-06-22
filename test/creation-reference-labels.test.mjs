import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreationItemReferenceImages,
  buildCreationReferenceImageLabels,
  buildCreationStyleReferenceImageLabels,
} from "../lib/creation-reference-labels.mjs";

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

test("creation style reference labels mark uploaded images as style-only", () => {
  const labels = buildCreationStyleReferenceImageLabels([
    { filename: "warm-lighting.png" },
    { filename: "paper-texture.png" },
  ]);

  assert.equal(labels.length, 2);
  assert.match(labels[0], /Creation style reference image 1 of 2: warm-lighting\.png\./);
  assert.match(labels[0], /Style reference files: 1\. warm-lighting\.png; 2\. paper-texture\.png\./);
  assert.match(labels[0], /Use this image only for style, lighting, color grading, background mood, material treatment, composition language, and overall atmosphere\./);
  assert.match(labels[0], /Do not copy the style reference subject, product identity, logo, text, packaging, or exact layout\./);
});

test("creation style reference labels are empty when no style references are attached", () => {
  assert.deepEqual(buildCreationStyleReferenceImageLabels([]), []);
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

test("creation infographic rebuild item reference images keep subject references plus only its source infographic", () => {
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
    ["blue-lure.png", "silver-anchor.png", "size-card.png"],
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

test("creation non-SKU item reference images keep the full uploaded set", () => {
  const item = {
    role: "hero",
  };
  const images = [
    { filename: "blue-lure.png" },
    { filename: "silver-lure.png" },
  ];

  assert.deepEqual(buildCreationItemReferenceImages(item, images), images);
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
    { filename: "lighting-style.png" },
  ]);
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
    ["reference-subject.png", "lighting-style.png"],
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
    ["lure-main.png", "lure-alt.png", "joint-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "after-sales" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "joint-detail.png", "campaign-style.png"],
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
    ["lure-main.png", "joint-detail.png", "lake-scene.png", "campaign-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "atmosphere" }, images, roles).map((image) => image.filename),
    ["lure-main.png", "lake-scene.png", "campaign-style.png"],
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
    ["lure-main.png", "lure-size-card.png", "joint-detail.png"],
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
    ["orange-reference-subject.png", "mesh-detail.png", "usage-guide.png", "lighting-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "spec-table" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "size-card.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "size-capacity-fit" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "size-card.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "usage-suggestion" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "trail-scene.png", "usage-guide.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "after-sales" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "usage-guide.png", "lighting-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "brand-story" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png", "trail-scene.png", "lighting-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "ingredient-material" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "series-showcase" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "blue-backpack.png", "black-backpack.png", "lighting-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "multi-angle" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "blue-backpack.png", "black-backpack.png", "mesh-detail.png", "lighting-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "atmosphere" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "trail-scene.png", "lighting-style.png"],
  );
  assert.deepEqual(
    buildCreationItemReferenceImages({ role: "product-detail" }, images, roles).map((image) => image.filename),
    ["orange-reference-subject.png", "mesh-detail.png"],
  );
});
