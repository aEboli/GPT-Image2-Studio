import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const LIB_DIR = new URL("../lib/", import.meta.url);
const PAIR_MODULE = "./creation-paired-subject-units.mjs";

/* 跨模块符号必须在 import 里出现。漏掉一个 import 不会在加载时报错，
   只会在真正调用时抛 ReferenceError —— 界面上就是一句
   "xxx is not defined"，排查成本远高于一条静态断言。 */
const PAIR_SYMBOLS = [
  "CREATION_PAIRED_SINGLE_UNIT_NOTE",
  "CREATION_PAIRED_UNIT_CATEGORY_TABLE",
  "buildCreationPairedMultiUnitNote",
  "collapseCreationPairedSubjectColorLabels",
  "getCreationPairedSubjectPairQuantity",
  "getCreationPairedSubjectPieceQuantity",
  "isCreationPairedSellableSubject",
  "normalizeCreationPairedSubjectUnitCount",
  "resolveCreationPairedSubjectUnitCount",
  "resolveCreationSubjectUnitCount",
];

function extractImportBlock(source) {
  const specifier = 'from "' + PAIR_MODULE + '";';
  const specifierAt = source.indexOf(specifier);
  if (specifierAt < 0) {
    return null;
  }
  const open = source.lastIndexOf("import {", specifierAt);
  if (open < 0) {
    return null;
  }
  const block = source.slice(open, specifierAt + specifier.length);
  const names = block
    .slice(block.indexOf("{") + 1, block.lastIndexOf("}"))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/\s+as\s+.*$/, ""));
  return { block, names };
}

test("paired-unit symbols are imported wherever they are used", async () => {
  const entries = await readdir(LIB_DIR, { withFileTypes: true });
  const offenders = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs") || entry.name === "creation-paired-subject-units.mjs") {
      continue;
    }
    const source = await readFile(new URL(entry.name, LIB_DIR), "utf8");
    if (!source.includes(PAIR_MODULE)) {
      continue;
    }
    const imported = extractImportBlock(source);
    if (!imported) {
      offenders.push(entry.name + ": pair module referenced without an import block");
      continue;
    }
    const body = source.replace(imported.block, "");
    const used = PAIR_SYMBOLS.filter((symbol) => new RegExp("\\b" + symbol + "\\b").test(body));
    const missing = used.filter((symbol) => !imported.names.includes(symbol));
    if (missing.length > 0) {
      offenders.push(entry.name + ": " + missing.join(", "));
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("browser mirror modules keep the same import coverage", async () => {
  const publicLib = new URL("../public/lib/", import.meta.url);
  const entries = await readdir(publicLib, { withFileTypes: true });
  const offenders = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs") || entry.name === "creation-paired-subject-units.mjs") {
      continue;
    }
    const source = await readFile(new URL(entry.name, publicLib), "utf8");
    if (!source.includes(PAIR_MODULE)) {
      continue;
    }
    const imported = extractImportBlock(source);
    if (!imported) {
      offenders.push(entry.name + ": pair module referenced without an import block");
      continue;
    }
    const body = source.replace(imported.block, "");
    const used = PAIR_SYMBOLS.filter((symbol) => new RegExp("\\b" + symbol + "\\b").test(body));
    const missing = used.filter((symbol) => !imported.names.includes(symbol));
    if (missing.length > 0) {
      offenders.push(entry.name + ": " + missing.join(", "));
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});
