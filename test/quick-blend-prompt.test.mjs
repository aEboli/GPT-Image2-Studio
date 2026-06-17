import test from "node:test";
import assert from "node:assert/strict";

import {
  QUICK_BLEND_ASSET_KIND,
  QUICK_BLEND_METADATA_FIELDS,
  QUICK_BLEND_MODE,
  QUICK_BLEND_REFERENCE_LABELS,
  buildQuickBlendFilenameToken,
  buildQuickBlendPrompt,
  buildQuickBlendReferenceLabels,
  normalizeQuickBlendLayoutOrder,
  normalizeQuickBlendPairIndex,
  normalizeQuickBlendPlacementShape,
} from "../lib/quick-blend-prompt.mjs";

test("quick blend helper defines mode, asset kind, labels, and metadata fields", () => {
  assert.equal(QUICK_BLEND_MODE, "quick-blend");
  assert.equal(QUICK_BLEND_ASSET_KIND, "quick-blend");
  assert.deepEqual(QUICK_BLEND_METADATA_FIELDS, [
    "quickBlendPairIndex",
    "quickBlendAImageName",
    "quickBlendBImageName",
    "quickBlendCImageName",
    "quickBlendDImageName",
    "quickBlendLayoutOrder",
    "quickBlendPlacementShape",
  ]);
  assert.equal(QUICK_BLEND_REFERENCE_LABELS.length, 2);
  assert.match(QUICK_BLEND_REFERENCE_LABELS[0], /Reference image 1: A image/i);
  assert.match(QUICK_BLEND_REFERENCE_LABELS[1], /Reference image 2: B image/i);
});

test("quick blend prompt extracts visible subjects and stacks A above B", () => {
  const result = buildQuickBlendPrompt({
    pairIndex: "2",
    aImageName: "A dress.png",
    bImageName: "B shoe.png",
  });

  assert.equal(result.pairIndex, "2");
  assert.equal(result.aImageName, "A dress.png");
  assert.equal(result.bImageName, "B shoe.png");
  assert.match(result.prompt, /first reference image as A/i);
  assert.match(result.prompt, /second reference image as B/i);
  assert.match(result.prompt, /A subject group above the B subject group/i);
  assert.match(result.prompt, /remove or neutralize the original backgrounds/i);
  assert.match(result.prompt, /preserve subject shape, colors, materials, markings, proportions, and identity cues/i);
  assert.match(result.prompt, /Do not add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements/i);
  assert.doesNotMatch(result.prompt, /grid of all uploaded images/i);
  assert.doesNotMatch(result.prompt, /every possible combination/i);
});

test("quick blend prompt supports optional C and D product groups in the same indexed pair", () => {
  const result = buildQuickBlendPrompt({
    pairIndex: "4",
    aImageName: "A backpack.png",
    bImageName: "B rope.png",
    cImageName: "C compass.png",
    dImageName: "D bottle.png",
    layoutOrder: "horizontal",
    placementShape: "rectangle",
  });

  assert.equal(result.pairIndex, "4");
  assert.equal(result.aImageName, "A backpack.png");
  assert.equal(result.bImageName, "B rope.png");
  assert.equal(result.cImageName, "C compass.png");
  assert.equal(result.dImageName, "D bottle.png");
  assert.equal(result.layoutOrder, "horizontal");
  assert.equal(result.placementShape, "rectangle");
  assert.match(result.prompt, /Reference image 3 is product group C/i);
  assert.match(result.prompt, /Reference image 4 is product group D/i);
  assert.match(result.prompt, /left to right, then continue on the next row/i);
  assert.match(result.prompt, /rectangular sorting layout/i);
  assert.match(result.prompt, /use a 2 by 2 matrix inside the rectangular canvas/i);
  assert.match(result.prompt, /A and B on the first row, then C and D on the second row/i);
  assert.match(result.prompt, /assigned layout slot using contain-style proportional scaling/i);
  assert.doesNotMatch(result.prompt, /placement zones/i);
  assert.doesNotMatch(result.prompt, /boxed areas/i);
  assert.doesNotMatch(result.prompt, /separate boxes/i);
  assert.match(result.prompt, /Generate separate C or D outputs is forbidden/i);
});

test("quick blend square placement arranges four product groups as a 2 by 2 matrix", () => {
  const result = buildQuickBlendPrompt({
    pairIndex: "5",
    aImageName: "A backpack.png",
    bImageName: "B rope.png",
    cImageName: "C compass.png",
    dImageName: "D bottle.png",
    layoutOrder: "horizontal",
    placementShape: "square",
  });

  assert.equal(result.layoutOrder, "horizontal");
  assert.equal(result.placementShape, "square");
  assert.match(result.prompt, /near-square sorting layout/i);
  assert.match(result.prompt, /four enabled groups, use exactly a 2 by 2 grid/i);
  assert.match(result.prompt, /A and B on the first row, then C and D on the second row/i);
  assert.doesNotMatch(result.prompt, /single row of four/i);
  assert.doesNotMatch(result.prompt, /single column of four/i);
  assert.doesNotMatch(result.prompt, /placement zones/i);
  assert.doesNotMatch(result.prompt, /boxed areas/i);
  assert.doesNotMatch(result.prompt, /separate boxes/i);
  assert.match(result.prompt, /assigned layout slot using contain-style proportional scaling/i);
  assert.match(result.prompt, /Preserve each subject's natural aspect ratio/i);
  assert.match(result.prompt, /Do not stretch, squash, warp, bend, elongate, compress, crop, or force any subject/i);
});

test("quick blend prompt can label D as the third reference when C is not enabled", () => {
  const result = buildQuickBlendPrompt({
    aImageName: "A bag.png",
    bImageName: "B strap.png",
    dImageName: "D buckle.png",
  });

  assert.match(result.prompt, /Reference image 3 is product group D/i);
  assert.doesNotMatch(result.prompt, /Reference image 3 is product group C/i);
});

test("quick blend reference labels follow the enabled product groups", () => {
  const labels = buildQuickBlendReferenceLabels({ groups: ["A", "B", "D"] });

  assert.equal(labels.length, 3);
  assert.match(labels[0], /Reference image 1: A image/i);
  assert.match(labels[1], /Reference image 2: B image/i);
  assert.match(labels[2], /Reference image 3: D image/i);
  assert.doesNotMatch(labels[2], /C image/i);
});

test("quick blend layout option normalization uses stable defaults", () => {
  assert.equal(normalizeQuickBlendLayoutOrder("vertical"), "vertical");
  assert.equal(normalizeQuickBlendLayoutOrder("horizontal"), "horizontal");
  assert.equal(normalizeQuickBlendLayoutOrder("left-right"), "horizontal");
  assert.equal(normalizeQuickBlendLayoutOrder("bad"), "vertical");
  assert.equal(normalizeQuickBlendPlacementShape("square"), "square");
  assert.equal(normalizeQuickBlendPlacementShape("rectangle"), "rectangle");
  assert.equal(normalizeQuickBlendPlacementShape("rect"), "rectangle");
  assert.equal(normalizeQuickBlendPlacementShape("bad"), "square");
});

test("quick blend pair index normalization stays positive and string based", () => {
  assert.equal(normalizeQuickBlendPairIndex(1), "1");
  assert.equal(normalizeQuickBlendPairIndex("03"), "3");
  assert.equal(normalizeQuickBlendPairIndex("0"), "1");
  assert.equal(normalizeQuickBlendPairIndex("abc"), "1");
  assert.equal(normalizeQuickBlendPairIndex("2abc"), "1");
  assert.equal(normalizeQuickBlendPairIndex("3.9"), "1");
  assert.equal(normalizeQuickBlendPairIndex("   "), "1");
  assert.equal(normalizeQuickBlendPairIndex(null), "1");
});

test("quick blend prompt sanitizes uploaded filenames in metadata and prompt text", () => {
  const result = buildQuickBlendPrompt({
    aImageName: " A\nname.png ",
    bImageName: "B\tname.png",
    cImageName: "C\rname.png",
    dImageName: "D\fname.png",
  });

  assert.equal(result.aImageName, "A name.png");
  assert.equal(result.bImageName, "B name.png");
  assert.equal(result.cImageName, "C name.png");
  assert.equal(result.dImageName, "D name.png");
  assert.match(result.prompt, /A filename: A name\.png\./);
  assert.match(result.prompt, /B filename: B name\.png\./);
  assert.match(result.prompt, /C filename: C name\.png\./);
  assert.match(result.prompt, /D filename: D name\.png\./);
  assert.doesNotMatch(result.prompt, /A\nname\.png/);
  assert.doesNotMatch(result.prompt, /B\tname\.png/);
});

test("quick blend filename token follows source filename stems", () => {
  assert.equal(
    buildQuickBlendFilenameToken({
      aImageName: " A dress.png ",
      bImageName: "B shoe.JPG",
      cImageName: "C hat.webp",
      dImageName: "D belt.png",
    }),
    "A-dress-B-shoe-C-hat-D-belt",
  );
  assert.equal(
    buildQuickBlendFilenameToken({
      aImageName: "../product/front view.png",
      bImageName: "package:bad?.png",
    }),
    "front-view-packagebad",
  );
  assert.equal(buildQuickBlendFilenameToken({}), "");
});
