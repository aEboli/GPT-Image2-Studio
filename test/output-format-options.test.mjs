import test from "node:test";
import assert from "node:assert/strict";

import {
  getOutputFormatOptions,
  normalizeOutputFormat,
  toApiOutputFormat,
  toOutputFormatExtension,
  toOutputFormatMimeType,
} from "../lib/output-format-options.mjs";

test("output format options expose png and jpg for the studio UI", () => {
  assert.deepEqual(getOutputFormatOptions(), [
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" },
  ]);
});

test("output format normalization accepts png, jpg and jpeg aliases", () => {
  assert.equal(normalizeOutputFormat("png"), "png");
  assert.equal(normalizeOutputFormat("jpg"), "jpg");
  assert.equal(normalizeOutputFormat("jpeg"), "jpg");
  assert.equal(normalizeOutputFormat(".JPG"), "jpg");
  assert.equal(normalizeOutputFormat("webp"), "png");
});

test("output format helpers use jpeg for the upstream API but jpg for local files", () => {
  assert.equal(toApiOutputFormat("jpg"), "jpeg");
  assert.equal(toApiOutputFormat("jpeg"), "jpeg");
  assert.equal(toApiOutputFormat("png"), "png");
  assert.equal(toOutputFormatExtension("jpeg"), "jpg");
  assert.equal(toOutputFormatMimeType("jpg"), "image/jpeg");
  assert.equal(toOutputFormatMimeType("png"), "image/png");
});
