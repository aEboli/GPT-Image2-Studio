import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import {
  TEMU_EXPORT_LIMITS,
  TEMU_TEMPLATE_HEADERS,
  sanitizeTemuCellText,
} from "./creation-temu-export.mjs";

export const TEMU_TEMPLATE_SHA256 = "8008B60BB1CCBD8F45D7B07F41445379BAC79B62CAEE9FD2465ADB95AAAD6DC8";
export const TEMU_TEMPLATE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "templates",
  "temu-import-template-v1.xlsx",
);

const TEMPLATE_SHEET_NAME = "导入模板";
const EXAMPLE_SHEET_NAME = "导入示例";
const ISSUE_SHEET_BASENAME = "导出问题";
const ISSUE_HEADERS = Object.freeze([
  "严重级别",
  "问题代码",
  "setId",
  "商品名称",
  "SKU ID/名称",
  "数据行号",
  "模板字段/列",
  "问题说明",
  "当前来源",
  "建议处理",
]);

const CELL_CHANGE_MESSAGES = Object.freeze({
  CELL_FORMULA_LITERAL: "检测到公式触发字符，已按普通文本写入。",
  CELL_INVALID_UNICODE_REPLACED: "检测到无效 Unicode，已替换为可写入字符。",
  CELL_VALUE_TRUNCATED: `内容超过 Excel ${TEMU_EXPORT_LIMITS.maxCellCharacters} 字符限制，已安全截断。`,
  CELL_XML_CONTROL_REMOVED: "检测到 XML 不允许的控制字符，已移除。",
});

function workbookError(message) {
  const error = new Error(message);
  error.code = "TEMU_WORKBOOK_INVALID";
  return error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function assertTemplateStructure(workbook) {
  const templateSheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
  const exampleSheet = workbook.getWorksheet(EXAMPLE_SHEET_NAME);
  if (!templateSheet || !exampleSheet) {
    throw workbookError("Temu 模板缺少导入模板或导入示例工作表。");
  }
  if (templateSheet.columnCount !== TEMU_TEMPLATE_HEADERS.length) {
    throw workbookError(`Temu 导入模板必须包含 ${TEMU_TEMPLATE_HEADERS.length} 列。`);
  }
  const headers = templateSheet.getRow(1).values.slice(1, TEMU_TEMPLATE_HEADERS.length + 1);
  if (headers.length !== TEMU_TEMPLATE_HEADERS.length || headers.some((value, index) => value !== TEMU_TEMPLATE_HEADERS[index])) {
    throw workbookError("Temu 导入模板关键表头与当前版本不匹配。");
  }
  if (exampleSheet.columnCount !== 52) {
    throw workbookError("Temu 导入示例工作表结构与当前版本不匹配。");
  }
  return { templateSheet, exampleSheet };
}

async function loadVerifiedTemplate({ templatePath = TEMU_TEMPLATE_PATH, expectedSha256 = TEMU_TEMPLATE_SHA256 } = {}) {
  let bytes;
  try {
    bytes = await readFile(templatePath);
  } catch {
    throw workbookError("Temu 标准模板不存在或无法读取。");
  }
  const actualSha256 = sha256(bytes);
  if (expectedSha256 && actualSha256 !== String(expectedSha256).toUpperCase()) {
    throw workbookError("Temu 模板身份校验失败（SHA-256 不匹配）。");
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw workbookError("Temu 标准模板不是可读取的 XLSX 工作簿。");
  }
  const sheets = assertTemplateStructure(workbook);
  return { bytes, workbook, actualSha256, ...sheets };
}

export async function verifyTemuTemplate(options = {}) {
  const verified = await loadVerifiedTemplate(options);
  return {
    sha256: verified.actualSha256,
    sheetName: TEMPLATE_SHEET_NAME,
    exampleSheetName: EXAMPLE_SHEET_NAME,
    columnCount: TEMU_TEMPLATE_HEADERS.length,
  };
}

function issueSheetName(workbook) {
  if (!workbook.getWorksheet(ISSUE_SHEET_BASENAME)) return ISSUE_SHEET_BASENAME;
  let suffix = 2;
  while (workbook.getWorksheet(`${ISSUE_SHEET_BASENAME} (${suffix})`)) suffix += 1;
  return `${ISSUE_SHEET_BASENAME} (${suffix})`;
}

function redactIssueText(value) {
  return String(value ?? "")
    .replace(/\b[A-Za-z]:[\\/][^\r\n\t]*/gu, "[本地路径已隐藏]")
    .replace(/\b(api[_-]?secret|authorization|cookie)\b\s*[:=]\s*[^\s,;]+/giu, "$1=[已隐藏]");
}

function sanitizedIssueValue(value) {
  return sanitizeTemuCellText(redactIssueText(value)).value;
}

function cellChangeIssue(row, field, change) {
  const originalLengthNote = Number.isSafeInteger(change?.originalLength)
    ? " 原始长度：" + change.originalLength + " 个 UTF-16 代码单元。"
    : "";
  return {
    severity: "警告",
    code: change.code,
    setId: row.setId,
    productName: row.productName,
    skuId: row.skuId,
    skuName: row.skuName,
    dataRow: row.dataRow,
    field,
    message: (CELL_CHANGE_MESSAGES[change.code] || "单元格内容已按 Excel 安全规则处理。") + originalLengthNote,
    source: "导出写入检查",
    suggestion: "导入前核对处理后的单元格内容。",
  };
}

function writeDataRows(templateSheet, plan, issues) {
  if (!Array.isArray(plan?.rows) || plan.rows.length === 0) {
    throw workbookError("Temu 导出没有可写入的数据行。");
  }
  if (plan.rows.length > TEMU_EXPORT_LIMITS.maxRows) {
    throw workbookError(`Temu 导出数据行不得超过 ${TEMU_EXPORT_LIMITS.maxRows} 行。`);
  }

  plan.rows.forEach((row, rowIndex) => {
    const targetRow = rowIndex + 2;
    row.dataRow = targetRow;
    TEMU_TEMPLATE_HEADERS.forEach((header, columnIndex) => {
      const cell = templateSheet.getCell(targetRow, columnIndex + 1);
      const rawValue = row?.cells?.[header];
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        cell.value = null;
        return;
      }
      if (typeof rawValue === "number") {
        if (!Number.isFinite(rawValue)) {
          cell.value = null;
          issues.push(cellChangeIssue(row, header, { code: "CELL_INVALID_NUMBER_REMOVED" }));
          return;
        }
        cell.value = rawValue;
        return;
      }

      const sanitized = sanitizeTemuCellText(rawValue);
      cell.value = sanitized.value;
      cell.numFmt = "@";
      for (const change of sanitized.changes) {
        issues.push(cellChangeIssue(row, header, change));
      }
    });
  });
}

function styleIssueSheet(sheet, issueCount) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `J${Math.max(1, issueCount + 1)}` };
  sheet.getRow(1).height = 28;
  sheet.getRow(1).font = { name: "Microsoft YaHei", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24443D" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  const widths = [10, 28, 24, 24, 28, 12, 24, 52, 24, 48];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  for (let row = 2; row <= issueCount + 1; row += 1) {
    sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
  }
}

function writeIssueSheet(workbook, issues) {
  const name = issueSheetName(workbook);
  const sheet = workbook.addWorksheet(name, { properties: { defaultRowHeight: 20 } });
  sheet.addRow(ISSUE_HEADERS);
  for (const issue of issues) {
    const skuLabel = [issue?.skuId, issue?.skuName].map((value) => String(value || "").trim()).filter(Boolean).join(" / ");
    sheet.addRow([
      sanitizedIssueValue(issue?.severity || "警告"),
      sanitizedIssueValue(issue?.code || "UNKNOWN_EXPORT_ISSUE"),
      sanitizedIssueValue(issue?.setId),
      sanitizedIssueValue(issue?.productName),
      sanitizedIssueValue(skuLabel),
      Number.isSafeInteger(Number(issue?.dataRow)) ? Number(issue.dataRow) : null,
      sanitizedIssueValue(issue?.field),
      sanitizedIssueValue(issue?.message),
      sanitizedIssueValue(issue?.source),
      sanitizedIssueValue(issue?.suggestion),
    ]);
  }
  styleIssueSheet(sheet, issues.length);
  return name;
}

async function assertGeneratedWorkbook(buffer, { rowCount, issueSheetName, issueCount }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const { templateSheet } = assertTemplateStructure(workbook);
  const issueSheet = workbook.getWorksheet(issueSheetName);
  if (!issueSheet || issueSheet.rowCount !== issueCount + 1) {
    throw workbookError("Temu 导出问题工作表回读校验失败。");
  }
  if (templateSheet.actualRowCount < rowCount + 1) {
    throw workbookError("Temu 导出数据行回读校验失败。");
  }
}

export async function buildTemuWorkbookBuffer({
  plan,
  templatePath = TEMU_TEMPLATE_PATH,
  expectedSha256 = TEMU_TEMPLATE_SHA256,
} = {}) {
  const { workbook, templateSheet } = await loadVerifiedTemplate({ templatePath, expectedSha256 });
  const issues = Array.isArray(plan?.issues) ? plan.issues.map((issue) => ({ ...issue })) : [];
  writeDataRows(templateSheet, plan, issues);
  const name = writeIssueSheet(workbook, issues);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = {
    buffer,
    issueSheetName: name,
    rowCount: plan.rows.length,
    issueCount: issues.length,
  };
  await assertGeneratedWorkbook(buffer, result);
  return result;
}
