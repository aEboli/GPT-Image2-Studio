import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const braceExpansions = Object.entries(lock.packages).filter(([path]) => path.endsWith("/brace-expansion"));

// GHSA-q2hr-2g5m-vwhr 的修复版本也覆盖两项递归栈溢出公告。
const patchedVersions = new Map([[1, [1, 21]], [2, [1, 7]], [3, [0, 9]], [5, [0, 12]]]);

for (const [path, entry] of braceExpansions) {
  test(`locked ${path} excludes known vulnerable brace-expansion releases`, () => {
    assert.match(entry.version, /^\d+\.\d+\.\d+$/);
    const [major, minor, patch] = entry.version.split(".").map(Number);
    const minimum = patchedVersions.get(major);
    assert.ok(
      major > 5 || (minimum && (minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1]))),
      `${path}@${entry.version} is affected by GHSA-q2hr-2g5m-vwhr; update within a supported release line`,
    );
  });
}
