import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { TEMU_TEMPLATE_HEADERS, TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";
import { TEMU_TEMPLATE_HEADERS as reExportedHeaders } from "../lib/creation-temu-export.mjs";
import { TEMU_TEMPLATE_PATH, TEMU_TEMPLATE_SHA256 } from "../lib/creation-temu-workbook.mjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const TEMPLATE_SHEET_NAME = "导入模板";

async function loadTemplateHeaderRow() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMU_TEMPLATE_PATH);
  const sheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
  assert.ok(sheet, `模板缺少工作表 ${TEMPLATE_SHEET_NAME}`);
  const row = sheet.getRow(1);
  const values = [];
  for (let column = 1; column <= TEMU_TEMPLATE_HEADERS.length; column += 1) {
    values.push(String(row.getCell(column).value ?? ""));
  }
  return values;
}

function columnLetter(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

test("表头声明与模板实际 A1:AY1 逐列相等，不等时报出具体列位置", async () => {
  const actual = await loadTemplateHeaderRow();

  const mismatches = [];
  for (let index = 0; index < TEMU_TEMPLATE_HEADERS.length; index += 1) {
    if (actual[index] !== TEMU_TEMPLATE_HEADERS[index]) {
      mismatches.push(
        `第 ${index + 1} 列（${columnLetter(index)}1）：声明 ${JSON.stringify(
          TEMU_TEMPLATE_HEADERS[index],
        )}，模板实际 ${JSON.stringify(actual[index])}`,
      );
    }
  }

  assert.deepEqual(
    mismatches,
    [],
    `表头声明已与模板漂移，逐列差异如下：\n${mismatches.join("\n")}`,
  );
});

test("最后一列落在 AY，共 51 列", () => {
  assert.equal(TEMU_TEMPLATE_HEADERS.length, 51);
  assert.equal(columnLetter(TEMU_TEMPLATE_HEADERS.length - 1), "AY");
});

test("表头声明是冻结的且无重复列名", () => {
  assert.ok(Object.isFrozen(TEMU_TEMPLATE_HEADERS));
  assert.equal(new Set(TEMU_TEMPLATE_HEADERS).size, TEMU_TEMPLATE_HEADERS.length);
});

test("全仓只有一处表头声明：导出模块只做再导出，指向同一引用", () => {
  assert.equal(reExportedHeaders, TEMU_TEMPLATE_HEADERS);
});

test("模板文件本身未被替换", async () => {
  const bytes = await readFile(TEMU_TEMPLATE_PATH);
  const digest = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  assert.equal(digest, TEMU_TEMPLATE_SHA256);
});

test("工作台图片接口路径位于受认证的 /api/ 前缀之下", () => {
  assert.ok(
    TEMU_STUDIO_IMAGE_PATH.startsWith("/api/"),
    "非 GET 与受保护资源必须位于 /api/ 之下，否则跨站请求检查会直接放行",
  );
});
