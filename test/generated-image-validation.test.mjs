import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

import {
  inspectGeneratedImage,
  isInvalidGeneratedImageMetadata,
  validateGeneratedImage,
} from "../lib/generated-image-validation.mjs";

const validTwoByTwoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=",
  "base64",
);
const historicalWhiteMockPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64",
);

test("generated image validation accepts complete PNG and JPEG results", async () => {
  assert.deepEqual(inspectGeneratedImage(validTwoByTwoPng), {
    valid: true,
    format: "png",
    width: 2,
    height: 2,
    actualSize: "2x2",
    reason: "",
  });

  const jpeg = await readFile(new URL("../docs/images/gallery.jpg", import.meta.url));
  const inspectedJpeg = validateGeneratedImage(jpeg);
  assert.equal(inspectedJpeg.valid, true);
  assert.equal(inspectedJpeg.format, "jpeg");
  assert.ok(inspectedJpeg.width > 1);
  assert.ok(inspectedJpeg.height > 1);
});

// Entropy-coded scan data contains 0xff00 stuffing and restart markers that must
// not be read as segment headers. A single sample file cannot catch that, because
// whether a misparse derails depends on the bytes of each individual image.
test("generated image validation accepts every real JPEG asset in the repository", async () => {
  const imagesDir = new URL("../docs/images/", import.meta.url);
  const jpegNames = (await readdir(imagesDir)).filter((name) => /\.jpe?g$/i.test(name));
  assert.ok(jpegNames.length >= 4, `expected several JPEG fixtures, found ${jpegNames.length}`);

  const rejected = [];
  for (const name of jpegNames) {
    const inspected = inspectGeneratedImage(await readFile(new URL(name, imagesDir)));
    if (!inspected.valid) {
      rejected.push(`${name} (${inspected.reason})`);
    } else {
      assert.equal(inspected.format, "jpeg");
      assert.ok(inspected.width > 1 && inspected.height > 1);
    }
  }

  assert.deepEqual(rejected, [], `valid JPEGs were rejected: ${rejected.join(", ")}`);
});

test("generated image validation rejects truncated JPEG results", async () => {
  const jpeg = await readFile(new URL("../docs/images/style-transfer.jpg", import.meta.url));

  for (const fraction of [0.25, 0.5, 0.9, 0.999]) {
    const truncated = jpeg.subarray(0, Math.floor(jpeg.length * fraction));
    const inspected = inspectGeneratedImage(truncated);
    assert.equal(inspected.valid, false, `truncated ${fraction * 100}% should be rejected`);
    assert.equal(inspected.reason, "malformed-image");
  }
});

test("generated image validation rejects the historical 1x1 white mock", () => {
  const inspected = inspectGeneratedImage(historicalWhiteMockPng);
  assert.equal(inspected.valid, false);
  assert.equal(inspected.actualSize, "1x1");
  assert.equal(inspected.reason, "too-small");

  assert.throws(
    () => validateGeneratedImage(historicalWhiteMockPng),
    (error) => {
      assert.equal(error.code, "INVALID_GENERATED_IMAGE");
      assert.equal(error.reason, "too-small");
      assert.equal(error.details.actualSize, "1x1");
      return true;
    },
  );
});

test("generated image validation rejects empty, unsupported, and truncated results", () => {
  assert.equal(inspectGeneratedImage(Buffer.alloc(0)).reason, "empty");
  assert.equal(inspectGeneratedImage(Buffer.from("not an image")).reason, "unsupported-format");

  const truncatedPng = validTwoByTwoPng.subarray(0, 24);
  const inspected = inspectGeneratedImage(truncatedPng);
  assert.equal(inspected.valid, false);
  assert.equal(inspected.format, "png");
  assert.equal(inspected.reason, "malformed-image");
});

test("gallery filtering hides historical undersized results without hiding intentional 1x1 assets", () => {
  assert.equal(isInvalidGeneratedImageMetadata({ size: "1024x1024", actualSize: "1x1" }), true);
  assert.equal(isInvalidGeneratedImageMetadata({ size: "1x1", actualSize: "1x1" }), false);
  assert.equal(isInvalidGeneratedImageMetadata({ size: "", actualSize: "1x1" }), false);
  assert.equal(isInvalidGeneratedImageMetadata({ size: "1024x1024", actualSize: "1024x1024" }), false);
});
