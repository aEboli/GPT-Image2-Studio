import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationListingSources,
  getCreationListingDimensionFieldErrors,
  getCreationListingWeightEvidence,
  validateCreationListingDraft,
} from "../lib/creation-listing-draft.mjs";
import {
  CREATION_LISTING_JSON_SCHEMA,
  generateCreationListingDrafts,
  hydrateCreationListingDimensionsForRead,
  makeMockCreationListingDraft,
  requestCreationListingDraft,
} from "../lib/creation-listing-agent.mjs";

function makeValidDraft(overrides = {}) {
  const { zhDisplay: zhOverrides = {}, ...englishOverrides } = overrides;
  return {
    title: "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait",
    sellingPoints: ["Bright blue profile with a stated two-pack quantity."],
    painPoints: ["Review the stated color variant and pack quantity before purchase."],
    fiveBullets: [
      "PRODUCT TYPE: Blue fishing lure.",
      "PACK DETAILS: Two supplied product units.",
      "VISIBLE DETAILS: Blue profile and stated variant name.",
      "SPECIFICATIONS: Review the stated size and pack information.",
      "PACKAGE CONTENTS: Two fishing lure product units.",
    ],
    description: "Blue fishing lure option for US marketplace shoppers.",
    backendSearchTerms: "blue fishing lure bass bait compact lure",
    keywordBuckets: {
      exact: ["blue fishing lure"],
      longTail: ["bass fishing lure", "freshwater swimbait"],
      traffic: ["freshwater bait"],
      descriptive: ["compact blue lure"],
    },
    packageDimensions: "Estimated: 6 x 4 x 2 in (15.2 x 10.2 x 5.1 cm)",
    productDimensions: "3.5 in (8.9 cm) long",
    packageWeight: "Estimated: 350 g (12.35 oz)",
    productWeight: "Estimated: 250 g (8.82 oz)",
    missingInfo: [],
    warnings: [],
    ...englishOverrides,
    zhDisplay: {
      packageDimensions: "预估：15.2 x 10.2 x 5.1 厘米（6 x 4 x 2 英寸）",
      productDimensions: "长度 8.9 厘米（3.5 英寸）",
      packageWeight: "预估：350 克（12.35 盎司）",
      productWeight: "预估：250 克（8.82 盎司）",
      ...zhOverrides,
    },
  };
}

function makeValidPlatformV1Draft(overrides = {}) {
  const { zhDisplay: zhOverrides = {}, ...englishOverrides } = overrides;
  return {
    ...makeValidDraft(englishOverrides),
    zhDisplay: {
      title: "2 件装蓝色路亚鱼饵",
      sellingPoints: ["蓝色鱼饵主体，包装数量为两件。"],
      painPoints: ["购买前请核对颜色款式和包装数量。"],
      fiveBullets: ["产品类型：蓝色路亚鱼饵。"],
      description: "面向美国市场的蓝色路亚鱼饵。",
      backendSearchTerms: "蓝色 路亚 鱼饵",
      keywordBuckets: {
        exact: ["蓝色路亚鱼饵"],
        longTail: ["淡水路亚鱼饵"],
        traffic: ["淡水鱼饵"],
        descriptive: ["紧凑蓝色鱼饵"],
      },
      packageDimensions: "预估：15.2 x 10.2 x 5.1 厘米（6 x 4 x 2 英寸）",
      productDimensions: "长度 8.9 厘米（3.5 英寸）",
      packageWeight: "预估：350 克（12.35 盎司）",
      productWeight: "预估：250 克（8.82 盎司）",
      ...zhOverrides,
    },
  };
}

function visibleDraftText(draft) {
  return [
    draft.title,
    ...(draft.sellingPoints || []),
    ...(draft.painPoints || []),
    ...(draft.fiveBullets || []),
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets || {}).flat(),
    draft.packageDimensions,
    draft.productDimensions,
    draft.packageWeight,
    draft.productWeight,
  ].join("\n");
}

function visibleChineseDisplayText(draft) {
  return [
    draft.zhDisplay?.title,
    ...(draft.zhDisplay?.sellingPoints || []),
    ...(draft.zhDisplay?.painPoints || []),
    ...(draft.zhDisplay?.fiveBullets || []),
    draft.zhDisplay?.description,
    draft.zhDisplay?.backendSearchTerms,
    ...Object.values(draft.zhDisplay?.keywordBuckets || {}).flat(),
    draft.zhDisplay?.packageDimensions,
    draft.zhDisplay?.productDimensions,
    draft.zhDisplay?.packageWeight,
    draft.zhDisplay?.productWeight,
  ].join("\n");
}

function validateListingAgentDraft(draft, expectedQuantity) {
  return validateCreationListingDraft(draft, {
    expectedQuantity,
    forbidTitleSpecs: true,
  });
}

const standardSource = {
  setId: "set-1",
  productName: "Fishing Lure",
  skuTitle: "Blue Lure",
  skuBundleCount: 2,
  dimensionSpecs: "3.5 in",
  evidenceMode: "input-only",
};

function collectSchemaKeys(value, keys = []) {
  if (!value || typeof value !== "object") {
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectSchemaKeys(nested, keys);
  }
  return keys;
}

test("strict listing schema leaves character limits to prompt and validation", () => {
  assert.equal(collectSchemaKeys(CREATION_LISTING_JSON_SCHEMA).includes("maxLength"), false);
});

test("strict listing schema marks every top-level property as required", () => {
  assert.deepEqual(
    [...CREATION_LISTING_JSON_SCHEMA.required].sort(),
    Object.keys(CREATION_LISTING_JSON_SCHEMA.properties).sort(),
  );
  assert.ok(CREATION_LISTING_JSON_SCHEMA.required.includes("packageDimensions"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.required.includes("productDimensions"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.required.includes("packageWeight"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.required.includes("productWeight"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.properties.zhDisplay.required.includes("packageDimensions"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.properties.zhDisplay.required.includes("productDimensions"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.properties.zhDisplay.required.includes("packageWeight"));
  assert.ok(CREATION_LISTING_JSON_SCHEMA.properties.zhDisplay.required.includes("productWeight"));
});

test("listing sources separate product and package dimension evidence", () => {
  const [source] = buildCreationListingSources({
    setId: "set-dimension-evidence",
    productName: "Door Latch",
    productDescription: "Package dimensions: 22 x 6 x 3 cm.",
    dimensionSpecs: "Main body 194 mm x 35 mm; keeper 46 mm x 34 mm",
    dimensionUnitMode: "both",
  });

  assert.match(source.productDimensionEvidence, /194\s*mm.*35\s*mm/iu);
  assert.match(source.packageDimensionEvidence, /Package dimensions: 22 x 6 x 3 cm/iu);

  const [missingSource] = buildCreationListingSources({
    setId: "set-dimension-evidence-missing",
    productName: "Door Latch",
    dimensionSpecs: "Weight 120 g",
  });
  assert.equal(missingSource.productDimensionEvidence, "");
  assert.equal(missingSource.packageDimensionEvidence, "");

  const [negatedPackageSource] = buildCreationListingSources({
    setId: "set-negated-package-dimension",
    productName: "Storage Box",
    productDescription: "Package dimensions not provided. Product dimensions: 20 x 10 x 5 cm.",
  });
  assert.equal(negatedPackageSource.packageDimensionEvidence, "");
  assert.match(negatedPackageSource.productDimensionEvidence, /20\s*x\s*10\s*x\s*5\s*cm/iu);

  const [visiblePackageSource] = buildCreationListingSources({
    setId: "set-visible-package-dimension",
    productName: "Electric Minnow Fishing Lure",
    productDescription: "Transparent storage case and charging cable.",
    dimensionSpecs: "Length 10 cm",
    dimensionUnitMode: "both",
    referenceImageRoles: [{ note: "包装盒可见尺寸12.2厘米×6.5厘米" }],
  });
  assert.match(visiblePackageSource.packageDimensionEvidence, /12\.2厘米×6\.5厘米/u);
  assert.doesNotMatch(visiblePackageSource.packageDimensionEvidence, /0\.79\s*in/iu);
});

test("listing sources separate gross and net weight evidence without using package dimension labels", () => {
  const [source] = buildCreationListingSources({
    setId: "set-weight-evidence",
    productName: "Door Latch",
    dimensionSpecs: "Gross Weight 500 g / Net Weight 350 g",
    dimensionUnitMode: "both",
  });

  assert.equal(source.packageWeightEvidence, "500 g (1.1 lb)");
  assert.equal(source.productWeightEvidence, "350 g (12.35 oz)");

  const [productOnlySource] = buildCreationListingSources({
    setId: "set-product-weight-evidence",
    productName: "Door Latch",
    productDescription: "Package dimensions: 22 x 6 x 3 cm. Net weight 350 g.",
    dimensionUnitMode: "both",
  });
  assert.equal(productOnlySource.packageWeightEvidence, "");
  assert.equal(productOnlySource.productWeightEvidence, "350 g (12.35 oz)");

  const [packageOnlySource] = buildCreationListingSources({
    setId: "set-package-weight-evidence",
    productName: "Door Latch",
    productDescription: "Package weight 500 g.",
    dimensionUnitMode: "both",
  });
  assert.equal(packageOnlySource.packageWeightEvidence, "500 g (1.1 lb)");
  assert.equal(packageOnlySource.productWeightEvidence, "");
});

test("listing weight evidence follows the selected unit mode for Chinese kilogram values", () => {
  const source = {
    dimensionSpecs: "净重：0.35公斤",
    dimensionUnitMode: "imperial",
  };

  assert.equal(getCreationListingWeightEvidence(source, "package"), "");
  assert.equal(getCreationListingWeightEvidence(source, "product"), "12.35 oz");
});

test("dimension provenance validates complete tuples instead of one shared number", () => {
  const source = {
    productDimensionEvidence: "Product dimensions: 10 x 5 x 3 cm (3.94 x 1.97 x 1.18 in)",
    packageDimensionEvidence: "",
    dimensionUnitMode: "both",
  };
  const valid = makeValidDraft({
    productDimensions: "10 x 5 x 3 cm (3.94 x 1.97 x 1.18 in)",
    zhDisplay: { productDimensions: "10 x 5 x 3 厘米（3.94 x 1.97 x 1.18 英寸）" },
  });
  assert.deepEqual(getCreationListingDimensionFieldErrors(valid, source), []);

  const fabricated = makeValidDraft({
    productDimensions: "10 x 999 x 999 cm (3.94 x 99 x 99 in)",
    zhDisplay: { productDimensions: "10 x 999 x 999 厘米（3.94 x 99 x 99 英寸）" },
  });
  assert.match(
    getCreationListingDimensionFieldErrors(fabricated, source).join("\n"),
    /complete source dimension tuple/iu,
  );

  const completedPackage = makeValidDraft({
    packageDimensions: "12.2 x 6.5 x 2.8 cm (4.8 x 2.56 x 1.1 in)",
    productDimensions: "Estimated: 18 x 12 x 6 cm (7.1 x 4.7 x 2.4 in)",
    zhDisplay: {
      packageDimensions: "12.2 × 6.5 × 2.8 厘米（4.8 × 2.56 × 1.1 英寸）",
      productDimensions: "预估：18 × 12 × 6 厘米（7.1 × 4.7 × 2.4 英寸）",
    },
  });
  assert.deepEqual(getCreationListingDimensionFieldErrors(completedPackage, {
    packageDimensionEvidence: "Package dimensions: 12.2 x 6.5 cm",
    dimensionUnitMode: "both",
  }), []);

  const incompletePackage = makeValidDraft({
    packageDimensions: "12.2 x 6.5 cm (4.8 x 2.56 in)",
    productDimensions: "Estimated: 18 x 12 x 6 cm (7.1 x 4.7 x 2.4 in)",
    zhDisplay: {
      packageDimensions: "12.2 × 6.5 厘米（4.8 × 2.56 英寸）",
      productDimensions: "预估：18 × 12 × 6 厘米（7.1 × 4.7 × 2.4 英寸）",
    },
  });
  assert.match(
    getCreationListingDimensionFieldErrors(incompletePackage, {
      packageDimensionEvidence: "Package dimensions: 12.2 x 6.5 cm",
      dimensionUnitMode: "both",
    }).join("\n"),
    /length x width x height/iu,
  );
});

test("dimension mode ignores weight units and enforces the shared field ceiling", () => {
  const weightOnlyImperial = makeValidDraft({
    packageDimensions: "Estimated: 20 cm, 2 lb",
    productDimensions: "Estimated: 20 cm, 2 lb",
    zhDisplay: {
      packageDimensions: "预估：20 厘米，2 磅",
      productDimensions: "预估：20 厘米，2 磅",
    },
  });
  const unitErrors = getCreationListingDimensionFieldErrors(weightOnlyImperial, {
    dimensionSpecs: "Weight 2 lb",
    dimensionUnitMode: "both",
  });
  assert.match(unitErrors.join("\n"), /must include both metric and imperial units/iu);

  const overlongDimension = `Estimated: ${"1 x 1 x 1 cm ".repeat(42)}`;
  assert.ok(Array.from(overlongDimension).length > 500);
  const lengthErrors = getCreationListingDimensionFieldErrors(makeValidDraft({
    packageDimensions: overlongDimension,
    productDimensions: overlongDimension,
    zhDisplay: {
      packageDimensions: `预估：${"1 x 1 x 1 厘米 ".repeat(42)}`,
      productDimensions: `预估：${"1 x 1 x 1 厘米 ".repeat(42)}`,
    },
  }), {
    dimensionSpecs: "Weight 2 lb",
    dimensionUnitMode: "metric",
  });
  assert.match(lengthErrors.join("\n"), /exceeds 500 characters/iu);
});

test("historical completed listings receive non-persistent dimension readback", () => {
  const storedSet = {
    setId: "set-historical-dimension-readback",
    dimensionSpecs: [
      "Length 194mm (7.64 in)",
      "Length 76mm (2.99 in)",
      "Length 5mm (0.2 in)",
      "Length 46mm (1.81 in)",
      "Width 35mm (1.38 in)",
      "Width 26mm (1.02 in)",
      "Width 34mm (1.34 in)",
    ].join("\n"),
    dimensionUnitMode: "both",
    listingDrafts: [{
      title: "1 Pack Door Latch",
      status: "completed",
      fiveBullets: [
        "VERIFIED SIZE: The main body measures 194mm (7.64 in) long by 35mm (1.38 in) wide; the keeper measures 46mm (1.81 in) long by 34mm (1.34 in) wide",
      ],
      zhDisplay: {
        title: "1 件装门插销",
        fiveBullets: [
          "核对尺寸：主体长194mm (7.64 in)、宽35mm (1.38 in)；扣件长46mm (1.81 in)、宽34mm (1.34 in)",
        ],
      },
    }],
  };

  const hydratedSet = hydrateCreationListingDimensionsForRead(storedSet);
  const hydratedDraft = hydratedSet.listingDrafts[0];

  assert.notEqual(hydratedSet, storedSet);
  assert.equal(Object.prototype.hasOwnProperty.call(storedSet.listingDrafts[0], "packageDimensions"), false);
  assert.match(hydratedDraft.packageDimensions, /^Estimated:/u);
  assert.match(hydratedDraft.zhDisplay.packageDimensions, /^预估：/u);
  assert.equal(
    hydratedDraft.productDimensions,
    "Main body: 194 x 35 mm (7.64 x 1.38 in); Keeper: 46 x 34 mm (1.81 x 1.34 in)",
  );
  assert.equal(
    hydratedDraft.zhDisplay.productDimensions,
    "主体：194 × 35 mm（7.64 × 1.38 in）；扣件：46 × 34 mm（1.81 × 1.34 in）",
  );
  assert.doesNotMatch(hydratedDraft.productDimensions, /^Estimated:/u);
  assert.doesNotMatch(hydratedDraft.productDimensions, /(?:^|[^\d])(?:76|5|26)\s*mm\b/iu);
  assert.equal(hydratedDraft.title, "1 Pack Door Latch");
});

test("historical readback completes a two-axis visible package measurement without rewriting history", () => {
  const storedSet = {
    setId: "set-historical-visible-package-dimension",
    productName: "Electric Minnow Fishing Lure",
    productDescription: "Transparent storage case and charging cable.",
    dimensionSpecs: "Length 10 cm",
    dimensionUnitMode: "both",
    referenceImageRoles: [{ note: "包装盒可见尺寸12.2厘米×6.5厘米" }],
    listingDrafts: [{
      title: "Electric Minnow Fishing Lure",
      status: "completed",
      packageDimensions: "12.2 cm (0.79 in) x 6.5 cm (2.56 in)",
      zhDisplay: {
        title: "电动仿生米诺鱼饵",
        packageDimensions: "12.2 厘米（0.79 英寸）×6.5 厘米（2.56 英寸）",
      },
    }],
  };

  const hydratedSet = hydrateCreationListingDimensionsForRead(storedSet);
  const hydratedDraft = hydratedSet.listingDrafts[0];

  assert.equal(storedSet.listingDrafts[0].packageDimensions, "12.2 cm (0.79 in) x 6.5 cm (2.56 in)");
  assert.match(hydratedDraft.packageDimensions, /^12\.2 x 6\.5 x \d+(?:\.\d+)? cm \(4\.8 x 2\.56 x \d+(?:\.\d+)? in\)$/u);
  assert.match(hydratedDraft.zhDisplay.packageDimensions, /^12\.2 × 6\.5 × \d+(?:\.\d+)? 厘米（4\.8 × 2\.56 × \d+(?:\.\d+)? 英寸）$/u);
  assert.doesNotMatch(hydratedDraft.packageDimensions, /^Estimated:/iu);
  assert.doesNotMatch(hydratedDraft.zhDisplay.packageDimensions, /^预估[:：]/u);
});

test("historical completed listings receive non-persistent sourced or estimated weight readback", () => {
  const storedSet = {
    setId: "set-historical-weight-readback",
    dimensionSpecs: "Net Weight 350 g",
    dimensionUnitMode: "both",
    listingDrafts: [{
      title: "1 Pack Door Latch",
      status: "completed",
      zhDisplay: { title: "1 件装门插销" },
    }],
  };

  const hydratedSet = hydrateCreationListingDimensionsForRead(storedSet);
  const hydratedDraft = hydratedSet.listingDrafts[0];

  assert.equal(Object.prototype.hasOwnProperty.call(storedSet.listingDrafts[0], "productWeight"), false);
  assert.equal(hydratedDraft.productWeight, "Weight: 350 g (12.35 oz)");
  assert.equal(hydratedDraft.zhDisplay.productWeight, "重量：350 克（12.35 盎司）");
  assert.equal(hydratedDraft.packageWeight, "Estimated: 350 g (12.35 oz)");
  assert.equal(hydratedDraft.zhDisplay.packageWeight, "预估：350 克（12.35 盎司）");
});

test("historical component dimension readback rejects measurements absent from source evidence", () => {
  const hydratedSet = hydrateCreationListingDimensionsForRead({
    setId: "set-historical-unbacked-component-dimensions",
    dimensionSpecs: "Length 194mm (7.64 in) Width 35mm (1.38 in)",
    dimensionUnitMode: "both",
    listingDrafts: [{
      title: "1 Pack Door Latch",
      status: "completed",
      fiveBullets: [
        "VERIFIED SIZE: The main body measures 194mm (7.64 in) long by 40mm (1.57 in) wide",
      ],
      zhDisplay: { title: "1 件装门插销" },
    }],
  });

  assert.doesNotMatch(hydratedSet.listingDrafts[0].productDimensions, /40\s*mm|1\.57\s*in/iu);
  assert.match(hydratedSet.listingDrafts[0].productDimensions, /194\s*mm.*35\s*mm/iu);
});

test("historical component dimensions retain axes that share a trailing unit", () => {
  const hydratedSet = hydrateCreationListingDimensionsForRead({
    setId: "set-historical-shared-unit-dimensions",
    dimensionSpecs: "Main body: 194 x 35 mm; Keeper: 46 x 34 mm",
    dimensionUnitMode: "metric",
    listingDrafts: [{
      title: "Door Latch",
      status: "completed",
      fiveBullets: ["Main body: 194 x 35 mm; Keeper: 46 x 34 mm"],
      zhDisplay: { title: "门插销" },
    }],
  });

  assert.equal(hydratedSet.listingDrafts[0].productDimensions, "Main body: 194 x 35 mm; Keeper: 46 x 34 mm");
  assert.equal(hydratedSet.listingDrafts[0].zhDisplay.productDimensions, "主体：194 × 35 mm；扣件：46 × 34 mm");
});

test("mock listings keep sourced product dimensions and visibly mark missing estimates", () => {
  const sourced = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Door Latch",
    dimensionSpecs: "Main body 194 mm x 35 mm; keeper 46 mm x 34 mm",
    productDimensionEvidence: "Main body 194 mm x 35 mm; keeper 46 mm x 34 mm",
    packageDimensionEvidence: "",
  });
  assert.doesNotMatch(sourced.productDimensions, /^Estimated:/iu);
  assert.match(sourced.productDimensions, /194\s*mm/iu);
  assert.match(sourced.packageDimensions, /^Estimated:/iu);
  assert.match(sourced.zhDisplay.packageDimensions, /^预估：/u);

  const estimated = makeMockCreationListingDraft({
    ...standardSource,
    dimensionSpecs: "Weight 42 g",
    productDimensionEvidence: "",
    packageDimensionEvidence: "",
  });
  assert.match(estimated.productDimensions, /^Estimated:/iu);
  assert.match(estimated.packageDimensions, /^Estimated:/iu);
  assert.match(estimated.zhDisplay.productDimensions, /^预估：/u);
  assert.match(estimated.zhDisplay.packageDimensions, /^预估：/u);
});

test("package dimensions complete measured axes without marking the completion as an estimate", () => {
  const twoAxisPackage = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Steel Door Latch",
    productDescription: "Package dimensions: 22 x 6 cm. Steel latch body.",
    dimensionUnitMode: "metric",
  });
  assert.match(twoAxisPackage.packageDimensions, /^22 x 6 x \d+(?:\.\d+)? cm$/u);
  assert.match(twoAxisPackage.zhDisplay.packageDimensions, /^22 × 6 × \d+(?:\.\d+)? 厘米$/u);
  assert.doesNotMatch(twoAxisPackage.packageDimensions, /^Estimated:/iu);
  assert.doesNotMatch(twoAxisPackage.zhDisplay.packageDimensions, /^预估[:：]/u);

  const oneAxisPackage = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Fishing Lure",
    productDescription: "Package length: 18 cm. Plastic lure body.",
    dimensionUnitMode: "metric",
  });
  assert.match(oneAxisPackage.packageDimensions, /^18 x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.doesNotMatch(oneAxisPackage.packageDimensions, /^Estimated:/iu);

  const parenthesizedPackage = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Fishing Lure",
    productDescription: "Plastic lure body.",
    packageDimensionEvidence: "Package dimensions (12.2 x 6.5 cm)",
    dimensionUnitMode: "metric",
  });
  assert.match(parenthesizedPackage.packageDimensions, /^12\.2 x 6\.5 x \d+(?:\.\d+)? cm$/u);
  assert.doesNotMatch(parenthesizedPackage.packageDimensions, /^Estimated:/iu);
});

test("package estimates are complete and vary with supplied product form", () => {
  const lure = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Electric Minnow Fishing Lure",
    productDescription: "Plastic lure body with diving lip.",
    dimensionSpecs: "",
    dimensionUnitMode: "metric",
  });
  const bottle = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Stainless Steel Travel Bottle",
    productDescription: "Steel bottle with screw lid.",
    dimensionSpecs: "",
    dimensionUnitMode: "metric",
  });
  assert.match(lure.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.match(bottle.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.notEqual(lure.packageDimensions, bottle.packageDimensions);
  assert.match(lure.zhDisplay.packageDimensions, /^预估：\d+(?:\.\d+)? × \d+(?:\.\d+)? × \d+(?:\.\d+)? 厘米$/u);

  const shortLure = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Electric Minnow Fishing Lure",
    productDescription: "Plastic lure body.",
    dimensionSpecs: "Length 10 cm",
    dimensionUnitMode: "metric",
  });
  const longLure = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Electric Minnow Fishing Lure",
    productDescription: "Plastic lure body.",
    dimensionSpecs: "Length 30 cm",
    dimensionUnitMode: "metric",
  });
  assert.match(shortLure.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.match(longLure.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.notEqual(shortLure.packageDimensions, longLure.packageDimensions);

  const cardSizedAccessory = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Portable Accessory",
    productDescription: "Thin plastic accessory.",
    dimensionSpecs: "",
    dimensionUnitMode: "metric",
    referenceImageRoles: [{ note: "商品约银行卡大小，便于放入钱包。" }],
  });
  const phoneSizedAccessory = makeMockCreationListingDraft({
    ...standardSource,
    productName: "Portable Accessory",
    productDescription: "Thin plastic accessory.",
    dimensionSpecs: "",
    dimensionUnitMode: "metric",
    referenceImageRoles: [{ note: "商品约手机大小，便于随身携带。" }],
  });
  assert.match(cardSizedAccessory.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.match(phoneSizedAccessory.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm$/u);
  assert.notEqual(cardSizedAccessory.packageDimensions, phoneSizedAccessory.packageDimensions);
  assert.ok(
    Number(cardSizedAccessory.packageDimensions.match(/^Estimated: (\d+(?:\.\d+)?)/u)?.[1])
      < Number(phoneSizedAccessory.packageDimensions.match(/^Estimated: (\d+(?:\.\d+)?)/u)?.[1]),
  );
});

test("mock listings keep sourced weights and estimate only the missing weight type", () => {
  const sourced = makeMockCreationListingDraft({
    ...standardSource,
    dimensionSpecs: "Net Weight 350 g",
    dimensionUnitMode: "both",
  });

  assert.equal(sourced.productWeight, "Weight: 350 g (12.35 oz)");
  assert.equal(sourced.zhDisplay.productWeight, "重量：350 克（12.35 盎司）");
  assert.equal(sourced.packageWeight, "Estimated: 350 g (12.35 oz)");
  assert.equal(sourced.zhDisplay.packageWeight, "预估：350 克（12.35 盎司）");

  const imperial = makeMockCreationListingDraft({
    ...standardSource,
    dimensionSpecs: "",
    dimensionUnitMode: "imperial",
  });
  assert.equal(imperial.packageWeight, "Estimated: 12.35 oz");
  assert.equal(imperial.productWeight, "Estimated: 8.82 oz");
  assert.equal(imperial.zhDisplay.packageWeight, "预估：12.35 盎司");
  assert.equal(imperial.zhDisplay.productWeight, "预估：8.82 盎司");
});

test("platform V1 prompt requests evidence-backed value copy and Amazon-style bullets", async () => {
  const calls = [];
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    language: "en-US",
    forceV1: true,
    productDescription: "Blue lure with a reflective finish that stays visible in the supplied use context.",
    dimensionSpecs: "3.5 in / 9 cm",
    sellingPoints: ["Reflective finish", "Compact shape"],
    skuSubjects: [
      {
        id: "blue-compact",
        title: "Blue compact lure",
        bundleCount: 2,
        note: "Two blue lure units with a compact body and reflective visible finish.",
      },
    ],
    titleValueEvidence: [
      {
        sourceRole: "benefit",
        buyerContext: "Anglers who need the lure to remain visible in the supplied use context.",
        supportedValue: "Reflective finish stays visible in the supplied use context.",
        evidenceFocus: "The supplied product reference shows a reflective finish.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    calls.push({ body: JSON.parse(init.body) });
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeMockCreationListingDraft(source)),
    }), { status: 200 });
  };

  await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl,
  });

  const prompt = calls[0].body.input;
  assert.match(prompt, /Listing SEO Agent/);
  assert.match(prompt, /Five-point listing quality constraints/);
  assert.match(prompt, /Platform search fit/);
  assert.match(prompt, /Resolved platform policy/);
  assert.match(prompt, /Title formula/i);
  assert.match(prompt, /core product keyword/i);
  assert.match(prompt, /do not include size/i);
  assert.match(prompt, /search terms/i);
  assert.doesNotMatch(prompt, /Non-title attribute-only rule/i);
  assert.doesNotMatch(prompt, /no non-title fields may contain functional/i);
  assert.match(prompt, /Evidence-backed buyer value rule/i);
  assert.match(prompt, /supplied feature.*practical buyer relevance.*supplied proof/is);
  assert.match(prompt, /category friction.*supplied product response.*supplied proof/is);
  assert.match(prompt, /must not claim that other products cannot solve the problem/i);
  assert.match(prompt, /better than competitors|comparative superiority/i);
  assert.match(prompt, /Non-title value completeness rule/i);
  assert.match(prompt, /packageDimensions.*productDimensions/is);
  assert.match(prompt, /Estimated:.*预估：/is);
  assert.match(prompt, /must not reuse product dimensions as package dimensions/i);
  assert.match(prompt, /write 4-5 sellingPoints and 3-4 painPoints/i);
  assert.match(prompt, /recommendations are not quotas/i);
  assert.match(prompt, /complete, specific statement/i);
  assert.match(prompt, /painPoints must use declarative statements only/i);
  assert.match(prompt, /Never use a question mark.*\?.*？/is);
  assert.match(prompt, /Do not begin English painPoints with How.*What.*Which.*Is.*Are.*Does.*Do.*Can/is);
  assert.match(prompt, /Chinese painPoints.*是否.*什么.*多少.*如何/is);
  assert.match(prompt, /unknown, missing, or not specified as filler/i);
  assert.match(prompt, /primary value.*differentiating feature.*use context or fit.*specification.*variant.*package/is);
  assert.match(prompt, /unique product-relevant.*1-3 word uppercase lead label/is);
  assert.match(prompt, /2-4 short paragraphs/i);
  assert.match(prompt, /Aim for 350-500 English characters total/i);
  assert.match(prompt, /Never exceed 500 characters or a stricter platform limit/i);
  assert.match(prompt, /backendSearchTerms.*synonyms.*not already used verbatim/i);
  assert.match(prompt, /Deduplicate case-insensitively across backendSearchTerms and all four keyword buckets/i);
  assert.match(prompt, /mechanical singular\/plural variants/i);
  assert.match(prompt, /same array lengths, order, facts, quantities, and units/i);
  assert.match(prompt, /Do not repeat the title or another field merely to make content longer/i);
  assert.match(prompt, /buyer-facing language rule/i);
  assert.match(prompt, /write every non-title field for a shopper reading a finished product page/i);
  assert.match(prompt, /never expose internal record, evidence, or generation workflow/i);
  assert.match(prompt, /parent listing.*parent product.*saved creation set.*supplied configuration.*reference labels.*selected quantity.*confirmed selection/is);
  assert.match(prompt, /Changing light conditions can make a single viewing mode limiting/i);
  assert.match(prompt, /光线条件变化时，单一观察模式容易受到限制/u);
  assert.doesNotMatch(prompt, /ask a practical product question/i);
  assert.doesNotMatch(prompt, /question followed by a factual answer/i);
  assert.match(prompt, /bullet bodies.*front-load.*buyer decision point/is);
  assert.match(prompt, /description.*open with the product identity.*never describe the Listing record/is);
  assert.match(prompt, /visible model markings include/i);
  assert.match(prompt, /not a confirmed SKU, selected variant, or available option/i);
  assert.match(prompt, /backendSearchTerms and keywordBuckets remain keyword phrases, not explanatory sentences/i);
  assert.match(prompt, /Chinese counterparts.*same natural buyer-facing voice/i);
  assert.match(prompt, /exactly five bullets/i);
  assert.doesNotMatch(prompt, /start every fiveBullets item with PRODUCT TYPE/i);
  assert.match(prompt, /Title value exception/i);
  assert.match(prompt, /strongest differentiating selling point/i);
  assert.match(prompt, /pain point or purchase concern/i);
  assert.match(prompt, /Mandatory title value evidence/i);
  assert.match(prompt, /Reflective finish stays visible in the supplied use context/i);
  assert.match(prompt, /attribute-only title is invalid/i);
  assert.match(prompt, /after the required product identity and value phrase, append 2-4/i);
  assert.match(prompt, /different search or purchase decision point/i);
  assert.match(prompt, /visible construction, visible components, shape, color, variant, quantity, or package facts/i);
  assert.match(prompt, /platform hard character and byte limits are absolute/i);
  assert.match(prompt, /recommended title range is a soft readability target/i);
  assert.match(prompt, /do not shorten or remove the supplied selling point or its supported pain-point resolution/i);
  assert.match(prompt, /do not repeat concepts, stack synonyms, or add generic filler/i);
  assert.match(prompt, /same appended facts in the same order/i);
  assert.match(prompt, /Never use objectionFocus as a title claim/i);
  assert.match(prompt, /non-title fields follow the separate evidence-backed buyer-value rules/i);
  assert.doesNotMatch(prompt, /no public field or zhDisplay field may contain functional/i);
  assert.match(prompt, /Do not write gift/i);
  assert.doesNotMatch(prompt, /senior ecommerce Listing strategist/i);
  assert.match(prompt, /Buyer decision evidence/i);
});

test("platform V1 accepts sourced dimensions and marks unattributed package dimensions as estimated without retrying", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
    dimensionSpecs: "Product length 3.5 in (8.9 cm)",
    productDimensionEvidence: "Product length 3.5 in (8.9 cm)",
    packageDimensionEvidence: "",
  };
  const validDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidPlatformV1Draft()),
    }), { status: 200 }),
  });

  assert.equal(validDraft.productDimensions, "3.5 in (8.9 cm) long");
  assert.match(validDraft.packageDimensions, /^Estimated:/u);
  assert.match(validDraft.zhDisplay.packageDimensions, /^预估：/u);

  let unmarkedRequestCount = 0;
  const unmarkedDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...source,
      dimensionSpecs: "Weight 42 g",
      productDimensionEvidence: "",
    },
    fetchImpl: async () => {
      unmarkedRequestCount += 1;
      return new Response(JSON.stringify({
        output_text: JSON.stringify(makeValidPlatformV1Draft({
          packageDimensions: "6 x 4 x 2 in (15.2 x 10.2 x 5.1 cm)",
          productDimensions: "5 x 2 x 1 in (12.7 x 5.1 x 2.5 cm)",
          zhDisplay: {
            packageDimensions: "15.2 x 10.2 x 5.1 厘米（6 x 4 x 2 英寸）",
            productDimensions: "12.7 x 5.1 x 2.5 厘米（5 x 2 x 1 英寸）",
          },
        })),
      }), { status: 200 });
    },
  });

  assert.equal(unmarkedRequestCount, 1);
  assert.equal(unmarkedDraft.status, "completed");
  assert.match(unmarkedDraft.packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm \(\d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? in\)$/u);
  assert.match(unmarkedDraft.zhDisplay.packageDimensions, /^预估：\d+(?:\.\d+)? × \d+(?:\.\d+)? × \d+(?:\.\d+)? 厘米（\d+(?:\.\d+)? × \d+(?:\.\d+)? × \d+(?:\.\d+)? 英寸）$/u);
  assert.equal(unmarkedDraft.productDimensions, "5 x 2 x 1 in (12.7 x 5.1 x 2.5 cm)");
});

test("V1 and V2 complete two-axis package dimensions without a retry", async () => {
  const cases = [
    {
      name: "V1",
      source: {
        ...standardSource,
        forceV1: true,
        platformPolicyId: "etsy",
        packageDimensionEvidence: "Package dimensions: 12.2 x 6.5 cm",
        dimensionUnitMode: "both",
      },
      draft: makeValidPlatformV1Draft({
        packageDimensions: "12.2 x 6.5 cm",
        zhDisplay: { packageDimensions: "12.2 × 6.5 厘米" },
      }),
    },
    {
      name: "V2",
      source: {
        ...standardSource,
        forceV2: true,
        platformPolicyId: "universal",
        packageDimensionEvidence: "Package dimensions: 12.2 x 6.5 cm",
        dimensionUnitMode: "both",
      },
      draft: makeValidDraft({
        packageDimensions: "12.2 x 6.5 cm",
        zhDisplay: { packageDimensions: "12.2 × 6.5 厘米" },
      }),
    },
  ];

  for (const entry of cases) {
    let requestCount = 0;
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: entry.source,
      fetchImpl: async () => {
        requestCount += 1;
        return new Response(JSON.stringify({ output_text: JSON.stringify(entry.draft) }), { status: 200 });
      },
    });

    assert.equal(requestCount, 1, entry.name);
    assert.equal(draft.status, "completed", entry.name);
    assert.match(draft.packageDimensions, /^12\.2 x 6\.5 x \d+(?:\.\d+)? cm \(4\.8 x 2\.56 x \d+(?:\.\d+)? in\)$/u, entry.name);
    assert.match(draft.zhDisplay.packageDimensions, /^12\.2 × 6\.5 × \d+(?:\.\d+)? 厘米（4\.8 × 2\.56 × \d+(?:\.\d+)? 英寸）$/u, entry.name);
    assert.doesNotMatch(draft.packageDimensions, /^Estimated:/iu, entry.name);
    assert.doesNotMatch(draft.zhDisplay.packageDimensions, /^预估[:：]/u, entry.name);
  }
});

test("platform V1 accepts dimension fields over the shared 500-character ceiling", async () => {
  const overlongDimension = `Estimated: ${"1 x 1 x 1 cm ".repeat(42)}`;
  let requestCount = 0;
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      forceV1: true,
      dimensionSpecs: "Weight 42 g",
      productDimensionEvidence: "",
      packageDimensionEvidence: "",
      dimensionUnitMode: "metric",
    },
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({
        output_text: JSON.stringify(makeValidPlatformV1Draft({
          packageDimensions: overlongDimension,
          productDimensions: overlongDimension,
          zhDisplay: {
            packageDimensions: `预估：${"1 x 1 x 1 厘米 ".repeat(42)}`,
            productDimensions: `预估：${"1 x 1 x 1 厘米 ".repeat(42)}`,
          },
        })),
      }), { status: 200 });
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.packageDimensions, overlongDimension.trim());
  assert.ok(Array.from(draft.packageDimensions).length > 500);
});

test("listing agent derives 2 Pack from grouped subject units when bundle count is one", async () => {
  const calls = [];
  const groupedPairSource = {
    ...standardSource,
    skuBundleCount: 1,
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    const prompt = JSON.parse(init.body).input;
    calls.push(prompt);
    const usesTwoPack = /Title formula: start with 2 Pack/i.test(prompt);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: usesTwoPack
          ? "2 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait"
          : "1 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: usesTwoPack
          ? "This listing covers two complete visible lure bodies from the grouped SKU subject."
          : "This listing covers one lure body.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedPairSource,
    fetchImpl,
  });

  assert.match(calls[0], /Title formula: start with 2 Pack/i);
  assert.match(calls[0], /Description must explicitly mention.*two complete visible lure bodies/is);
  assert.match(draft.title, /^2 Pack Fishing Lure\b/);
  assert.match(draft.description, /two complete visible lure bodies/i);
});

test("listing agent prompt uses readable mixed pack quantity wording", async () => {
  const prompts = [];
  const fetchImpl = async (_url, init) => {
    prompts.push(JSON.parse(init.body).input);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack / 3 Pack Electronic Fishing Lure Bass Trout Freshwater Swimbait",
        description: "Electronic fishing lure options cover two-pack and three-pack grouped SKU choices.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Electronic Fishing Lure",
      skuBundleCount: 2,
      skuQuantityOptions: [2, 3],
      skuSubjects: [
        { id: "two-lures", title: "Two lure colorways", subjectUnitCount: 2 },
        { id: "three-lures", title: "Three lure colorways", subjectUnitCount: 3 },
      ],
    },
    fetchImpl,
  });

  assert.match(prompts[0], /Title formula: start with 2 Pack \/ 3 Pack/i);
  assert.match(draft.title, /^2 Pack \/ 3 Pack Electronic Fishing Lure\b/);
});

test("listing agent accepts a grouped subject description that omits the unit count", async () => {
  const prompts = [];
  let callCount = 0;
  const groupedPairSource = {
    ...standardSource,
    skuBundleCount: 1,
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: "This listing covers one lure body for freshwater fishing.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedPairSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(prompts.length, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.description, "This listing covers one lure body for freshwater fishing.");
});

test("listing agent accepts a grouped subject description without rewriting it", async () => {
  const prompts = [];
  let callCount = 0;
  const groupedPairSource = {
    ...standardSource,
    skuBundleCount: 1,
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: "This fishing lure option includes the stated freshwater bait details.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedPairSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(prompts.length, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.description, "This fishing lure option includes the stated freshwater bait details.");
});

test("listing agent accepts missing grouped subject quantity from Chinese source notes", async () => {
  let callCount = 0;
  const groupedChineseSource = {
    ...standardSource,
    productName: "仿真鱼饵",
    skuTitle: "四节电动仿真鱼饵-银灰/银蓝双款",
    skuBundleCount: 2,
    skuSubjects: [
      {
        id: "sku1",
        title: "四节电动仿真鱼饵-银灰/银蓝双款",
        filenames: ["sku1.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "该源图包含2个完整可售产品单位：上方银灰鱼纹款1个、下方银蓝鱼纹款1个；图中共 2 个完整产品单位。",
      },
    ],
  };
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Electric Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: "This electric fishing lure option includes the stated freshwater bait details.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedChineseSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.description, "This electric fishing lure option includes the stated freshwater bait details.");
  assert.doesNotMatch(draft.description, /[\u3400-\u9fff]/u);
});

test("listing agent sends a strict JSON schema request with prompt guardrails", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ output_text: JSON.stringify(makeValidDraft()) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1/",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/v1/responses");
  assert.equal(calls[0].headers.Authorization, "Bearer test-key");
  assert.equal(calls[0].body.model, "gpt-5.4");
  assert.deepEqual(calls[0].body.reasoning, { effort: "medium" });
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.text.format.type, "json_schema");
  assert.equal(calls[0].body.text.format.name, "creation_listing_draft_json");
  assert.equal(calls[0].body.text.format.strict, true);
  assert.deepEqual(calls[0].body.text.format.schema.required, CREATION_LISTING_JSON_SCHEMA.required);
  assert.ok(calls[0].body.text.format.schema.required.includes("zhDisplay"));
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay.required.includes("warnings"));
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay.required.includes("missingInfo"));
  assert.ok(calls[0].body.text.format.schema.required.includes("packageDimensions"));
  assert.ok(calls[0].body.text.format.schema.required.includes("productDimensions"));
  assert.ok(calls[0].body.text.format.schema.required.includes("packageWeight"));
  assert.ok(calls[0].body.text.format.schema.required.includes("productWeight"));
  assert.match(calls[0].body.input, /Amazon US English listing writer/);
  assert.match(calls[0].body.input, /Every field and every bullet must be 500 characters or fewer/);
  assert.match(calls[0].body.input, /Title formula: start with 2 Pack/i);
  assert.match(calls[0].body.input, /core product keyword/i);
  assert.match(calls[0].body.input, /do not include size/i);
  assert.match(calls[0].body.input, /search terms/i);
  assert.doesNotMatch(calls[0].body.input, /place it immediately after quantity/);
  assert.match(calls[0].body.input, /Public listing fields must be English only/);
  assert.match(calls[0].body.input, /sellingPoints and painPoints must each be 500 English characters or fewer in total/);
  assert.match(calls[0].body.input, /zhDisplay/);
  assert.match(calls[0].body.input, /warnings and missingInfo/);
  assert.match(calls[0].body.input, /packageDimensions.*productDimensions/is);
  assert.match(calls[0].body.input, /packageWeight.*productWeight/is);
  assert.match(calls[0].body.input, /Estimated:.*预估：/is);
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay);
  assert.match(calls[0].body.input, /Do not use the phrase "Listing Draft"/);
  assert.match(calls[0].body.input, /search-friendly structure/);
  assert.match(calls[0].body.input, /Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims/);
});

test("listing agent times out stalled upstream requests", async () => {
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });

  await assert.rejects(
    requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: standardSource,
      fetchImpl,
      requestTimeoutMs: 5,
    }),
    /Listing request timed out after 5ms/,
  );
});

test("listing agent uses a ten-minute default upstream timeout", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timeoutDelays = [];
  const clearedTimeouts = [];

  globalThis.setTimeout = (_callback, delay) => {
    timeoutDelays.push(delay);
    return { delay };
  };
  globalThis.clearTimeout = (timeout) => {
    clearedTimeouts.push(timeout);
  };

  try {
    const fetchImpl = async () => new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft()),
    }));

    await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: standardSource,
      fetchImpl,
    });

    assert.deepEqual(timeoutDelays, [600000]);
    assert.equal(clearedTimeouts.length, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("listing agent accepts UI-only Chinese display text alongside English public copy", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: JSON.stringify(makeValidDraft({
      zhDisplay: {
        title: "2 件 3.5 英寸蓝色路亚鱼饵",
        sellingPoints: ["亮蓝色外观与已注明的颜色变体。"],
        painPoints: ["购买前核对颜色变体和包装数量。"],
        fiveBullets: [
          "商品类型：蓝色路亚鱼饵。",
          "包装信息：2 件商品。",
          "外观信息：蓝色外观和已注明的 SKU。",
          "商品细节基于已提供信息和 SKU 元数据。",
          "关键词导向文案保持简洁。",
        ],
        description: "蓝色路亚鱼饵的美国站 Listing 中文对照。",
        backendSearchTerms: "蓝色 路亚 鱼饵 鲈鱼",
        keywordBuckets: {
          exact: ["蓝色路亚鱼饵"],
          longTail: ["3.5 英寸鲈鱼鱼饵"],
          traffic: ["淡水鱼饵"],
          descriptive: ["紧凑蓝色鱼饵"],
        },
      },
    })),
  }), { status: 200 });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
  assert.match(visibleChineseDisplayText(draft), /蓝色路亚鱼饵/u);
  assert.equal(validateListingAgentDraft(draft, "2 Pack").ok, true);
});

test("listing agent extracts Responses output content text", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output: [
      {
        content: [
          { type: "output_text", text: JSON.stringify(makeValidDraft()) },
        ],
      },
    ],
  }), { status: 200 });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait");
});

test("listing agent accepts the first parsed response after local validation differences", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1 ? makeValidDraft({ title: "Bad title without quantity" }) : makeValidDraft();
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(prompts.length, 1);
  assert.doesNotMatch(prompts[0], /Fix these validation errors/i);
  assert.equal(draft.status, "completed");
  assert.equal(draft.title, "Bad title without quantity");
});

test("listing agent accepts parsed public listing fields that contain Chinese", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack 3.5 in 路亚硬饵 Product Listing Draft",
        fiveBullets: [
          "2 Pack 3.5 in format keeps quantity and size visible.",
          "路亚硬饵 draft uses saved product and SKU information.",
          "Copy stays conservative when generated images are unavailable.",
          "Keyword structure supports US marketplace review.",
          "Each bullet is kept under the configured character limit.",
        ],
        backendSearchTerms: "路亚硬饵 product listing",
      })
      : makeValidDraft({
        title: "2 Pack Electric Fishing Lure Bass Trout Freshwater Swimbait",
        backendSearchTerms: "electric fishing lure bass bait",
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(prompts.length, 1);
  assert.equal(draft.status, "completed");
  assert.match(draft.title, /路亚硬饵/u);
  assert.match(visibleDraftText(draft), /路亚硬饵/u);
});

test("listing agent accepts parsed functional wording without a validation retry", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        painPoints: [
          "The bright profile helps the bait stay noticeable.",
        ],
      })
      : makeValidDraft({
        painPoints: [
          "Review the stated color variant and pack quantity before purchase.",
        ],
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(prompts.length, 1);
  assert.equal(draft.status, "completed");
  assert.match(draft.painPoints.join("\n"), /helps/u);
});

test("listing agent accepts parsed policy differences without retrying", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "Bad title without quantity",
        sellingPoints: ["FDA Certified product quality"],
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.title, "Bad title without quantity");
  assert.match(draft.sellingPoints.join("\n"), /FDA Certified/u);
});

test("listing agent keeps compound dimensions out of search-focused titles", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Desk Organizer Tray Office Storage Desktop Organizer",
        fiveBullets: [
          "PRODUCT TYPE: Desk organizer tray.",
          "PACK DETAILS: Two supplied product units.",
          "VISIBLE DETAILS: Compact tray profile and stated color.",
          "SPECIFICATIONS: Stated dimensions are 3.5 x 2 in.",
          "PACKAGE CONTENTS: Two desk organizer trays.",
        ],
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Desk Organizer Tray",
      skuTitle: "Desk Organizer Tray",
      dimensionSpecs: "3.5 x 2 in",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.match(draft.title, /^2 Pack Desk Organizer Tray\b/);
  assert.doesNotMatch(draft.title, /3\.5 x 2 in/i);
});

test("listing agent accepts titles without dimensions when source dimensions exist", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = makeValidDraft({
      title: "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait",
    });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      dimensionSpecs: "3.5 in (9 cm)",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.match(prompts[0], /do not include size/i);
  assert.match(draft.title, /^2 Pack Blue Fishing Lures\b/);
  assert.doesNotMatch(draft.title, /3\.5\s*in|9\s*cm/i);
});

test("listing agent accepts metric equivalents in an imperial-mode parsed response", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = makeValidDraft({
      title: "1 Pack Fishing Lure Electric Swimbait 5.12 in / 130 mm 1.23 oz / 35 g",
      packageDimensions: "Estimated: 6 x 4 x 2 in",
      productDimensions: "5.12 in long",
      zhDisplay: {
        packageDimensions: "预估：6 x 4 x 2 英寸",
        productDimensions: "长度 5.12 英寸",
      },
    });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      skuBundleCount: 1,
      dimensionSpecs: "5.12 in 1.23 oz",
      dimensionUnitMode: "imperial",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.match(prompts[0], /imperial units only/i);
  assert.equal(draft.status, "completed");
  assert.equal(draft.title, "1 Pack Fishing Lure Electric Swimbait 5.12 in / 130 mm 1.23 oz / 35 g");
});

test("listing agent accepts a parsed title that includes size and specification values", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = makeValidDraft({
      title: "3 Pack Electronic Fishing Lure Propeller Swimbait Hook Size 4# 130 mm 35 g",
    });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Electronic Fishing Lure",
      skuBundleCount: 3,
      dimensionSpecs: "Hook Size 4#, 130 mm, 35 g",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.equal(prompts.length, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.title, "3 Pack Electronic Fishing Lure Propeller Swimbait Hook Size 4# 130 mm 35 g");
});

test("generateCreationListingDrafts creates one completed V1 parent draft for all SKU variants", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-1",
      productName: "Fishing Lure",
      dimensionSpecs: "3.5 in",
      skuSubjects: [
        { id: "blue", title: "Blue Lure", bundleCount: 2 },
        { id: "green", title: "Green Lure", bundleCount: 2 },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].platformId, "universal");
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack Fishing Lure\b/);
  assert.doesNotMatch(drafts[0].title, /8\.89 cm|3\.5 in/i);
  assert.equal(drafts[0].skuSubjectId, "");
  assert.ok(drafts[0].fiveBullets.length > 0);
  assert.ok(drafts[0].description);
});

test("application Listing generation uses one platform-aware V1 request and removes brand terms", async () => {
  const calls = [];
  const draftPayload = {
    title: "Acme Travel Bottle",
    sellingPoints: [
      "The compact Acme bottle profile takes up less room in a daily carry bag.",
      "The Acme flip lid keeps the opening covered between sips.",
      "The slim Acme shape is easy to hold during everyday travel.",
      "One Acme bottle keeps the pack contents simple and clear.",
    ],
    painPoints: [
      "Bulky drinkware can crowd a daily bag; the compact Acme bottle profile uses less carry space.",
      "An exposed opening between sips can collect everyday contact; the Acme flip lid keeps it covered.",
      "Unclear pack quantities make selection harder; this option contains one Acme travel bottle.",
    ],
    fiveBullets: [
      "COMPACT CARRY: The compact Acme profile uses less room in a daily bag while keeping the bottle ready for travel.",
      "COVERED OPENING: The Acme flip lid keeps the drinking opening covered between sips.",
      "DAILY USE: The slim Acme bottle shape is easy to hold during commuting and everyday travel.",
      "BOTTLE PROFILE: The supplied product has a compact body and flip-lid construction.",
      "IN THE BOX: The package contains one Acme travel bottle.",
    ],
    description: "The compact Acme travel bottle is made for daily hydration without taking over a carry bag. Its slim profile is easy to hold, while the flip lid keeps the opening covered between sips. The package contains one bottle.",
    backendSearchTerms: "Acme travel bottle",
    keywordBuckets: {
      exact: ["Acme travel bottle"],
      longTail: [],
      traffic: [],
      descriptive: [],
    },
    packageDimensions: "Estimated: 20 x 15 x 8 cm (7.9 x 5.9 x 3.1 in)",
    productDimensions: "Estimated: 18 x 12 x 6 cm (7.1 x 4.7 x 2.4 in)",
    packageWeight: "Estimated: 350 g (12.35 oz)",
    productWeight: "Estimated: 250 g (8.82 oz)",
    zhDisplay: {
      title: "Acme 旅行水瓶",
      sellingPoints: [
        "紧凑的 Acme 瓶身轮廓可减少日常随身包内的占用空间。",
        "Acme 翻盖可在两次饮水之间保持饮水口覆盖。",
        "纤细的 Acme 瓶身便于日常出行时握持。",
        "单个 Acme 水瓶让包装内容清晰明确。",
      ],
      painPoints: [
        "体积较大的饮水容器容易占满随身包，紧凑的 Acme 瓶身可减少携带空间占用。",
        "两次饮水之间裸露的饮水口容易接触外部物体，Acme 翻盖可保持瓶口覆盖。",
        "包装数量不清会增加选择难度，此选项内含一个 Acme 旅行水瓶。",
      ],
      fiveBullets: [
        "紧凑携带：紧凑的 Acme 瓶身减少日常包内占用空间，适合随身出行。",
        "瓶口覆盖：Acme 翻盖可在两次饮水之间保持饮水口覆盖。",
        "日常使用：纤细的 Acme 瓶身便于通勤和日常出行时握持。",
        "瓶身结构：资料显示该产品采用紧凑瓶身和翻盖结构。",
        "包装内容：包装内含一个 Acme 旅行水瓶。",
      ],
      description: "这款紧凑的 Acme 旅行水瓶用于日常补水，同时减少随身包内的空间占用。纤细瓶身便于握持，翻盖可在两次饮水之间保持瓶口覆盖。包装内含一个水瓶。",
      backendSearchTerms: "Acme 旅行水瓶",
      keywordBuckets: {
        exact: ["Acme 旅行水瓶"],
        longTail: [],
        traffic: [],
        descriptive: [],
      },
      packageDimensions: "预估：20 x 15 x 8 厘米（7.9 x 5.9 x 3.1 英寸）",
      productDimensions: "预估：18 x 12 x 6 厘米（7.1 x 4.7 x 2.4 英寸）",
      packageWeight: "预估：350 克（12.35 盎司）",
      productWeight: "预估：250 克（8.82 盎司）",
    },
  };

  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-platform-v1",
      platformPolicyId: "etsy",
      productName: "Acme Travel Bottle",
      brand: "Acme",
      productDescription: "Compact travel bottle with a slim profile that takes up less room in a daily carry bag and is easy to hold during commuting or everyday travel. The flip lid keeps the opening covered between sips. One bottle is included.",
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ output_text: JSON.stringify(draftPayload) }), { status: 200 });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].input, /"platformId": "etsy"/);
  assert.deepEqual(calls[0].text.format.schema.required.sort(), Object.keys(draftPayload).sort());
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.doesNotMatch(visibleDraftText(drafts[0]), /Acme/i);
  assert.doesNotMatch(visibleChineseDisplayText(drafts[0]), /Acme/i);
  assert.match(drafts[0].fiveBullets[0], /^COMPACT CARRY:/);
  assert.match(visibleDraftText(drafts[0]), /takes up less room|keeps the opening covered/i);
});

test("platform V1 sanitizes unsupported low-risk terms and accepts recoverable formatting differences", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
    productName: "Fishing Lure",
    skuTitle: "Fishing Lure",
    skuBundleCount: 1,
    dimensionSpecs: "",
  };
  const payload = {
    title: "1 Pack Adjustable Gray Black Rechargeable Fishing Lure",
    sellingPoints: [
      "The adjustable body keeps the lure profile easy to review.",
      "The gray and black finish separates the visible sections.",
      "The rechargeable design is stated in the generated copy.",
    ],
    painPoints: ["Need a clear lure option? Review the supplied pack before purchase."],
    fiveBullets: [
      "PRODUCT TYPE: Adjustable fishing lure.",
      "PACK DETAILS: One gray and black lure is included.",
      "PACKAGE CONTENTS: Rechargeable fishing lure.",
    ],
    description: "This adjustable gray black rechargeable fishing lure remains usable after low-risk term cleanup.",
    backendSearchTerms: "adjustable gray black rechargeable",
    keywordBuckets: {
      exact: ["adjustable"],
      longTail: ["gray"],
      traffic: ["black"],
      descriptive: ["rechargeable"],
    },
    packageDimensions: "Estimated: 20 x 15 x 8 cm (7.9 x 5.9 x 3.1 in)",
    productDimensions: "Estimated: 18 x 12 x 6 cm (7.1 x 4.7 x 2.4 in)",
    zhDisplay: {
      title: "1 件装路亚鱼饵",
      sellingPoints: ["鱼饵主体和可见分区便于直接查看。"],
      painPoints: ["需要清晰的鱼饵选项？购买前可查看包装信息。", "包装内含一个鱼饵。"],
      fiveBullets: ["产品类型：路亚鱼饵。"],
      description: "这款路亚鱼饵在清理低风险词后仍保留可用商品信息。",
      backendSearchTerms: "路亚 鱼饵",
      keywordBuckets: {
        exact: ["路亚鱼饵"],
        longTail: [],
        traffic: [],
        descriptive: [],
      },
      packageDimensions: "预估：20 x 15 x 8 厘米（7.9 x 5.9 x 3.1 英寸）",
      productDimensions: "预估：18 x 12 x 6 厘米（7.1 x 4.7 x 2.4 英寸）",
    },
  };
  let requestCount = 0;

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { status: 200 });
    },
  });

  assert.equal(requestCount, 1);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:adjustable|gray|black|rechargeable)\b/i);
  assert.equal(draft.backendSearchTerms, "");
  assert.deepEqual(Object.values(draft.keywordBuckets).flat(), []);
  assert.equal(draft.fiveBullets.length, 3);
  assert.equal(draft.zhDisplay.fiveBullets.length, 1);
  assert.match(draft.painPoints[0], /\?/u);
  assert.ok(draft.title);
  assert.ok(draft.description);
});

test("platform V1 removes unsupported English and Chinese compatibility claims without failing", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
  };
  const payload = makeValidPlatformV1Draft({
    title: "2 Pack Fishing Lures Compatible with Reel X.",
    description: "Fishing lures compatible with Reel X. Supplied pack details remain available.",
    backendSearchTerms: "fishing lure compatible with Reel X",
    zhDisplay: {
      title: "2 件装路亚鱼饵兼容 Reel X。",
      description: "路亚鱼饵兼容 Reel X。包装信息仍可查看。",
      backendSearchTerms: "路亚鱼饵兼容 Reel X",
    },
  });
  let requestCount = 0;

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { status: 200 });
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(draft.status, "completed");
  assert.doesNotMatch(visibleDraftText(draft), /compatible\s+with|Reel X/iu);
  assert.doesNotMatch(visibleChineseDisplayText(draft), /兼容|Reel X/u);
  assert.match(draft.title, /Fishing Lures/i);
  assert.match(draft.zhDisplay.title, /路亚鱼饵/u);
});

test("platform V1 removes every unsupported blocking claim category across multilingual fields", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
  };
  const payload = makeValidPlatformV1Draft({
    title: "2 Pack Best Seller Fishing Lures",
    sellingPoints: [
      "Fishing lure. FDA certified product.",
      "Fishing lure with five-star reviews.",
      "Fishing lure better than other products.",
      "Medical grade fishing lure.",
      "Fishing lure with lifetime warranty.",
      "Stainless steel body fishing lure.",
      "Fishing lure with 12-hour battery runtime.",
      "Guaranteed fishing lure with refund.",
      "最高",
      "최고",
      "El mejor",
    ],
    zhDisplay: {
      title: "2 件装最佳路亚鱼饵",
      sellingPoints: [
        "路亚鱼饵。FDA认证产品。",
        "路亚鱼饵获得五星好评。",
        "路亚鱼饵优于其他竞品。",
        "医疗级路亚鱼饵。",
        "路亚鱼饵提供终身质保。",
        "不锈钢材质路亚鱼饵。",
        "路亚鱼饵具备12小时电池续航。",
        "保证路亚鱼饵支持退款。",
      ],
    },
  });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(payload),
    }), { status: 200 }),
  });

  assert.equal(draft.status, "completed");
  assert.doesNotMatch(
    visibleDraftText(draft),
    /best seller|FDA certified|five-star|better than other products|medical grade|lifetime warranty|stainless steel|12-hour battery runtime|guaranteed|refund|最高|최고|el mejor/iu,
  );
  assert.doesNotMatch(
    visibleChineseDisplayText(draft),
    /最佳|FDA认证|五星好评|优于其他竞品|医疗级|终身质保|不锈钢|12小时电池续航|保证|退款/u,
  );
});

test("platform V1 preserves an exact-evidence compatibility claim", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
    productDescription: "Compatible with Reel X.",
  };
  const payload = makeValidPlatformV1Draft({
    description: "Compatible with Reel X.",
  });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(payload),
    }), { status: 200 }),
  });

  assert.match(draft.description, /Compatible with Reel X/iu);
});

test("platform V1 does not fail on blocking words stored only in non-public metadata", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
    productName: "Fishing Lure",
    skuTitle: "Best Seller Fishing Lure",
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidPlatformV1Draft()),
    }), { status: 200 }),
  });

  assert.equal(draft.status, "completed");
  assert.doesNotMatch(visibleDraftText(draft), /best seller/iu);
});

test("platform V1 repairs required bilingual text emptied by blocking-claim cleanup", async () => {
  const source = {
    ...standardSource,
    platformPolicyId: "etsy",
    forceV1: true,
    productName: "Fishing Lure",
    skuTitle: "Fishing Lure",
  };
  const payload = makeValidPlatformV1Draft({
    title: "Best Seller",
    sellingPoints: [],
    painPoints: [],
    fiveBullets: [],
    description: "Guaranteed",
    backendSearchTerms: "",
    keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
    zhDisplay: {
      title: "最佳",
      sellingPoints: [],
      painPoints: [],
      fiveBullets: [],
      description: "保证",
      backendSearchTerms: "",
      keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
    },
  });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(payload),
    }), { status: 200 }),
  });

  assert.equal(draft.title, "Fishing Lure");
  assert.equal(draft.description, "Fishing Lure");
  assert.equal(draft.zhDisplay.title, "商品");
  assert.equal(draft.zhDisplay.description, "商品");
  assert.doesNotMatch(`${visibleDraftText(draft)}\n${visibleChineseDisplayText(draft)}`, /best seller|guaranteed|最佳|保证/iu);
});

test("platform V1 accepts missing bilingual body content after low-risk cleanup", async () => {
  let requestCount = 0;
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
    },
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          ...makeValidDraft(),
          zhDisplay: {
            title: "2 件装蓝色路亚鱼饵",
            sellingPoints: ["蓝色鱼饵主体。"],
            painPoints: ["包装内含两个鱼饵。"],
            fiveBullets: ["产品类型：蓝色路亚鱼饵。"],
            description: "",
            backendSearchTerms: "蓝色 路亚 鱼饵",
            keywordBuckets: {
              exact: ["蓝色路亚鱼饵"],
              longTail: [],
              traffic: [],
              descriptive: [],
            },
          },
        }),
      }), { status: 200 });
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(draft.status, "completed");
  assert.equal(draft.zhDisplay.description, "");
});

test("platform V1 retains supported buyer value across non-title fields", async () => {
  const titleValuePayload = {
    title: "1 Pack Travel Bottle Flip Lid Helps Keep Opening Covered Between Sips",
    sellingPoints: [
      "The flip lid keeps the opening covered between sips, limiting everyday contact with the drinking surface.",
      "The compact bottle profile takes up less room in a daily carry bag.",
      "The slim body is easy to hold while commuting or walking.",
      "The single-bottle pack makes the included quantity clear before purchase.",
    ],
    painPoints: [
      "An exposed opening between sips can collect everyday contact; the flip lid keeps the drinking surface covered.",
      "Bulky drinkware can crowd a daily bag; the compact profile uses less carry space.",
      "Unclear pack quantities make option selection harder; this pack contains one travel bottle.",
    ],
    fiveBullets: [
      "BETWEEN SIPS: The flip lid keeps the drinking opening covered when the bottle is not in use.",
      "COMPACT CARRY: The compact profile uses less room in a daily carry bag.",
      "DAILY USE: The slim body is easy to hold while commuting or walking.",
      "FLIP LID: The supplied bottle uses a flip-lid top and compact body construction.",
      "IN THE BOX: The package contains one travel bottle.",
    ],
    description: "This compact travel bottle keeps daily hydration close without taking over a carry bag. Its slim body is easy to hold, while the flip lid keeps the drinking opening covered between sips. The package contains one bottle.",
    backendSearchTerms: "travel bottle flip lid compact bottle",
    keywordBuckets: {
      exact: ["travel bottle"],
      longTail: ["compact flip lid bottle"],
      traffic: ["drink bottle"],
      descriptive: ["compact bottle"],
    },
    packageDimensions: "Estimated: 6 x 4 x 10 in (15.2 x 10.2 x 25.4 cm)",
    productDimensions: "3.5 in (8.9 cm) long",
    zhDisplay: {
      title: "1 件装旅行水瓶 翻盖有助于在饮水间隔保持瓶口覆盖",
      sellingPoints: [
        "翻盖可在两次饮水之间保持瓶口覆盖，减少饮水表面的日常接触。",
        "紧凑瓶身可减少日常随身包内的空间占用。",
        "纤细瓶身便于通勤或步行时握持。",
        "单瓶装让包装数量在购买前清晰明确。",
      ],
      painPoints: [
        "两次饮水之间裸露的饮水口容易接触外部物体，翻盖可保持饮水表面覆盖。",
        "体积较大的饮水容器容易占满日常随身包，紧凑瓶身可减少携带空间占用。",
        "包装数量不清会增加选项判断难度，此包装内含一个旅行水瓶。",
      ],
      fiveBullets: [
        "饮水间隔：不使用水瓶时，翻盖可保持饮水口覆盖。",
        "紧凑携带：紧凑瓶身可减少日常随身包内的空间占用。",
        "日常使用：纤细瓶身便于通勤或步行时握持。",
        "翻盖结构：资料显示该水瓶采用翻盖顶部和紧凑瓶身结构。",
        "包装内容：包装内含一个旅行水瓶。",
      ],
      description: "这款紧凑旅行水瓶可满足日常补水需求，同时减少随身包内的空间占用。纤细瓶身便于握持，翻盖可在两次饮水之间保持饮水口覆盖。包装内含一个水瓶。",
      backendSearchTerms: "旅行水瓶 翻盖 紧凑 水瓶",
      keywordBuckets: {
        exact: ["旅行水瓶"],
        longTail: ["紧凑型翻盖水瓶"],
        traffic: ["饮水瓶"],
        descriptive: ["紧凑水瓶"],
      },
      packageDimensions: "预估：15.2 x 10.2 x 25.4 厘米（6 x 4 x 10 英寸）",
      productDimensions: "长度 8.9 厘米（3.5 英寸）",
    },
  };
  const calls = [];
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      skuBundleCount: 1,
      productDescription: "Compact travel bottle with a slim body for a daily carry bag, commuting, or walking. The flip lid helps keep the opening covered between sips. One bottle is included.",
      sellingPoints: [
        "Compact profile takes up less room in a daily carry bag.",
        "Slim body is easy to hold while commuting or walking.",
        "Flip lid helps keep the opening covered between sips.",
      ],
    },
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body).input);
      return new Response(JSON.stringify({
        output_text: JSON.stringify(titleValuePayload),
      }), { status: 200 });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(draft.title, /helps keep opening covered/i);
  assert.match(draft.zhDisplay.title, /有助于.*保持瓶口覆盖/u);
  assert.match(draft.sellingPoints.join("\n"), /keeps the opening covered|takes up less room/i);
  assert.match(draft.painPoints.join("\n"), /exposed opening|bulky drinkware/i);
  assert.match(draft.fiveBullets[0], /^BETWEEN SIPS:/);
  assert.doesNotMatch(draft.title, /Product Details/i);

  const sanitizedSparseDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      skuBundleCount: 1,
      productDescription: "Travel bottle with a flip lid that helps keep the opening covered between sips.",
      sellingPoints: ["Flip lid helps keep the opening covered between sips."],
    },
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(titleValuePayload),
    }), { status: 200 }),
  });
  assert.match(visibleDraftText(sanitizedSparseDraft), /flip[- ]lid/i);
  assert.doesNotMatch(visibleDraftText(sanitizedSparseDraft), /\b(?:compact|slim|commuting|walking)\b|daily carry bag/i);

  const legacyBulletDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      skuBundleCount: 1,
      productDescription: "Compact travel bottle with a slim body for a daily carry bag, commuting, or walking. The flip lid helps keep the opening covered between sips. One bottle is included.",
      sellingPoints: ["Compact profile", "Slim body", "Flip lid"],
    },
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify({
        ...titleValuePayload,
        fiveBullets: [
          "PRODUCT TYPE: Compact travel bottle with a flip lid.",
          "PACK DETAILS: The package contains one travel bottle.",
          "VISIBLE DETAILS: The bottle has a compact profile and slim body.",
          "SPECIFICATIONS: The supplied bottle uses a flip-lid top.",
          "PACKAGE CONTENTS: One travel bottle is included.",
        ],
      }),
    }), { status: 200 }),
  });
  assert.match(legacyBulletDraft.fiveBullets[0], /^PRODUCT TYPE:/u);

  const unsupportedComparisonPayload = {
    ...titleValuePayload,
    sellingPoints: ["Unlike competitors, this bottle solves the opening-exposure problem better than other products."],
  };
  const sanitizedComparisonDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      skuBundleCount: 1,
      productDescription: "Travel bottle with a flip lid that helps keep the opening covered between sips.",
      sellingPoints: ["Flip lid helps keep the opening covered between sips."],
    },
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(unsupportedComparisonPayload),
    }), { status: 200 }),
  });
  assert.doesNotMatch(
    visibleDraftText(sanitizedComparisonDraft),
    /unlike competitors|better than other products/iu,
  );

  for (const [englishComparison, chineseComparison] of [
    ["Most alternatives leave the opening exposed.", titleValuePayload.zhDisplay.sellingPoints[0]],
    [titleValuePayload.sellingPoints[0], "普通同类产品只有单一开口保护方式。"],
  ]) {
    const sanitizedComparisonLanguageDraft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: {
        ...standardSource,
        platformPolicyId: "etsy",
        forceV1: true,
        productName: "Travel Bottle",
        skuBundleCount: 1,
        productDescription: "Compact travel bottle with a slim body for a daily carry bag, commuting, or walking. The flip lid helps keep the opening covered between sips. One bottle is included.",
        sellingPoints: ["Compact profile", "Slim body", "Flip lid"],
      },
      fetchImpl: async () => new Response(JSON.stringify({
        output_text: JSON.stringify({
          ...titleValuePayload,
          sellingPoints: [englishComparison, ...titleValuePayload.sellingPoints.slice(1)],
          zhDisplay: {
            ...titleValuePayload.zhDisplay,
            sellingPoints: [chineseComparison, ...titleValuePayload.zhDisplay.sellingPoints.slice(1)],
          },
        }),
      }), { status: 200 }),
    });
    assert.doesNotMatch(visibleDraftText(sanitizedComparisonLanguageDraft), /most alternatives leave/iu);
    assert.doesNotMatch(visibleChineseDisplayText(sanitizedComparisonLanguageDraft), /普通同类产品只有/u);
  }

  const sanitizedTitleDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      skuBundleCount: 1,
      productDescription: "Travel bottle with a flip lid that helps keep the opening covered between sips.",
      sellingPoints: ["Flip lid helps keep the opening covered between sips."],
    },
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify({
        ...titleValuePayload,
        title: "1 Pack Best Seller Travel Bottle With Guaranteed Performance",
      }),
    }), { status: 200 }),
  });
  assert.match(sanitizedTitleDraft.title, /Travel Bottle/iu);
  assert.doesNotMatch(sanitizedTitleDraft.title, /Best Seller|Guaranteed/iu);
});

test("explicit Platform V1 mock uses bounded buyer decision evidence for value copy", async () => {
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "amazon",
      forceV1: true,
      productName: "Thermal Imaging Scope",
      skuBundleCount: 1,
      productDescription: "Thermal imaging scope with thermal and night-vision modes.",
      buyerDecisionEvidence: [{
        sourceRole: "benefit",
        buyerContext: "Buyers comparing visibility options for changing light conditions.",
        buyerFriction: "A single viewing mode can limit decisions in changing light conditions.",
        supportedValue: "Thermal and night-vision modes provide two viewing options.",
        evidenceFocus: "The product information lists thermal imaging and night-vision modes.",
      }],
    },
    mock: true,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "temporary upstream error" } }), { status: 503 }),
  });

  assert.match(draft.sellingPoints.join("\n"), /thermal and night-vision modes|two viewing options/i);
  assert.match(draft.painPoints.join("\n"), /single viewing mode|changing light conditions/i);
  assert.equal(draft.fiveBullets.length, 5);
  assert.doesNotMatch(draft.fiveBullets.join("\n"), /^PRODUCT TYPE:|^PACK DETAILS:|^VISIBLE DETAILS:|^SPECIFICATIONS:|^PACKAGE CONTENTS:/m);
});

test("explicit Platform V1 mock localizes Chinese thermal scope evidence without leaking Chinese into English fields", async () => {
  const [draft] = await generateCreationListingDrafts({
    set: {
      setId: "set-localized-thermal-scope-fallback",
      platformPolicyId: "universal",
      productName: "热成像红外夜视瞄准镜",
      targetLanguage: "en",
      referenceImageRoles: [
        {
          filename: "modes.jpg",
          role: "material",
          note: "展示热成像、黑白夜视、HD模式及热成像与夜视组合功能。",
        },
        {
          filename: "fov.jpg",
          role: "dimensions",
          note: "标示热成像视场25°、红外夜视视场13°、观察距离220 yards、11 PALETTES和60Hz REFRESH。",
        },
        {
          filename: "controls.jpg",
          role: "usage",
          note: "展示物镜调焦、视度调节、4-Inch Eye Relief、热成像传感器、红外照明器、显示屏、硅胶眼罩和十字线调节。",
        },
      ],
      items: [{
        itemId: "benefit",
        role: "benefit",
        conversionIntent: {
          audienceFocus: "需要在夜间进行目标搜索与细节观察的买家。",
          motivationFocus: "希望一台瞄准镜兼具热成像搜索与红外夜视细节确认。",
          objectionFocus: "单一观察模式在光线变化时选择有限。",
          evidenceFocus: "参考图展示25°热成像视场与13°夜视视场。",
        },
      }],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    mock: true,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "temporary upstream error" } }), { status: 503 }),
  });

  const englishText = [
    draft.title,
    ...draft.sellingPoints,
    ...draft.painPoints,
    ...draft.fiveBullets,
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets).flat(),
  ].join("\n");
  assert.match(draft.title, /Thermal Imaging Infrared Night Vision Scope/i);
  assert.ok(Array.from(draft.title).length >= 120);
  assert.ok(Array.from(draft.title).length <= 200);
  assert.match(
    draft.title,
    /^1 Pack Thermal Imaging Infrared Night Vision Scope Wide Thermal Search and Night Detail Confirmation/u,
  );
  assert.match(
    draft.title,
    /Objective Focus.*Diopter Adjustment.*Infrared Illuminator.*Silicone Eyecup/i,
  );
  assert.doesNotMatch(draft.title, /Product Product Details/i);
  assert.doesNotMatch(englishText, /[\u3400-\u9fff]/u);
  assert.match(draft.sellingPoints.join("\n"), /25° thermal|13° night-vision|60Hz/i);
  assert.match(draft.painPoints.join("\n"), /different views|single viewing mode|image adjustment/i);
  assert.equal(draft.sellingPoints.length, 5);
  assert.equal(draft.painPoints.length, 4);
  assert.equal(draft.fiveBullets.length, 5);
  assert.ok(draft.description.length <= 500);
  assert.match(draft.description, /Package quantity: 1 Pack$/i);
  assert.doesNotMatch(draft.fiveBullets.join("\n"), /^PRODUCT TYPE:|^PACK DETAILS:|^VISIBLE DETAILS:|^SPECIFICATIONS:|^PACKAGE CONTENTS:/m);
  assert.deepEqual(
    draft.fiveBullets.map((item) => item.split(":", 1)[0]),
    ["DUAL VIEW", "VIEWING MODES", "LIGHT CONDITIONS", "IMAGE SETTINGS", "PACK QUANTITY"],
  );
  assert.match(draft.fiveBullets[0], /25° thermal.*13° night-vision/i);
  assert.match(draft.fiveBullets[1], /black-and-white night vision.*HD mode/i);
  assert.match(draft.fiveBullets[2], /light conditions/i);
  assert.match(draft.fiveBullets[3], /objective focus.*diopter.*11 thermal palettes.*60Hz/i);
  assert.match(draft.fiveBullets[4], /1 Pack/i);
  assert.match(draft.zhDisplay.title, /热成像红外夜视瞄准镜/u);
  assert.match(draft.zhDisplay.title, /热成像广域搜索与夜视细节确认.*物镜调焦.*视度调节.*红外照明器.*硅胶眼罩/u);
  assert.equal(draft.zhDisplay.sellingPoints.length, draft.sellingPoints.length);
  assert.equal(draft.zhDisplay.painPoints.length, draft.painPoints.length);
  assert.equal(draft.zhDisplay.fiveBullets.length, draft.fiveBullets.length);
  assert.deepEqual(
    draft.zhDisplay.fiveBullets.map((item) => item.split(/[:：]/u, 1)[0]),
    ["双视场", "观察模式", "光线场景", "图像设置", "包装数量"],
  );
  assert.match(draft.zhDisplay.description, /十字线调节.*1件装/u);
});

test("localized thermal scope mock omits viewing and control claims missing from reference evidence", async () => {
  const [draft] = await generateCreationListingDrafts({
    set: {
      setId: "set-localized-thermal-scope-minimal-evidence",
      platformPolicyId: "universal",
      productName: "热成像红外夜视瞄准镜",
      targetLanguage: "en",
      referenceImageRoles: [
        {
          filename: "fov.jpg",
          role: "dimensions",
          note: "标示热成像视场25°、红外夜视视场13°、11 PALETTES和60Hz REFRESH。",
        },
        {
          filename: "controls.jpg",
          role: "usage",
          note: "展示物镜调焦、视度调节、热成像传感器、红外照明器、显示屏和硅胶眼罩。",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    mock: true,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "temporary upstream error" } }), { status: 503 }),
  });

  const englishText = [
    draft.title,
    ...draft.sellingPoints,
    ...draft.painPoints,
    ...draft.fiveBullets,
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets).flat(),
  ].join("\n");
  const chineseText = [
    draft.zhDisplay.title,
    ...draft.zhDisplay.sellingPoints,
    ...draft.zhDisplay.painPoints,
    ...draft.zhDisplay.fiveBullets,
    draft.zhDisplay.description,
    draft.zhDisplay.backendSearchTerms,
    ...Object.values(draft.zhDisplay.keywordBuckets).flat(),
  ].join("\n");

  assert.doesNotMatch(englishText, /black-and-white|HD mode|three viewing|reticle|objective lens|broad search|detail confirmation/i);
  assert.doesNotMatch(chineseText, /黑白夜视|HD模式|三种观察|十字线|广域搜索|细节确认/u);
  assert.ok(Array.from(draft.title).length >= 120);
  assert.ok(Array.from(draft.title).length <= 200);
  assert.match(
    draft.title,
    /Two Viewing Modes.*Objective Focus.*Diopter Adjustment.*Infrared Illuminator.*Silicone Eyecup/i,
  );
  assert.match(draft.fiveBullets[4], /^PACK QUANTITY:.*1 Pack/i);
  assert.match(draft.zhDisplay.fiveBullets[4], /^包装数量[:：].*1件装/u);
});

test("platform V1 fallback keeps the trusted parent identity when a SKU title is generic", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-parent-identity-over-generic-sku",
    platformPolicyId: "universal",
    forceV1: true,
    parentProductName: "热成像红外夜视瞄准镜",
    productName: "1 SKU 1 SKU",
    skuTitle: "1 SKU 1 SKU",
    skuPackQuantityText: "1 Pack",
    listingEvidenceAliases: [
      "Thermal Imaging Infrared Night Vision Scope",
      "thermal imaging",
      "infrared night vision",
      "25° thermal field of view",
      "13° night-vision field of view",
      "11 thermal palettes",
      "60Hz refresh rate",
      "objective focus adjustment",
      "diopter adjustment",
      "thermal sensor",
      "infrared illuminator",
      "display",
      "silicone eyecup",
    ],
    buyerDecisionEvidence: [{
      buyerContext: "Buyers comparing thermal search and night detail viewing.",
      buyerFriction: "A single viewing mode can limit decisions in changing light.",
      supportedValue: "Thermal and night-vision modes provide two viewing options.",
      evidenceFocus: "The supplied product information lists thermal imaging and infrared night vision.",
    }],
  });

  assert.match(draft.title, /Thermal Imaging Infrared Night Vision Scope/i);
  assert.doesNotMatch(draft.title, /1 SKU 1 SKU/i);
  assert.match(draft.fiveBullets[0], /^DUAL VIEW:/u);
  assert.match(draft.fiveBullets[4], /^PACK QUANTITY:.*1 Pack/u);
  assert.match(draft.zhDisplay.title, /热成像红外夜视瞄准镜/u);
  assert.doesNotMatch(visibleChineseDisplayText(draft), /1 SKU 1 SKU/u);
});

test("platform V1 fallback does not fill sparse product evidence with unsupplied attribute groups", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-sparse-travel-bottle",
    platformPolicyId: "universal",
    forceV1: true,
    productName: "Travel Bottle",
    skuBundleCount: 1,
  });
  const publicText = visibleDraftText(draft);

  assert.match(publicText, /Travel Bottle/i);
  assert.match(publicText, /1 Pack/i);
  assert.doesNotMatch(
    publicText,
    /listed color|listed shape|stated dimensions|dimension details|listed variants|variant details|package contents follow|size and option details/i,
  );
});

test("platform V1 fallback avoids duplicate Product title segments for unknown Chinese categories", () => {
  const draft = makeMockCreationListingDraft({
    ...standardSource,
    forceV1: true,
    productName: "未知商品类别",
    skuTitle: "",
    dimensionSpecs: "",
    skuBundleCount: 1,
    buyerDecisionEvidence: [{
      buyerContext: "中文买家场景。",
      buyerFriction: "中文购买顾虑。",
      supportedValue: "中文卖点。",
      evidenceFocus: "中文事实说明。",
    }],
  });

  const englishText = [draft.title, ...draft.sellingPoints, ...draft.painPoints, ...draft.fiveBullets, draft.description].join("\n");
  assert.match(draft.title, /^1 Pack Product Details$/i);
  assert.doesNotMatch(draft.title, /Product Product/i);
  assert.doesNotMatch(englishText, /[\u3400-\u9fff]/u);
});

test("platform V1 accepts interrogative pain points in either display language", async () => {
  const basePayload = {
    title: "2 Pack Fishing Lure Blue Compact Body",
    sellingPoints: ["The two blue lures have compact bodies."],
    painPoints: ["The 2 Pack contains two fishing lures."],
    fiveBullets: [
      "PRODUCT TYPE: These are blue fishing lures.",
      "PACK DETAILS: The pack contains two fishing lures.",
      "VISIBLE DETAILS: Both lures have blue compact bodies.",
      "SPECIFICATIONS: The stated length is 3.5 inches.",
      "PACKAGE CONTENTS: Two fishing lures are included.",
    ],
    description: "This 2 Pack contains two blue fishing lures with compact bodies and a stated length of 3.5 inches.",
    backendSearchTerms: "blue fishing lure compact bait",
    keywordBuckets: {
      exact: ["fishing lure"],
      longTail: ["2 pack blue fishing lure"],
      traffic: ["freshwater bait"],
      descriptive: ["compact blue lure"],
    },
    packageDimensions: "Estimated: 6 x 4 x 2 in (15.2 x 10.2 x 5.1 cm)",
    productDimensions: "3.5 in (8.9 cm) long",
    zhDisplay: {
      title: "2件装 蓝色紧凑型路亚鱼饵",
      sellingPoints: ["两个蓝色路亚鱼饵均为紧凑型饵身。"],
      painPoints: ["2件装内含2个路亚鱼饵。"],
      fiveBullets: [
        "PRODUCT TYPE: 这是蓝色路亚鱼饵。",
        "PACK DETAILS: 包装内含2个路亚鱼饵。",
        "VISIBLE DETAILS: 两个鱼饵均为蓝色紧凑型饵身。",
        "SPECIFICATIONS: 标示长度为3.5英寸。",
        "PACKAGE CONTENTS: 包装内含2个路亚鱼饵。",
      ],
      description: "这款2件装产品内含2个蓝色紧凑型路亚鱼饵，标示长度为3.5英寸。",
      backendSearchTerms: "蓝色 路亚鱼饵 紧凑 鱼饵",
      keywordBuckets: {
        exact: ["路亚鱼饵"],
        longTail: ["2件装蓝色路亚鱼饵"],
        traffic: ["淡水鱼饵"],
        descriptive: ["蓝色紧凑鱼饵"],
      },
      packageDimensions: "预估：15.2 x 10.2 x 5.1 厘米（6 x 4 x 2 英寸）",
      productDimensions: "长度 8.9 厘米（3.5 英寸）",
    },
  };
  const cases = [
    {
      painPoints: ["How many lures are included? The 2 Pack contains two fishing lures."],
      zhPainPoints: basePayload.zhDisplay.painPoints,
    },
    {
      painPoints: basePayload.painPoints,
      zhPainPoints: ["内含多少个路亚鱼饵？2件装内含2个路亚鱼饵。"],
    },
  ];

  for (const entry of cases) {
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: {
        ...standardSource,
        platformPolicyId: "etsy",
        forceV1: true,
      },
      fetchImpl: async () => new Response(JSON.stringify({
        output_text: JSON.stringify({
          ...basePayload,
          painPoints: entry.painPoints,
          zhDisplay: {
            ...basePayload.zhDisplay,
            painPoints: entry.zhPainPoints,
          },
        }),
      }), { status: 200 }),
    });
    assert.match([draft.painPoints, draft.zhDisplay.painPoints].flat().join("\n"), /[?？]/u);
  }
});

test("platform V1 surfaces upstream and response parsing failures without mock drafts", async () => {
  const cases = [
    {
      expected: /temporary upstream failure/i,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "temporary upstream failure" },
      }), { status: 503 }),
    },
    {
      expected: /parse|JSON/i,
      fetchImpl: async () => new Response(JSON.stringify({
        output_text: "{not-json",
      }), { status: 200 }),
    },
  ];

  for (const entry of cases) {
    await assert.rejects(
      requestCreationListingDraft({
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        responsesModel: "gpt-5.4",
        source: {
          ...standardSource,
          platformPolicyId: "etsy",
          forceV1: true,
          productName: "Travel Bottle",
        },
        fetchImpl: entry.fetchImpl,
      }),
      entry.expected,
    );
  }
});

const listingResponseBoundarySourceCases = [
  {
    name: "V1",
    source: { ...standardSource, platformPolicyId: "etsy", forceV1: true },
  },
  {
    name: "V2",
    source: { ...standardSource, platformPolicyId: "universal", forceV2: true },
  },
];

const usableListingResponseError = "Listing response did not contain a usable Listing object.";

test("V1 and V2 accept recognized minimal Listing fields without local completeness gates", async () => {
  const acceptedCases = [
    {
      name: "V1 top-level title",
      source: listingResponseBoundarySourceCases[0].source,
      payload: { title: "Travel Bottle" },
      assertDraft(draft) {
        assert.equal(draft.title, "Travel Bottle");
      },
    },
    {
      name: "V1 zhDisplay title",
      source: listingResponseBoundarySourceCases[0].source,
      payload: { zhDisplay: { title: "旅行水瓶" } },
      assertDraft(draft) {
        assert.equal(draft.zhDisplay?.title, "旅行水瓶");
      },
    },
    {
      name: "V2 top-level title",
      source: listingResponseBoundarySourceCases[1].source,
      payload: { title: "Travel Bottle" },
      assertDraft(draft) {
        assert.equal(draft.title, "Travel Bottle");
      },
    },
    {
      name: "V2 zhDisplay title",
      source: listingResponseBoundarySourceCases[1].source,
      payload: { zhDisplay: { title: "旅行水瓶" } },
      assertDraft(draft) {
        assert.equal(draft.zhDisplay?.title, "旅行水瓶");
      },
    },
  ];

  for (const entry of acceptedCases) {
    let requestCount = 0;
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: entry.source,
      fetchImpl: async () => {
        requestCount += 1;
        return new Response(JSON.stringify(entry.payload), { status: 200 });
      },
    });

    assert.equal(requestCount, 1, entry.name);
    assert.equal(draft.status, "completed", entry.name);
    entry.assertDraft(draft);
  }
});

test("Listing response retries once after an empty, non-object, or unrecognized response before accepting V1 and V2", async () => {
  const unusableResponses = [
    { name: "empty object", payload: {} },
    { name: "unrecognized object", payload: { upstreamListing: "returned directly" } },
    { name: "misspelled top-level Listing field", payload: { titel: "Travel Bottle" } },
    { name: "misspelled zhDisplay Listing field", payload: { zhDisplay: { titel: "旅行水瓶" } } },
    { name: "array", payload: [] },
    { name: "null", payload: null },
    { name: "string", payload: "not a Listing" },
    { name: "number", payload: 42 },
  ];

  for (const sourceCase of listingResponseBoundarySourceCases) {
    for (const unusableResponse of unusableResponses) {
      let requestCount = 0;
      const prompts = [];
      const draft = await requestCreationListingDraft({
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        responsesModel: "gpt-5.4",
        source: sourceCase.source,
        fetchImpl: async (_url, init) => {
          requestCount += 1;
          prompts.push(JSON.parse(init.body).input);
          const payload = requestCount === 1
            ? unusableResponse.payload
            : { title: "Travel Bottle" };
          return new Response(JSON.stringify(payload), { status: 200 });
        },
      });

      const label = `${sourceCase.name}: ${unusableResponse.name}`;
      assert.equal(requestCount, 2, label);
      assert.equal(draft.status, "completed", label);
      assert.equal(draft.title, "Travel Bottle", label);
      assert.match(prompts[1], /previous response did not return a usable Listing JSON object/i, label);
      assert.doesNotMatch(prompts[1], /Fix these validation errors|title must start with quantity/i, label);
    }
  }
});

test("Listing response rejects after two unusable values in V1 and V2", async () => {
  const unusableResponses = [
    { name: "empty object", payload: {} },
    { name: "unrecognized object", payload: { upstreamListing: "returned directly" } },
    { name: "array", payload: [] },
    { name: "null", payload: null },
    { name: "string", payload: "not a Listing" },
    { name: "number", payload: 42 },
  ];

  for (const sourceCase of listingResponseBoundarySourceCases) {
    for (const unusableResponse of unusableResponses) {
      let requestCount = 0;
      const label = `${sourceCase.name}: ${unusableResponse.name}`;
      await assert.rejects(
        requestCreationListingDraft({
          baseUrl: "https://example.test/v1",
          apiKey: "test-key",
          responsesModel: "gpt-5.4",
          source: sourceCase.source,
          fetchImpl: async () => {
            requestCount += 1;
            return new Response(JSON.stringify(unusableResponse.payload), { status: 200 });
          },
        }),
        (error) => {
          assert.equal(error.message, usableListingResponseError, label);
          return true;
        },
      );
      assert.equal(requestCount, 2, label);
    }
  }
});

test("Listing response retries after empty and whitespace HTTP bodies", async () => {
  const bodyCases = [
    { name: "V1 empty body", source: listingResponseBoundarySourceCases[0].source, firstBody: "" },
    { name: "V2 whitespace body", source: listingResponseBoundarySourceCases[1].source, firstBody: " \r\n\t " },
  ];

  for (const entry of bodyCases) {
    let requestCount = 0;
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: entry.source,
      fetchImpl: async () => {
        requestCount += 1;
        const body = requestCount === 1
          ? entry.firstBody
          : JSON.stringify({ title: "Travel Bottle" });
        return new Response(body, { status: 200 });
      },
    });

    assert.equal(requestCount, 2, entry.name);
    assert.equal(draft.status, "completed", entry.name);
    assert.equal(draft.title, "Travel Bottle", entry.name);
  }
});

test("Listing response extraction prefers direct Listing objects and later usable output chunks", async () => {
  let directRequestCount = 0;
  const directDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: listingResponseBoundarySourceCases[0].source,
    fetchImpl: async () => {
      directRequestCount += 1;
      return new Response(JSON.stringify({
        title: "Direct Travel Bottle",
        content: "incidental non-Listing response content",
      }), { status: 200 });
    },
  });

  assert.equal(directRequestCount, 1);
  assert.equal(directDraft.status, "completed");
  assert.equal(directDraft.title, "Direct Travel Bottle");

  let chunkedRequestCount = 0;
  const chunkedDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: listingResponseBoundarySourceCases[1].source,
    fetchImpl: async () => {
      chunkedRequestCount += 1;
      return new Response(JSON.stringify({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify({}) }],
          },
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify({ title: "Travel Bottle" }) }],
          },
        ],
      }), { status: 200 });
    },
  });

  assert.equal(chunkedRequestCount, 1);
  assert.equal(chunkedDraft.status, "completed");
  assert.equal(chunkedDraft.title, "Travel Bottle");
});

test("platform V2 surfaces transient upstream failures without deterministic drafts", async () => {
  await assert.rejects(
    requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: {
        ...standardSource,
        platformPolicyId: "universal",
        forceV2: true,
      },
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "transient V2 upstream failure" },
      }), { status: 503 }),
    }),
    /transient V2 upstream failure/i,
  );
});

test("application Listing generation accepts one incomplete parsed response without mock output", async () => {
  let requestCount = 0;
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-incomplete-direct",
      platformPolicyId: "etsy",
      productName: "Travel Bottle",
      productDescription: "Compact bottle for daily travel.",
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key" },
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          title: "Travel Bottle",
          sellingPoints: [],
          painPoints: [],
          fiveBullets: [],
          description: "",
          backendSearchTerms: "",
          keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
          zhDisplay: {
            title: "旅行水瓶",
            sellingPoints: [],
            painPoints: [],
            fiveBullets: [],
            description: "",
            backendSearchTerms: "",
            keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
          },
        }),
      }), { status: 200 });
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].packageDimensions, /^Estimated: \d+(?:\.\d+)? x \d+(?:\.\d+)? x \d+(?:\.\d+)? cm \(/u);
  assert.equal(drafts[0].productDimensions, "");
});

test("generateCreationListingDrafts keeps metric and imperial specs out of mock titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-dual-units",
      productName: "Electric Fishing Lure",
      productDescription: "Jointed lure with LED light and rechargeable battery",
      dimensionSpecs: "13cm/42g",
      dimensionUnitMode: "both",
      skuBundleCount: 1,
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^1 Pack Electric Fishing Lure\b/);
  assert.doesNotMatch(drafts[0].title, /13cm|5\.12 in|42g|1\.48 oz/i);
});

test("generateCreationListingDrafts uses grouped SKU subject unit count and search terms in titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-three-lures",
      productName: "Electronic Fishing Lure",
      productDescription: "One sellable SKU image contains three complete lure bodies with LED light and propeller action.",
      sellingPoints: ["auto-activated light", "propeller action", "multi-section swimbait"],
      dimensionSpecs: "Hook Size 4#, 130 mm, 35 g",
      skuBundleCount: 1,
      skuSubjects: [
        {
          id: "three-lures.png",
          title: "Silver lure / Gold lure / Green lure",
          filenames: ["three-lures.png"],
          referenceIndexes: [1],
          subjectUnitCount: 3,
          note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^3 Pack Electronic Fishing Lure\b/);
  assert.doesNotMatch(drafts[0].title, /130\s*mm|35\s*g|hook size|4#/i);
  assert.match(drafts[0].backendSearchTerms, /\belectronic fishing lure\b/i);
  assert.deepEqual(drafts[0].keywordBuckets.exact, ["Electronic Fishing Lure"]);
});

test("generateCreationListingDrafts honors set-level same-SKU pack counts for grouped subjects", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-two-three-lure-groups",
      productName: "Electronic Fishing Lure",
      productDescription: "One grouped SKU subject contains three complete lure bodies and is sold as two identical grouped sets.",
      skuBundleCount: 2,
      skuSubjects: [
        {
          id: "three-lures.png",
          title: "Three lure colorways",
          filenames: ["three-lures.png"],
          subjectUnitCount: 3,
          note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^6 Pack Electronic Fishing Lure\b/);
});

test("generateCreationListingDrafts uses visible subject unit count for swimbait titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-four-swimbaits",
      productName: "Swimbait Lure",
      productDescription: "One product subject reference contains four complete lure colorways.",
      dimensionSpecs: "160 mm, 50.4 g, Hook Size #2",
      skuBundleCount: 1,
      skuSubjects: [
        {
          id: "four-swimbaits.png",
          title: "Four swimbait lure colorways",
          filenames: ["four-swimbaits.png"],
          referenceIndexes: [1],
          subjectUnitCount: 4,
          note: "4 complete visible product units in one grouped SKU subject.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^4 Pack Swimbait Lure\b/);
  assert.doesNotMatch(drafts[0].title, /160\s*mm|50\.4\s*g|hook size|#2|6\.3 in|1\.78 oz/i);
});

test("generateCreationListingDrafts writes mixed grouped SKU quantities as slash pack titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-mixed-lure-packs",
      productName: "Electronic Fishing Lure",
      productDescription: "Two grouped SKU subjects represent two-pack and three-pack choices.",
      sellingPoints: ["propeller action", "multi-color grouped choices"],
      skuBundleCount: 1,
      skuSubjects: [
        {
          id: "two-lures.png",
          title: "Two lure colorways",
          filenames: ["two-lures.png"],
          subjectUnitCount: 2,
          note: "2 complete visible product units in one grouped SKU subject.",
        },
        {
          id: "three-lures.png",
          title: "Three lure colorways",
          filenames: ["three-lures.png"],
          subjectUnitCount: 3,
          note: "3 complete visible product units in one grouped SKU subject.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack \/ 3 Pack Electronic Fishing Lure\b/);
});

test("mock listing drafts describe grouped two-unit subjects", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-two-lure-pair",
    productName: "Fishing Lure",
    productDescription: "One product-subject reference image contains two complete visible lure bodies.",
    skuBundleCount: 1,
    dimensionSpecs: "3.5 in",
    evidenceMode: "input-only",
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  });

  assert.match(draft.title, /^2 Pack Fishing Lure\b/);
  assert.match(draft.description, /two complete visible lure bodies/i);
  assert.equal(validateListingAgentDraft(draft, "2 Pack").ok, true);
});

test("mock listing drafts avoid unsupported claims and competitor brand terms", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-unsafe",
    productName: "Amazon FDA Certified Best Fishing Lure",
    skuTitle: "Walmart Medical Grade Warranty Lure",
    skuBundleCount: 2,
    dimensionSpecs: "3.5 in",
    evidenceMode: "input-only",
    warnings: [],
  });

  const validation = validateListingAgentDraft(draft, "2 Pack");
  assert.equal(validation.ok, true);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:amazon|walmart|temu|ebay|etsy|target)\b/i);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:FDA Certified|medical grade|guaranteed|best|warranty)\b/i);
});

test("mock mode uses English Amazon-style titles for Chinese source inputs", async () => {
  const source = {
    setId: "set-cn",
    productName: "路亚硬饵",
    skuTitle: "银蓝鳞纹橙红尾电动仿生鱼饵",
    skuBundleCount: 1,
    dimensionSpecs: "13cm/42g",
    industryTemplatePath: "Sports & Outdoors > Fishing > Lures",
    evidenceMode: "image-backed",
    skuSubjects: [
      { id: "silver-blue", title: "银蓝鳞纹橙红尾电动仿生鱼饵", bundleCount: 1 },
      { id: "black-gold", title: "黑金鳞纹电动仿生鱼饵", bundleCount: 1 },
    ],
  };

  const mockDraft = makeMockCreationListingDraft(source);

  assert.match(mockDraft.title, /^1 Pack Electric Fishing Lure\b/);
  assert.doesNotMatch(mockDraft.title, /13cm|42g/i);
  assert.equal(mockDraft.title.includes("Listing Draft"), false);
  assert.equal(mockDraft.title.length <= 200, true);
  assert.doesNotMatch(visibleDraftText(mockDraft), /[\u3400-\u9fff]/u);
  assert.equal(validateListingAgentDraft(mockDraft, "1 Pack").ok, true);
});

test("mock fallback maps a Chinese motorcycle-goggle parent before generic SKU metadata", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-cn-motorcycle-goggles",
    productName: "复古摩托车骑行护目镜",
    skuTitle: "1 SKU 1 SKU",
    skuBundleCount: 1,
    dimensionSpecs: "镜框高77mm，镜框宽180mm",
    evidenceMode: "image-backed",
    skuSubjects: [
      { id: "black-smoke", title: "1 SKU 1 SKU", bundleCount: 1 },
      { id: "brown-smoke", title: "1 SKU 1 SKU", bundleCount: 1 },
    ],
  });

  assert.match(draft.title, /^1 Pack Vintage Motorcycle Riding Goggles\b/u);
  assert.doesNotMatch(visibleDraftText(draft), /1 SKU 1 SKU/u);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("localized motorcycle-goggle mock writes buyer-facing value copy and Amazon-style roles", async () => {
  const [draft] = await generateCreationListingDrafts({
    set: {
      setId: "set-localized-motorcycle-goggles-fallback",
      platformPolicyId: "universal",
      productName: "复古摩托车骑行护目镜",
      targetLanguage: "en",
      skuBundleCount: 1,
      referenceImageRoles: [
        {
          filename: "lens.jpg",
          role: "material",
          note: "PC镜片，180°大视窗，间接通风和防雾涂层。",
        },
        {
          filename: "fit.jpg",
          role: "usage",
          note: "可调节头带、柔软面框和鼻垫，适合户外、越野和骑行场景。",
        },
      ],
      skuSubjects: Array.from({ length: 7 }, (_, index) => ({
        id: `goggle-${index + 1}`,
        title: "1 SKU 1 SKU",
        bundleCount: index === 1 ? 4 : 1,
      })),
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    mock: true,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "temporary upstream error" } }), { status: 503 }),
  });

  const englishText = [
    draft.title,
    ...draft.sellingPoints,
    ...draft.painPoints,
    ...draft.fiveBullets,
    draft.description,
  ].join("\n");
  assert.match(draft.title, /^1 Pack \/ 4 Pack Vintage Motorcycle Riding Goggles 180 Wide View Anti Fog/i);
  assert.ok(Array.from(draft.title).length >= 120, `expected at least 120 title characters, received ${Array.from(draft.title).length}`);
  assert.ok(Array.from(draft.title).length <= 200, `expected no more than 200 title characters, received ${Array.from(draft.title).length}`);
  assert.match(draft.title, /PC Lens.*Indirect Vents.*Adjustable Headband.*Soft Frame.*Nose Pad.*Outdoor.*Off[- ]Road Riding/i);
  assert.doesNotMatch(englishText, /1 SKU 1 SKU/i);
  assert.match(englishText, /180°|wide front field/i);
  assert.match(englishText, /PC lens|indirect vents|anti-fog coating|adjustable headband/i);
  assert.doesNotMatch(draft.painPoints.join("\n"), /[?？]/u);
  assert.deepEqual(
    draft.fiveBullets.map((item) => item.split(":", 1)[0]),
    ["WIDE VIEW", "PC LENS", "ADJUSTABLE FIT", "AIRFLOW & FOG", "OPTIONS"],
  );
  assert.equal(new Set(draft.fiveBullets.map((item) => item.split(":", 1)[0])).size, 5);
  assert.equal(draft.zhDisplay.sellingPoints.length, draft.sellingPoints.length);
  assert.equal(draft.zhDisplay.painPoints.length, draft.painPoints.length);
  assert.equal(draft.zhDisplay.fiveBullets.length, draft.fiveBullets.length);
  assert.doesNotMatch(visibleChineseDisplayText(draft), /1 SKU 1 SKU/u);
  assert.match(draft.zhDisplay.title, /180°大视窗.*防雾.*PC镜片.*间接通风口.*可调节头带.*柔软面框.*鼻垫.*户外.*越野骑行/u);
  const chineseProse = [
    ...draft.zhDisplay.sellingPoints,
    ...draft.zhDisplay.painPoints,
    ...draft.zhDisplay.fiveBullets,
    draft.zhDisplay.description,
  ].join("\n");
  assert.doesNotMatch(chineseProse, /[,;:]/u);
  assert.match(draft.zhDisplay.sellingPoints[1], /明确标示为PC镜片.*选购时可直接了解镜片材质/u);
  assert.match(draft.zhDisplay.sellingPoints[2], /间接通风口.*防雾涂层.*镜片周围通风.*起雾/u);
  assert.match(draft.zhDisplay.painPoints[2], /仅看外观.*佩戴结构.*可调节头带.*柔软面框.*鼻垫/u);
  assert.match(draft.sellingPoints[2], /airflow around the lens.*fog buildup/i);
  assert.match(draft.painPoints[1], /common riding concerns/i);
});

test("platform V1 accepts a short evidence-rich title while preserving low-limit platform titles", async () => {
  const source = {
    setId: "set-evidence-rich-title-minimum",
    platformPolicyId: "universal",
    forceV1: true,
    productName: "复古摩托车骑行护目镜",
    targetLanguage: "en",
    skuPackQuantityText: "1 Pack / 4 Pack",
    skuVariantCount: 7,
    listingEvidenceAliases: [
      "vintage motorcycle riding goggles",
      "180° wide viewing window",
      "PC lens construction",
      "indirect vents",
      "anti-fog coating",
      "adjustable headband",
      "soft frame",
      "nose pad",
      "outdoor and off-road riding context",
    ],
    skuSubjects: Array.from({ length: 7 }, (_, index) => ({
      id: `goggle-${index + 1}`,
      title: "1 SKU 1 SKU",
      bundleCount: index === 1 ? 4 : 1,
    })),
  };
  const fallback = makeMockCreationListingDraft(source);
  const structurallyValidBullets = fallback.fiveBullets.map((item) => item.replace(/^AIRFLOW & FOG:/u, "AIRFLOW FOG:"));
  const shortTitle = "1 Pack / 4 Pack Vintage Motorcycle Riding Goggles 180 Wide View Anti Fog";
  let requestInput = "";
  const directDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source,
    fetchImpl: async (_url, options) => {
      requestInput = JSON.parse(options.body).input;
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          ...fallback,
          title: shortTitle,
          fiveBullets: structurallyValidBullets,
          zhDisplay: {
            ...fallback.zhDisplay,
            title: "1件装 / 4件装 复古摩托车骑行护目镜 180°大视窗 防雾",
          },
        }),
      }), { status: 200 });
    },
  });

  assert.match(requestInput, /at least 120 English characters/i);
  assert.equal(directDraft.title, shortTitle);
  assert.ok(Array.from(directDraft.title).length < 120);

  const lowLimitSource = { ...source, platformPolicyId: "ebay" };
  const lowLimitFallback = makeMockCreationListingDraft(lowLimitSource);
  const lowLimitBullets = lowLimitFallback.fiveBullets.map((item) => item.replace(/^AIRFLOW & FOG:/u, "AIRFLOW FOG:"));
  const lowLimitDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: lowLimitSource,
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify({
        ...lowLimitFallback,
        title: shortTitle,
        fiveBullets: lowLimitBullets,
        zhDisplay: {
          ...lowLimitFallback.zhDisplay,
          title: "1件装 / 4件装 复古摩托车骑行护目镜 180°大视窗 防雾",
        },
      }),
    }), { status: 200 }),
  });

  assert.equal(lowLimitDraft.title, shortTitle);
  assert.ok(Array.from(lowLimitDraft.title).length <= 80);
});

test("localized motorcycle-goggle mock omits absent lens and fit aliases", async () => {
  const [draft] = await generateCreationListingDrafts({
    set: {
      setId: "set-localized-motorcycle-goggles-minimal",
      platformPolicyId: "universal",
      productName: "复古摩托车骑行护目镜",
      targetLanguage: "en",
      skuBundleCount: 1,
      referenceImageRoles: [{
        filename: "view.jpg",
        role: "dimensions",
        note: "PC镜片和180°大视窗。",
      }],
      skuSubjects: [
        { id: "goggle-a", title: "黑色款", bundleCount: 1 },
        { id: "goggle-b", title: "棕色款", bundleCount: 1 },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    mock: true,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "temporary upstream error" } }), { status: 503 }),
  });

  const englishText = [
    draft.title,
    ...draft.sellingPoints,
    ...draft.painPoints,
    ...draft.fiveBullets,
    draft.description,
    draft.backendSearchTerms,
  ].join("\n");
  const chineseText = [
    draft.zhDisplay.title,
    ...draft.zhDisplay.sellingPoints,
    ...draft.zhDisplay.painPoints,
    ...draft.zhDisplay.fiveBullets,
    draft.zhDisplay.description,
    draft.zhDisplay.backendSearchTerms,
  ].join("\n");
  assert.match(draft.title, /180 Wide View/i);
  assert.ok(Array.from(draft.title).length < 120);
  assert.doesNotMatch(englishText, /indirect vents|anti-fog|adjustable headband|soft frame|nose pad/i);
  assert.doesNotMatch(chineseText, /通风|防雾|可调节头带|柔软面框|鼻垫/u);
  assert.equal(draft.fiveBullets.length, 5);
  assert.equal(draft.zhDisplay.fiveBullets.length, 5);
});

test("mock fallback recognizes Chinese folding wagons before numeric claim fragments", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-cn-folding-wagon",
    productName: "四轮折叠手拉车",
    skuTitle: "四轮折叠手拉车",
    skuNote: "1个完整产品单位；不保留画面外置300KG文字。",
    skuBundleCount: 1,
    evidenceMode: "image-backed",
    skuSubjects: [
      { id: "wagon-black", title: "黑色折叠手拉车", bundleCount: 1 },
      { id: "wagon-pink", title: "粉色折叠手拉车", bundleCount: 1 },
    ],
  });

  assert.match(draft.title, /^1 Pack Folding Wagon Cart\b/);
  assert.doesNotMatch(visibleDraftText(draft), /300\s*KG/i);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock listing draft does not infer product keywords from numbered first aid kit contents", () => {
  const source = {
    ...standardSource,
    productName: "急救包",
    skuBundleCount: 1,
    productDescription: [
      "配置清单：",
      "1.创口贴*20片",
      "2.5*450cmPBT绷带*3卷",
      "3.7.5*450cmPBT绷带*3卷",
      "16.TPE止血带*1个",
      "21.急救包*1个",
    ].join("\n\n"),
    dimensionSpecs: "重量：0.35kg (12.35 oz)",
    skuSubjects: [{ id: "red-first-aid-kit", title: "红色手提急救包", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);

  assert.match(draft.title, /^1 Pack First Aid Kit\b/);
  assert.doesNotMatch(draft.title, /0\.35kg|12\.35 oz/i);
  assert.doesNotMatch(visibleDraftText(draft), /\bPBT\b|\bTPE\b|450cm|\*20/);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock listing draft uses product-facing copy instead of internal template commentary", () => {
  const source = {
    ...standardSource,
    productName: "急救包",
    skuBundleCount: 1,
    productDescription: [
      "配置清单：",
      "1.创口贴*20片",
      "2.5*450cmPBT绷带*3卷",
      "3.7.5*450cmPBT绷带*3卷",
      "16.TPE止血带*1个",
      "21.急救包*1个",
    ].join("\n\n"),
    dimensionSpecs: "8cm (3.15 in)",
    skuSubjects: [{ id: "red-first-aid-kit", title: "红色手提急救包", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);
  const publicText = visibleDraftText(draft);

  assert.match(draft.title, /^1 Pack First Aid Kit\b/);
  assert.doesNotMatch(draft.title, /8cm|3\.15 in/i);
  assert.match(publicText, /\bFirst Aid Kit\b/);
  assert.match(publicText, /\b(?:pack|size|option|dimensions|variant|package)\b/i);
  assert.doesNotMatch(
    publicText,
    /\b(?:Provided product attributes|searchable copy|shopper-ready language|Sellers often struggle|Product details are based on provided inputs|Keyword structure combines|product listing searchable variant comparison|sku specific)\b/i,
  );
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock listing draft does not classify single bandage items as a first aid kit", () => {
  const source = {
    ...standardSource,
    productName: "创口贴",
    skuTitle: "",
    skuBundleCount: 1,
    productDescription: "创口贴*20片，独立包装，适合家庭和旅行备用。",
    dimensionSpecs: "10cm",
    industryTemplatePath: "Health & Household > Bandages",
    skuSubjects: [{ id: "adhesive-bandages", title: "创口贴单品", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);

  assert.match(draft.title, /^1 Pack Bandages\b/);
  assert.doesNotMatch(draft.title, /10cm/i);
  assert.doesNotMatch(draft.title, /\bFirst Aid Kit\b/);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock drafts keep long SKU fields under 500 characters", () => {
  const longSkuName = `Desk Organizer ${"storage ".repeat(90)}`;
  const source = {
    ...standardSource,
    productName: longSkuName,
    skuTitle: longSkuName,
    dimensionSpecs: "3.5 x 2 in",
  };
  const mockDraft = makeMockCreationListingDraft(source);

  const fields = [
    mockDraft.title,
    mockDraft.description,
    mockDraft.backendSearchTerms,
    ...mockDraft.sellingPoints,
    ...mockDraft.painPoints,
    ...mockDraft.fiveBullets,
    ...Object.values(mockDraft.keywordBuckets).flat(),
  ];
  assert.equal(fields.every((value) => value.length <= 500), true);
  assert.equal(
    validateListingAgentDraft(mockDraft, "2 Pack").ok,
    true,
  );
});
