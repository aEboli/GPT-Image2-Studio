// 上品工作台的草稿计划构建器：把人工编辑的商品草稿映射成 lib/creation-temu-workbook.mjs
// 能直接消费的 { rows: [{ cells, … }], issues } 计划。
//
// 这里刻意不写第二个工作簿写入器。写入器 writeDataRows 是按表头取值的（遍历表头读
// row.cells[header]），所以只要把 51 元素定位数组与 TEMU_TEMPLATE_HEADERS zip 成 cells 对象，
// 现有 exceljs 写入器即原样复用，连带白拿 sanitizeTemuCellText（公式字面量标记、32767 截断、
// 控制符清理）与生成后回读断言。工作台路径应传 includeIssueSheet: false 以产出 2 sheet 形态。
import { TEMU_TEMPLATE_HEADERS } from "../temu/template-headers.mjs";
import { normalizeDraft, validateDraft } from "../temu/domain.mjs";

// 工作台导出一律按“已是公网 URL”校验：不接受本地来源，也不在导出期代为上传。
const WORKBENCH_VALIDATION_OPTIONS = Object.freeze({
  allowLocalSources: false,
  requirePublicImageUrls: true,
});

function text(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function number(value) {
  if (value === "" || value == null) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function join(values, separator) {
  const normalized = Array.isArray(values) ? values.map(text).filter(Boolean) : [];
  return normalized.length ? normalized.join(separator) : null;
}

function assetUrls(assets) {
  return join((assets || []).map((asset) => asset?.url), "\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildProductDescriptionHtml(imageUrl, description) {
  const normalizedImageUrl = text(imageUrl);
  const image = normalizedImageUrl ? `<img src="${escapeHtml(normalizedImageUrl)}"/><br>` : "";
  const paragraphs = String(description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  return `${image}${paragraphs}`;
}

// 51 个定位值，顺序必须与 TEMU_TEMPLATE_HEADERS 一一对应；zipTemplateRowCells 会核对长度。
export function mapNormalizedSkuToTemplateRow(draft, sku) {
  const product = draft.product;
  return [
    text(product.title),
    text(product.englishTitle),
    text(buildProductDescriptionHtml(draft.assets.carousel[0]?.url, product.description)),
    text(product.productCode),
    text(draft.variants.name1),
    text(sku.variant1Value),
    text(draft.variants.name2),
    text(sku.variant2Value),
    text(sku.image?.url),
    number(sku.declaredPrice),
    text(sku.skuCode),
    number(sku.length),
    number(sku.width),
    number(sku.height),
    number(sku.weight),
    text(product.identifierType),
    text(product.identifier),
    text(product.externalProductUrl),
    assetUrls(draft.assets.carousel),
    text(draft.assets.carousel[0]?.url),
    text(product.packagingShape),
    text(product.packagingType),
    assetUrls(draft.assets.packaging),
    number(product.suggestedPrice),
    number(sku.inventory),
    number(product.leadTime),
    text(product.customProduct),
    text(product.productVideoUrl),
    text(product.descriptionVideoUrl),
    text(product.manualUrl),
    join(product.manualLanguages, ","),
    text(product.skuCategoryType),
    number(product.skuCategoryQuantity),
    text(product.skuCategoryUnit),
    text(product.independentPackaging),
    number(product.netContent),
    text(product.netContentUnit),
    number(product.piecesInside),
    text(product.sameProduct),
    number(product.totalNetContent),
    text(product.totalNetContentUnit),
    join(product.packageList, "\n"),
    join(product.packageQuantities, "\n"),
    text(product.sensitive),
    join(product.sensitiveValues, ","),
    number(product.batteryCapacity),
    number(product.knifeLength),
    number(product.bladeAngle),
    number(product.liquidCapacity),
    join(product.sourceUrls, "\n"),
    text(product.origin),
  ];
}

export function mapSkuToTemplateRow(draftInput, sku) {
  return mapNormalizedSkuToTemplateRow(normalizeDraft(draftInput), sku);
}

function draftPlanError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  return Object.assign(error, extra);
}

// 定位数组与表头 zip 成 cells。长度不符即抛错，而不是静默让新增列写成 undefined——
// 表头是全仓单一声明，任何一次改表头都必须同时改这里的映射。
export function zipTemplateRowCells(values) {
  if (!Array.isArray(values) || values.length !== TEMU_TEMPLATE_HEADERS.length) {
    throw draftPlanError(
      "TEMU_DRAFT_ROW_ARITY",
      `Temu 草稿行必须映射为 ${TEMU_TEMPLATE_HEADERS.length} 个定位值，实际 ${Array.isArray(values) ? values.length : 0} 个。`,
    );
  }
  return Object.fromEntries(TEMU_TEMPLATE_HEADERS.map((header, index) => [header, values[index]]));
}

function prefixedIssue(issue, index, batch) {
  return {
    ...issue,
    path: batch ? `drafts.${index}.${issue.path}` : issue.path,
    message: batch ? `商品 ${index + 1}：${issue.message}` : issue.message,
  };
}

const SKU_PATH_PATTERN = /^skus\.(\d+)(?:\.|$)/u;

// 校验警告转成写入器的 issue 形状，使 includeIssueSheet: false 时它们仍能随结果回到调用方。
// field 留空：草稿路径不是模板列名，硬塞进“模板字段/列”会得到一个查不到的列号。
// suggestion 同样留空，因为被吸收侧的警告本身不带建议，凭空补一句属于编造。
function warningIssue(row, warning) {
  return {
    severity: "警告",
    code: warning?.code || "DRAFT_VALIDATION_WARNING",
    setId: row?.setId || "",
    productName: row?.productName || "",
    skuId: row?.skuId || "",
    skuName: row?.skuName || "",
    dataRow: row?.dataRow ?? null,
    field: "",
    message: String(warning?.message ?? ""),
    source: String(warning?.path ?? ""),
    suggestion: "",
  };
}

export function buildTemuDraftPlan({ drafts } = {}) {
  const batch = Array.isArray(drafts);
  const draftInputs = batch ? drafts : [drafts];
  const validations = draftInputs.map((input) => validateDraft(input, WORKBENCH_VALIDATION_OPTIONS));
  const errors = validations.flatMap((validation, index) =>
    validation.errors.map((issue) => prefixedIssue(issue, index, batch)));
  // 保留每条警告的来源草稿序号与草稿内路径，避免之后再从带前缀的 path 反解一次。
  const locatedWarnings = validations.flatMap((validation, index) =>
    validation.warnings.map((issue) => ({
      warning: prefixedIssue(issue, index, batch),
      draftIndex: index,
      localPath: String(issue.path ?? ""),
    })));
  const warnings = locatedWarnings.map((entry) => entry.warning);

  if (!draftInputs.length || errors.length) {
    if (!draftInputs.length) {
      errors.push({ path: "drafts", code: "draft_required", message: "至少需要一个商品草稿" });
    }
    throw draftPlanError("VALIDATION_ERROR", "导出数据未通过校验", {
      validation: { valid: false, drafts: validations.map((item) => item.draft), errors, warnings },
    });
  }

  const validatedDrafts = validations.map((validation) => validation.draft);
  const rows = [];
  validatedDrafts.forEach((draft, draftIndex) => {
    const setId = String(draft?.studioImport?.setId ?? "");
    const productName = String(draft?.studioImport?.productName ?? "") || String(draft.product.title ?? "");
    draft.skus.forEach((sku, skuIndex) => {
      rows.push({
        setId,
        productName,
        skuId: String(sku.skuCode ?? ""),
        skuName: [sku.variant1Value, sku.variant2Value].map((value) => String(value ?? "").trim()).filter(Boolean).join(" / "),
        rowKey: `${draftIndex}:${skuIndex}`,
        draftIndex,
        skuIndex,
        // 写入器自己会覆写 dataRow，这里先算出同一个值，好让警告能指向正确的数据行号。
        dataRow: rows.length + 2,
        cells: zipTemplateRowCells(mapNormalizedSkuToTemplateRow(draft, sku)),
      });
    });
  });

  const firstRowOfDraft = new Map();
  for (const row of rows) {
    if (!firstRowOfDraft.has(row.draftIndex)) firstRowOfDraft.set(row.draftIndex, row);
  }
  const issues = locatedWarnings.map(({ warning, draftIndex, localPath }) => {
    const skuMatch = SKU_PATH_PATTERN.exec(localPath);
    const row = skuMatch
      ? rows.find((entry) => entry.draftIndex === draftIndex && entry.skuIndex === Number(skuMatch[1]))
      : firstRowOfDraft.get(draftIndex);
    return warningIssue(row ?? firstRowOfDraft.get(draftIndex) ?? null, warning);
  });

  return {
    rows,
    issues,
    validation: batch
      ? { valid: true, drafts: validatedDrafts, errors: [], warnings }
      : validations[0],
  };
}
