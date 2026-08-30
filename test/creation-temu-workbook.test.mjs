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

const PRICE_HEADER = "*申报价格\n(店铺币种)";
const NUMERIC_HEADERS = Object.freeze([PRICE_HEADER, "*长（cm）", "*宽（cm）", "*高（cm）", "*重量（g）", "库存"]);
const EMPTY_HEADERS = Object.freeze(["产品货号", "发货时效（天）", "来源URL"]);

function columnLetter(columnNumber) {
  let letters = "";
  let remaining = columnNumber;
  while (remaining > 0) {
    letters = String.fromCharCode(65 + ((remaining - 1) % 26)) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

// Every column keeps the same value type in every row so per-column number formats stay
// comparable row to row. The three template style groups are each covered by a text cell, a
// number cell and an empty cell.
function styleProbeRow(index) {
  const cells = {};
  for (const header of TEMU_TEMPLATE_HEADERS) {
    if (EMPTY_HEADERS.includes(header)) cells[header] = "";
    else if (NUMERIC_HEADERS.includes(header)) cells[header] = 12 + index;
    else cells[header] = `值${index}`;
  }
  return { setId: "set-style", productName: "样式探针", skuId: `sku-${index}`, skuName: `规格${index}`, cells };
}

function styleProbePlan(rowCount = 3) {
  return { rows: Array.from({ length: rowCount }, (_, index) => styleProbeRow(index + 1)), issues: [] };
}

async function readTemplateDataStartStyles() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMU_TEMPLATE_PATH);
  const sheet = workbook.getWorksheet("导入模板");
  return TEMU_TEMPLATE_HEADERS.map((_, index) => sheet.getCell(2, index + 1).style ?? {});
}

test("Temu workbook keeps the batch path at three sheets with a full issue sheet readback", async () => {
  const result = await buildTemuWorkbookBuffer({ plan: makePlan() });

  assert.equal(result.issueSheetName, "导出问题");
  assert.ok(result.issueCount >= 3, `expected several issues, got ${result.issueCount}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["导入模板", "导入示例", "导出问题"]);
  assert.equal(workbook.getWorksheet("导出问题").rowCount, result.issueCount + 1);
});

test("Temu workbook omits the issue sheet on request and still reports its issues", async () => {
  const result = await buildTemuWorkbookBuffer({ plan: makePlan(), includeIssueSheet: false });

  assert.equal(result.issueSheetName, null);
  assert.equal(result.rowCount, 2);
  assert.ok(result.issueCount >= 3, `expected several issues, got ${result.issueCount}`);
  // Skipping the sheet must not silently drop the writer's own cell-change findings.
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes("CELL_FORMULA_LITERAL"), `missing CELL_FORMULA_LITERAL in ${codes.join(",")}`);
  assert.ok(codes.includes("CELL_XML_CONTROL_REMOVED"), `missing CELL_XML_CONTROL_REMOVED in ${codes.join(",")}`);
  assert.ok(codes.includes("USER_DEFAULT_APPLIED"), `missing USER_DEFAULT_APPLIED in ${codes.join(",")}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["导入模板", "导入示例"]);
  const template = workbook.getWorksheet("导入模板");
  assert.equal(template.getCell("A2").value, "羊毛毡刺绣小马挂件");
  assert.equal(template.getCell("F3").value, "棕色皮绳款");
});

test("Temu workbook copies the template data-start style onto every data row per column", async () => {
  const templateStyles = await readTemplateDataStartStyles();
  const result = await buildTemuWorkbookBuffer({ plan: styleProbePlan(3), includeIssueSheet: false });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const sheet = workbook.getWorksheet("导入模板");

  // The template's own three groups, measured with exceljs: centered A2-W2, unstyled X2-Z2,
  // wrap-only AA2-AY2. Pinning them here keeps the expectations below honest.
  for (let column = 1; column <= 23; column += 1) {
    assert.deepEqual(
      templateStyles[column - 1].alignment,
      { horizontal: "center", vertical: "middle", wrapText: true },
      `template ${columnLetter(column)}2 alignment drifted`,
    );
  }
  for (const column of [24, 25, 26]) {
    assert.equal(templateStyles[column - 1].alignment, undefined, `template ${columnLetter(column)}2 gained alignment`);
    assert.equal(templateStyles[column - 1].font, undefined, `template ${columnLetter(column)}2 gained a font`);
  }
  for (let column = 27; column <= 51; column += 1) {
    assert.deepEqual(
      templateStyles[column - 1].alignment,
      { wrapText: true },
      `template ${columnLetter(column)}2 alignment drifted`,
    );
  }

  for (const row of [3, 4]) {
    for (let column = 1; column <= TEMU_TEMPLATE_HEADERS.length; column += 1) {
      const where = `${columnLetter(column)}${row}`;
      // Row 2 keeps the template's native style, so it is the reference every later row must match.
      assert.deepEqual(
        sheet.getCell(row, column).style,
        sheet.getCell(2, column).style,
        `${where} style differs from the data-start row`,
      );
      assert.deepEqual(
        sheet.getCell(row, column).alignment ?? undefined,
        templateStyles[column - 1].alignment,
        `${where} alignment differs from the template data-start row`,
      );
    }
  }

  // Spelled out per group so a uniform "center + middle + 宋体" implementation cannot pass.
  for (const row of [3, 4]) {
    for (const column of [1, 12, 23]) {
      const cell = sheet.getCell(row, column);
      assert.equal(cell.alignment.horizontal, "center", `${columnLetter(column)}${row} lost centering`);
      assert.equal(cell.alignment.vertical, "middle", `${columnLetter(column)}${row} lost middle alignment`);
      assert.equal(cell.alignment.wrapText, true, `${columnLetter(column)}${row} lost wrapText`);
      assert.equal(cell.font.name, "宋体", `${columnLetter(column)}${row} lost the 宋体 font`);
    }
    for (const column of [24, 25, 26]) {
      const cell = sheet.getCell(row, column);
      assert.equal(cell.alignment, undefined, `${columnLetter(column)}${row} gained alignment the template lacks`);
      assert.notEqual(cell.font?.name, "宋体", `${columnLetter(column)}${row} gained the 宋体 font the template lacks`);
    }
    for (const column of [27, 39, 51]) {
      const cell = sheet.getCell(row, column);
      assert.equal(cell.alignment.wrapText, true, `${columnLetter(column)}${row} lost wrapText`);
      assert.equal(cell.alignment.horizontal, undefined, `${columnLetter(column)}${row} was centered horizontally`);
      assert.equal(cell.alignment.vertical, undefined, `${columnLetter(column)}${row} was centered vertically`);
      assert.equal(cell.font.name, "宋体", `${columnLetter(column)}${row} lost the 宋体 font`);
    }
  }
});

test("Temu workbook keeps each cell's number format independent of its neighbours", async () => {
  // Column J (price) holds a number first then text; column X (suggested price) the other way
  // round. A style copied by reference, or captured after row 2 was written, leaks the text
  // format "@" from one row into the other row's number cell.
  const first = blankCells();
  const second = blankCells();
  Object.assign(first, { "*产品标题": "标题一", [PRICE_HEADER]: 19.99, "建议售价（USD）": "9.99" });
  Object.assign(second, { "*产品标题": "标题二", [PRICE_HEADER]: "面议", "建议售价（USD）": 8.5 });
  const plan = {
    rows: [
      { setId: "set-fmt", productName: "格式", skuId: "a", skuName: "甲", cells: first },
      { setId: "set-fmt", productName: "格式", skuId: "b", skuName: "乙", cells: second },
    ],
    issues: [],
  };

  const result = await buildTemuWorkbookBuffer({ plan, includeIssueSheet: false });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const sheet = workbook.getWorksheet("导入模板");

  assert.equal(sheet.getCell("J2").value, 19.99);
  assert.equal(sheet.getCell("J2").numFmt ?? null, null, "J2 holds a number yet was formatted as text");
  assert.equal(sheet.getCell("J3").value, "面议");
  assert.equal(sheet.getCell("J3").numFmt, "@", "J3 holds text yet lost the text format");
  assert.equal(sheet.getCell("X2").value, "9.99");
  assert.equal(sheet.getCell("X2").numFmt, "@", "X2 holds text yet lost the text format");
  assert.equal(sheet.getCell("X3").value, 8.5);
  assert.equal(sheet.getCell("X3").numFmt ?? null, null, "X3 holds a number yet was formatted as text");
});

function issueHeavyPlan(issueCount) {
  const cells = blankCells();
  cells["*产品标题"] = "体积探针";
  return {
    rows: [{ setId: "set-size", productName: "体积", skuId: "a", skuName: "甲", cells }],
    issues: Array.from({ length: issueCount }, (_, index) => ({
      severity: "阻塞",
      code: "MISSING_REQUIRED_FIELD",
      setId: `creation-set-${index.toString(36)}`,
      productName: `商品名称占位 ${index}`,
      skuId: `sku-${index}`,
      skuName: `规格 ${index}`,
      dataRow: 2,
      field: TEMU_TEMPLATE_HEADERS[index % TEMU_TEMPLATE_HEADERS.length],
      message: `第 ${index} 条必填字段缺失，导入前必须补齐该列内容。`,
      source: "套图记录字段解析",
      suggestion: `补齐 ${TEMU_TEMPLATE_HEADERS[index % TEMU_TEMPLATE_HEADERS.length]} 后重新导出。`,
    })),
  };
}

test("Temu workbook applies no output size cap unless one is passed", async () => {
  // The batch path never passes maxOutputBytes, and its issue sheet is unbounded, so a default
  // cap would turn today's working multi-megabyte downloads into failures.
  const source = await readFile(new URL("../lib/creation-temu-workbook.mjs", import.meta.url), "utf8");
  assert.match(source, /maxOutputBytes = null/u, "maxOutputBytes must default to no limit");

  const large = await buildTemuWorkbookBuffer({ plan: issueHeavyPlan(11000) });
  assert.ok(large.buffer.length > 512 * 1024, `expected a large workbook, got ${large.buffer.length} bytes`);
  assert.equal(large.issueCount, 11000);

  const small = await buildTemuWorkbookBuffer({ plan: makePlan() });
  await assert.rejects(
    buildTemuWorkbookBuffer({ plan: makePlan(), maxOutputBytes: small.buffer.length - 1 }),
    (error) => error?.code === "TEMU_WORKBOOK_TOO_LARGE" && /超过/u.test(error.message),
  );
  const atLimit = await buildTemuWorkbookBuffer({ plan: makePlan(), maxOutputBytes: small.buffer.length });
  assert.equal(atLimit.buffer.length, small.buffer.length);

  for (const invalid of [0, -1, Number.NaN, "3mb"]) {
    await assert.rejects(
      buildTemuWorkbookBuffer({ plan: makePlan(), maxOutputBytes: invalid }),
      (error) => error?.code === "TEMU_WORKBOOK_INVALID" && /体积上限/u.test(error.message),
      `maxOutputBytes: ${String(invalid)} should be rejected outright`,
    );
  }
});
