import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ExcelJS from "exceljs";

import { TEMU_TEMPLATE_HEADERS } from "../lib/creation-temu-export.mjs";
import {
  TEMU_TEMPLATE_PATH,
  TEMU_TEMPLATE_SHA256,
  buildTemuWorkbookBuffer,
  verifyTemuTemplate,
} from "../lib/creation-temu-workbook.mjs";

function blankCells() {
  return Object.fromEntries(TEMU_TEMPLATE_HEADERS.map((header) => [header, ""]));
}

function makePlan() {
  const first = blankCells();
  Object.assign(first, {
    "*产品标题": "羊毛毡刺绣小马挂件",
    "*英文标题": "Embroidered Horse Charm",
    "产品描述": "=HYPERLINK(\"https://example.com\")\u0000",
    "*变种属性名称一": "颜色",
    "*变种属性值一": "白色挂绳款",
    "预览图": "https://res.cloudinary.com/demo/image/upload/v1/white.png",
    "*申报价格\n(店铺币种)": 19.99,
    "SKU货号": "horse-white",
    "*长（cm）": 20,
    "*宽（cm）": 15,
    "*高（cm）": 8,
    "*重量（g）": 350,
    "*轮播图": "https://res.cloudinary.com/demo/image/upload/v1/hero.png",
    "*产品素材图": "https://res.cloudinary.com/demo/image/upload/c_pad,b_white,h_1200,w_1200/v1/hero.png",
    "库存": 25,
    "产地": "中国-广东省",
  });
  const second = { ...first, "*变种属性值一": "棕色皮绳款", "SKU货号": "horse-brown" };

  return {
    rows: [
      { setId: "set-a", productName: "小马挂件", skuId: "horse-white", skuName: "白色挂绳款", dataRow: 2, cells: first },
      { setId: "set-a", productName: "小马挂件", skuId: "horse-brown", skuName: "棕色皮绳款", dataRow: 3, cells: second },
    ],
    issues: [
      {
        severity: "警告",
        code: "USER_DEFAULT_APPLIED",
        setId: "set-a",
        productName: "小马挂件",
        skuId: "horse-white",
        skuName: "白色挂绳款",
        dataRow: 2,
        field: "库存",
        message: "库存使用了本次导出的批次默认值。",
        source: "用户批次默认值",
        suggestion: "导入前确认该默认值适用于当前 SKU。",
      },
    ],
  };
}

test("Temu workbook verifies the versioned standard template", async () => {
  const verified = await verifyTemuTemplate();
  assert.equal(verified.sha256, TEMU_TEMPLATE_SHA256);
  assert.equal(verified.sheetName, "导入模板");
  assert.equal(verified.columnCount, 51);

  const tempDir = await mkdtemp(join(tmpdir(), "temu-template-invalid-"));
  const invalidPath = join(tempDir, "invalid.xlsx");
  const bytes = await readFile(TEMU_TEMPLATE_PATH);
  const changed = Buffer.from(bytes);
  changed[changed.length - 1] ^= 0xff;
  await writeFile(invalidPath, changed);
  await assert.rejects(verifyTemuTemplate({ templatePath: invalidPath }), /哈希|模板/u);
});

test("Temu workbook rejects template structural drift and preserves trusted metadata", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "temu-template-structure-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  await assert.rejects(
    verifyTemuTemplate({ templatePath: join(tempDir, "missing.xlsx") }),
    /不存在|无法读取/u,
  );

  const missingSheet = new ExcelJS.Workbook();
  await missingSheet.xlsx.readFile(TEMU_TEMPLATE_PATH);
  missingSheet.removeWorksheet("导入示例");
  const missingSheetPath = join(tempDir, "missing-sheet.xlsx");
  await missingSheet.xlsx.writeFile(missingSheetPath);
  await assert.rejects(
    verifyTemuTemplate({ templatePath: missingSheetPath, expectedSha256: null }),
    /缺少/u,
  );

  const headerDrift = new ExcelJS.Workbook();
  await headerDrift.xlsx.readFile(TEMU_TEMPLATE_PATH);
  headerDrift.getWorksheet("导入模板").getCell("A1").value = "*漂移标题";
  const headerDriftPath = join(tempDir, "header-drift.xlsx");
  await headerDrift.xlsx.writeFile(headerDriftPath);
  await assert.rejects(
    verifyTemuTemplate({ templatePath: headerDriftPath, expectedSha256: null }),
    /表头/u,
  );

  const trustedTemplate = new ExcelJS.Workbook();
  await trustedTemplate.xlsx.readFile(TEMU_TEMPLATE_PATH);
  const trustedExample = trustedTemplate.getWorksheet("导入示例");
  trustedExample.views = [{ state: "frozen", xSplit: 1, ySplit: 1, topLeftCell: "B2", activeCell: "B2" }];
  trustedExample.getColumn(1).width = 24;
  trustedExample.getCell("A8").value = { formula: "ROW()", result: 8 };
  trustedExample.getCell("B8").dataValidation = { type: "list", allowBlank: true, formulae: ['"A,B"'] };
  trustedExample.getCell("C8").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCC00" } };
  trustedExample.getCell("C8").font = { bold: true };
  const trustedPath = join(tempDir, "trusted.xlsx");
  await trustedTemplate.xlsx.writeFile(trustedPath);

  const expectedTemplate = new ExcelJS.Workbook();
  await expectedTemplate.xlsx.readFile(trustedPath);
  const expectedExample = expectedTemplate.getWorksheet("导入示例");
  const result = await buildTemuWorkbookBuffer({
    plan: makePlan(),
    templatePath: trustedPath,
    expectedSha256: null,
  });
  const output = new ExcelJS.Workbook();
  await output.xlsx.load(result.buffer);
  const exportedExample = output.getWorksheet("导入示例");

  assert.deepEqual(exportedExample.views, expectedExample.views);
  assert.equal(exportedExample.getColumn(1).width, expectedExample.getColumn(1).width);
  assert.deepEqual(expectedExample.getCell("A8").value, { formula: "ROW()", result: 8 });
  assert.deepEqual(exportedExample.getCell("A8").value, expectedExample.getCell("A8").value);
  assert.deepEqual(exportedExample.dataValidations.model, expectedExample.dataValidations.model);
  assert.equal(exportedExample.getCell("C8").fill.fgColor.argb, "FFFFCC00");
  assert.equal(exportedExample.getCell("C8").font.bold, true);
});

test("Temu workbook rejects a missing 导入模板 sheet directly", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "temu-template-missing-import-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMU_TEMPLATE_PATH);
  workbook.removeWorksheet("导入模板");
  const missingTemplatePath = join(tempDir, "missing-import-template.xlsx");
  await workbook.xlsx.writeFile(missingTemplatePath);

  await assert.rejects(
    verifyTemuTemplate({ templatePath: missingTemplatePath, expectedSha256: null }),
    (error) => error?.code === "TEMU_WORKBOOK_INVALID" && /导入模板/u.test(error.message),
  );
});

test("Temu workbook writes one SKU per row, preserves examples, and reports sanitized text", async () => {
  const result = await buildTemuWorkbookBuffer({ plan: makePlan() });
  assert.equal(result.rowCount, 2);
  assert.equal(result.issueSheetName, "导出问题");
  assert.ok(result.issueCount >= 3);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["导入模板", "导入示例", "导出问题"]);

  const template = workbook.getWorksheet("导入模板");
  assert.equal(template.getCell("A2").value, "羊毛毡刺绣小马挂件");
  assert.equal(template.getCell("F2").value, "白色挂绳款");
  assert.equal(template.getCell("F3").value, "棕色皮绳款");
  assert.equal(template.getCell("J2").value, 19.99);
  assert.equal(template.getCell("C2").value, "=HYPERLINK(\"https://example.com\")");
  assert.equal(template.getCell("C2").formula, undefined);
  assert.equal(template.getCell("S2").value, "https://res.cloudinary.com/demo/image/upload/v1/hero.png");

  const example = workbook.getWorksheet("导入示例");
  assert.equal(example.getCell("B3").value, "test1");
  assert.equal(example.columnCount, 52);

  const issues = workbook.getWorksheet("导出问题");
  assert.deepEqual(issues.getRow(1).values.slice(1, 11), [
    "严重级别", "问题代码", "setId", "商品名称", "SKU ID/名称",
    "数据行号", "模板字段/列", "问题说明", "当前来源", "建议处理",
  ]);
  const issueCodes = [];
  const issueMessages = new Map();
  for (let rowNumber = 2; rowNumber <= issues.rowCount; rowNumber += 1) {
    const code = issues.getCell(rowNumber, 2).value;
    issueCodes.push(code);
    issueMessages.set(code, issues.getCell(rowNumber, 8).value);
  }
  assert.ok(issueCodes.includes("USER_DEFAULT_APPLIED"));
  assert.ok(issueCodes.includes("CELL_FORMULA_LITERAL"));
  assert.ok(issueCodes.includes("CELL_XML_CONTROL_REMOVED"));
  assert.match(issueMessages.get("CELL_XML_CONTROL_REMOVED"), /原始长度：\d+ 个 UTF-16 代码单元/u);
});

test("Temu workbook chooses a non-conflicting issue sheet name", async () => {
  const source = new ExcelJS.Workbook();
  await source.xlsx.readFile(TEMU_TEMPLATE_PATH);
  source.addWorksheet("导出问题");
  const tempDir = await mkdtemp(join(tmpdir(), "temu-template-conflict-"));
  const customPath = join(tempDir, "custom.xlsx");
  await source.xlsx.writeFile(customPath);

  const result = await buildTemuWorkbookBuffer({
    plan: makePlan(),
    templatePath: customPath,
    expectedSha256: null,
  });
  assert.equal(result.issueSheetName, "导出问题 (2)");
});
