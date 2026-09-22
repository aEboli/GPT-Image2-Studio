import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanonicalVersion,
  bumpVersion,
  formatVersion,
  getVersionBumpDescription,
  isCanonicalVersion,
  parseVersion,
} from "../scripts/versioning.mjs";

test("version formatter uses a three-digit update segment", () => {
  assert.deepEqual(parseVersion("0.6.116"), { major: 0, minor: 6, patch: 116 });
  assert.equal(formatVersion({ major: 0, minor: 2, patch: 19 }), "0.2.019");
  assert.deepEqual(parseVersion("0.2.19"), { major: 0, minor: 2, patch: 19 });
  assert.equal(isCanonicalVersion("0.2.19"), false);
  assert.throws(() => assertCanonicalVersion("0.2.19"), /三位 patch/);
  assert.throws(() => parseVersion("0.2.1000"), /一到三位数字/);
});

test("version bumps change one level and reset lower levels", () => {
  assert.equal(bumpVersion("0.2.019", "patch"), "0.2.020");
  assert.equal(bumpVersion("0.2.100", "feature"), "0.2.110");
  assert.equal(bumpVersion("0.6.116", "minor"), "0.7.000");
  assert.equal(bumpVersion("1.6.116", "major"), "2.0.000");
  assert.match(getVersionBumpDescription("feature"), /\+10/);
  assert.throws(() => bumpVersion("0.9.995", "feature"), /不能超过 999/);
  assert.throws(() => bumpVersion("0.9.999", "patch"), /不能超过 999/);
});
