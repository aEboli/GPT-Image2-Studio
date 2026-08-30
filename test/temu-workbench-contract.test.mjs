// 吸收 TEMU 上品工作台的「诚实网」：跨模块契约守卫。
//
// 本文件只断言 invariant，不测单个模块的行为（那是各模块自己的测试）。每条断言都必须在对应
// invariant 被破坏时变红——每组守卫都配了一条 detector 自检，用现造的坏输入证明探测器真会响，
// 否则「四处共用同一张表」这类断言读起来像覆盖，实际上是空的。
//
// 表本身就是测试主体：凡两侧规则确有分歧，一律把分歧逐格写进期望值，而不是删掉那一格。
import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import { TEMU_STUDIO_IMAGE_PATH, TEMU_TEMPLATE_HEADERS } from "../lib/temu/template-headers.mjs";
import {
  TEMU_TEMPLATE_HEADERS as HEADERS_FROM_EXPORT,
  buildCloudinarySquareMaterialUrl,
  createTemuExportPlan,
  finalizeTemuExportPlan,
  isPublicHttpsImageUrl,
} from "../lib/creation-temu-export.mjs";
import {
  TEMPLATE_HEADERS as HEADERS_FROM_DOMAIN,
  createDefaultDraft,
  inspectPublicUrl,
  normalizeDraft,
  validateDraft,
} from "../lib/temu/domain.mjs";
import { TEMU_TEMPLATE_PATH, buildTemuWorkbookBuffer } from "../lib/creation-temu-workbook.mjs";
import {
  buildTemuDraftPlan,
  mapNormalizedSkuToTemplateRow,
  zipTemplateRowCells,
} from "../lib/temu-server/draft-plan.mjs";
import { verifyCreationTemuRemoteImage } from "../lib/creation-temu-remote-images.mjs";
import { createSkuImageFromCarousel } from "../lib/temu/sku-image-quick-edit.mjs";
import { verifyDraftPublicImages } from "../lib/temu-server/public-image-verifier.mjs";
import { buildCreationTemuPreflightSummary } from "../lib/creation-temu-preflight.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF_RELATIVE_PATH = join("test", "temu-workbench-contract.test.mjs");

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

async function withTempDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "temu-contract-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* ==========================================================================
 * 12.1 — 三向表头相等
 * ======================================================================== */

// 纯函数，好让同一套比较逻辑既跑真模板又跑现造的坏表头（detector 自检）。
function headerMismatches(declared, actual) {
  const mismatches = [];
  const length = Math.max(declared.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    if (declared[index] !== actual[index]) {
      mismatches.push(
        `第 ${index + 1} 列（${columnLetter(index)}1）：声明 ${JSON.stringify(declared[index])}`
        + `，实际 ${JSON.stringify(actual[index])}`,
      );
    }
  }
  return mismatches;
}

async function readTemplateHeaderRow() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMU_TEMPLATE_PATH);
  const sheet = workbook.getWorksheet("导入模板");
  assert.ok(sheet, "模板缺少工作表 导入模板");
  const values = [];
  for (let column = 1; column <= TEMU_TEMPLATE_HEADERS.length; column += 1) {
    values.push(String(sheet.getRow(1).getCell(column).value ?? ""));
  }
  return values;
}

test("三向表头相等：template-headers、creation-temu-export 再导出、temu/domain 再导出指向同一引用", () => {
  assert.equal(
    HEADERS_FROM_EXPORT,
    TEMU_TEMPLATE_HEADERS,
    "lib/creation-temu-export.mjs 必须只做再导出；出现第二份 51 元素数组即为分叉",
  );
  assert.equal(
    HEADERS_FROM_DOMAIN,
    TEMU_TEMPLATE_HEADERS,
    "lib/temu/domain.mjs 的 TEMPLATE_HEADERS 必须只做再导出，不得自带一份表头",
  );
  assert.ok(Object.isFrozen(TEMU_TEMPLATE_HEADERS), "表头声明必须冻结");
  assert.equal(TEMU_TEMPLATE_HEADERS.length, 51);
  assert.equal(new Set(TEMU_TEMPLATE_HEADERS).size, 51, "表头不得有重复列名");
  assert.equal(columnLetter(50), "AY", "末列必须落在 AY");
});

test("三个表头来源逐列等于模板实际 A1:AY1，不等时报出列位置", async () => {
  const actual = await readTemplateHeaderRow();
  for (const [label, source] of [
    ["lib/temu/template-headers.mjs", TEMU_TEMPLATE_HEADERS],
    ["lib/creation-temu-export.mjs", HEADERS_FROM_EXPORT],
    ["lib/temu/domain.mjs", HEADERS_FROM_DOMAIN],
  ]) {
    const mismatches = headerMismatches(source, actual);
    assert.deepEqual(mismatches, [], `${label} 已与模板漂移：\n${mismatches.join("\n")}`);
  }
});

// 刻意用现造的两组表头，不读真模板、也不读真声明：真声明一旦被改坏，
// 上面那条守卫本就该红，而这条自检要证明的是「比较器会响」，不能跟着一起红。
test("detector 自检：表头比较器在任一列被改坏时确实报出该列与列字母", () => {
  const baseline = Array.from({ length: 51 }, (_, index) => `列${index + 1}`);
  assert.deepEqual(headerMismatches([...baseline], baseline), [], "两侧相同必须没有差异");

  const broken = [...baseline];
  broken[48] = "列49-BROKEN";
  const mismatches = headerMismatches(broken, baseline);
  assert.equal(mismatches.length, 1, "只改一列就应当只报一列");
  assert.match(mismatches[0], /第 49 列（AW1）/u);

  // 长度不等也必须被报出来，而不是静默按较短的一侧比完就算过。
  assert.equal(headerMismatches(baseline.slice(0, 50), baseline).length, 1);
  assert.equal(headerMismatches([...baseline, "列52"], baseline).length, 1);
});

/* ==========================================================================
 * 12.1 — golden-draft 等价：同一个逻辑商品分别过两条映射
 * ======================================================================== */

const CAROUSEL_A = "https://res.cloudinary.com/demo/image/upload/carousel-a.jpg";
const CAROUSEL_B = "https://res.cloudinary.com/demo/image/upload/carousel-b.jpg";
const SKU_IMAGE = "https://res.cloudinary.com/demo/image/upload/sku-white.jpg";

// 被吸收侧：人工编辑的草稿。第三张轮播图刻意重复第一张，用来钉住去重分歧。
function goldenDraft() {
  const draft = createDefaultDraft();
  Object.assign(draft.product, {
    title: "便携收纳盒",
    englishTitle: "Portable Storage Box",
    description: "桌面小物分类收纳盒。",
    productCode: "BOX-001",
    suggestedPrice: "19.99",
    inventory: "50",
    leadTime: "2",
    origin: "中国大陆-浙江省",
  });
  draft.variants = { name1: "颜色", values1: ["白色"], name2: "", values2: [] };
  draft.assets.carousel = [
    { id: "c1", name: "a.jpg", url: CAROUSEL_A, width: 1200, height: 1200, status: "verified" },
    { id: "c2", name: "b.jpg", url: CAROUSEL_B, width: 1200, height: 1200, status: "verified" },
    { id: "c3", name: "a-dup.jpg", url: CAROUSEL_A, width: 1200, height: 1200, status: "verified" },
  ];
  draft.skus = [{
    key: '["白色",""]',
    variant1Value: "白色",
    variant2Value: "",
    skuCode: "BOX-001-WHITE",
    declaredPrice: "12.5",
    length: "20",
    width: "15",
    height: "8",
    weight: "380",
    inventory: "50",
    image: { id: "s1", name: "s.jpg", url: SKU_IMAGE, width: 1200, height: 1200, status: "verified" },
  }];
  return draft;
}

// Studio 侧：同一个商品表达成一条套图记录。hero 与 carousel[0] 刻意同图，
// 因为 design.md 记录的「素材图取图来源两侧不同」（被吸收侧取 carousel[0]、Studio 取 hero）
// 属 set→draft 层差异，本方向的等价测试抓不到；此处消除它才能单独检验 draft→row 的换算。
function goldenSet() {
  return {
    setId: "creation-set-golden",
    productName: "便携收纳盒",
    listingDrafts: [{
      title: "Portable Storage Box",
      description: "桌面小物分类收纳盒。",
      packageDimensions: "20 x 15 x 8 cm",
      packageWeight: "380 g",
      zhDisplay: { title: "便携收纳盒" },
    }],
    skuSubjects: [{ id: "BOX-001-WHITE", title: "白色", bundleCount: 1 }],
    items: [
      { itemId: "hero-1", slotIndex: 1, role: "hero", status: "completed", filename: "a.jpg", relativePath: "s/a.jpg" },
      { itemId: "scene-1", slotIndex: 2, role: "scene", status: "completed", filename: "b.jpg", relativePath: "s/b.jpg" },
      { itemId: "scene-2", slotIndex: 3, role: "scene", status: "completed", filename: "a-dup.jpg", relativePath: "s/a-dup.jpg" },
      {
        itemId: "sku-1", slotIndex: 4, role: "sku", status: "completed", filename: "s.jpg", relativePath: "s/s.jpg",
        skuSubject: { id: "BOX-001-WHITE", title: "白色" },
      },
    ],
  };
}

function studioGoldenCells() {
  const plan = createTemuExportPlan({
    sets: [goldenSet()],
    defaults: {
      variantAttributeName: "颜色",
      defaultPrice: 12.5,
      defaultPackageLengthCm: 20,
      defaultPackageWidthCm: 15,
      defaultPackageHeightCm: 8,
      defaultPackageWeightG: 380,
      defaultStock: 50,
      defaultOriginCountry: "中国大陆-浙江省",
    },
  });
  const urlByFilename = {
    "a.jpg": CAROUSEL_A,
    "b.jpg": CAROUSEL_B,
    "a-dup.jpg": CAROUSEL_A,
    "s.jpg": SKU_IMAGE,
  };
  const imageResults = new Map(
    plan.imageRequirements.map((requirement) => [requirement.itemKey, { url: urlByFilename[requirement.item.filename] }]),
  );
  return finalizeTemuExportPlan(plan, imageResults).rows[0].cells;
}

test("zip 契约：51 元素定位数组逐位等于 表头.map(h => row.cells[h])", () => {
  const normalized = normalizeDraft(goldenDraft());
  const positional = mapNormalizedSkuToTemplateRow(normalized, normalized.skus[0]);
  const { rows } = buildTemuDraftPlan({ drafts: goldenDraft() });

  assert.equal(positional.length, TEMU_TEMPLATE_HEADERS.length);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    TEMU_TEMPLATE_HEADERS.map((header) => rows[0].cells[header]),
    positional,
    "定位数组与 cells 的列序已漂移：改表头必须同时改 mapNormalizedSkuToTemplateRow 的顺序",
  );
});

test("zip 契约：定位值个数不等于表头列数即抛 TEMU_DRAFT_ROW_ARITY，不静默写成 undefined", () => {
  const normalized = normalizeDraft(goldenDraft());
  const positional = mapNormalizedSkuToTemplateRow(normalized, normalized.skus[0]);
  for (const broken of [positional.slice(0, 50), [...positional, "第 52 个值"]]) {
    assert.throws(() => zipTemplateRowCells(broken), (error) => {
      assert.equal(error.code, "TEMU_DRAFT_ROW_ARITY");
      return true;
    }, `${broken.length} 个定位值本应被拒`);
  }
  assert.doesNotThrow(() => zipTemplateRowCells(positional));
});

// 换算表就是测试主体。每一列必须落在下面四类之一，且各类的列数被钉死：
// 任何一列改类（例如阶段三让 Studio 首次写出 产品货号）都会让计数断言先红，
// 迫使这张表随实现一起更新，而不是悄悄失配。
const VERDICT = {
  // 被吸收侧空文本/非有限数写 null，Studio 写 ""；写入器把二者一视同仁地写成空单元格。
  EQUAL_AFTER_NULL_COERCION: "EQUAL_AFTER_NULL_COERCION",
  // 被吸收侧在描述前插 hero <img>，Studio 不插。
  DESCRIPTION_HERO_IMG: "DESCRIPTION_HERO_IMG",
  // Studio 做 [...new Set(urls)].slice(0, 10)，被吸收侧只 filter(Boolean) 不去重。裁决：Studio 去重胜出。
  CAROUSEL_DEDUP: "CAROUSEL_DEDUP",
  // Studio 改写为 Cloudinary c_pad,b_white,h_1200,w_1200 派生 URL，被吸收侧写原始 URL。
  MATERIAL_URL_DERIVED: "MATERIAL_URL_DERIVED",
  // Studio 今天根本不写这一列（阶段三才写），被吸收侧已有值。
  STUDIO_UNIMPLEMENTED: "STUDIO_UNIMPLEMENTED",
};

const CONVERSION_VERDICTS = new Map([
  ["产品描述", VERDICT.DESCRIPTION_HERO_IMG],
  ["*轮播图", VERDICT.CAROUSEL_DEDUP],
  ["*产品素材图", VERDICT.MATERIAL_URL_DERIVED],
  ["产品货号", VERDICT.STUDIO_UNIMPLEMENTED],
  ["建议售价（USD）", VERDICT.STUDIO_UNIMPLEMENTED],
  ["发货时效（天）", VERDICT.STUDIO_UNIMPLEMENTED],
  ["是否定制品", VERDICT.STUDIO_UNIMPLEMENTED],
  ["是否敏感属性", VERDICT.STUDIO_UNIMPLEMENTED],
]);

const EXPECTED_VERDICT_COUNTS = {
  EQUAL_AFTER_NULL_COERCION: 43,
  DESCRIPTION_HERO_IMG: 1,
  CAROUSEL_DEDUP: 1,
  MATERIAL_URL_DERIVED: 1,
  STUDIO_UNIMPLEMENTED: 5,
};

function verdictOf(header) {
  return CONVERSION_VERDICTS.get(header) ?? VERDICT.EQUAL_AFTER_NULL_COERCION;
}

// 把被吸收侧的值换算到 Studio 侧的表达。null → "" 是全表通用的第一步。
function convertAbsorbedToStudio(header, value) {
  const coerced = value === null || value === undefined ? "" : value;
  switch (verdictOf(header)) {
    case VERDICT.DESCRIPTION_HERO_IMG:
      // 仅对「纯文本描述」成立：两侧对已含 HTML 的输入策略不同（design.md 已记录二次转义缺陷）。
      return String(coerced).replace(/^<img src="[^"]*"\/><br>/u, "");
    case VERDICT.CAROUSEL_DEDUP:
      return [...new Set(String(coerced).split("\n").filter(Boolean))].slice(0, 10).join("\n");
    case VERDICT.MATERIAL_URL_DERIVED:
      return buildCloudinarySquareMaterialUrl(coerced) || coerced;
    default:
      return coerced;
  }
}

test("换算表覆盖全部 51 列，且每类列数被钉死", () => {
  const counts = {};
  for (const header of TEMU_TEMPLATE_HEADERS) {
    const verdict = verdictOf(header);
    counts[verdict] = (counts[verdict] ?? 0) + 1;
  }
  assert.deepEqual(
    counts,
    EXPECTED_VERDICT_COUNTS,
    "某一列的换算类别已变化：先更新 CONVERSION_VERDICTS 与 EXPECTED_VERDICT_COUNTS，再改实现",
  );
  assert.equal(
    Object.values(EXPECTED_VERDICT_COUNTS).reduce((sum, value) => sum + value, 0),
    TEMU_TEMPLATE_HEADERS.length,
  );
  for (const header of CONVERSION_VERDICTS.keys()) {
    assert.ok(TEMU_TEMPLATE_HEADERS.includes(header), `换算表里的 ${header} 不是模板列名`);
  }
});

test("golden-draft 等价：换算后被吸收侧与 Studio 侧逐列相等", () => {
  const absorbed = buildTemuDraftPlan({ drafts: goldenDraft() }).rows[0].cells;
  const studio = studioGoldenCells();

  const mismatches = [];
  for (const [index, header] of TEMU_TEMPLATE_HEADERS.entries()) {
    if (verdictOf(header) === VERDICT.STUDIO_UNIMPLEMENTED) continue;
    const converted = convertAbsorbedToStudio(header, absorbed[header]);
    const expected = studio[header] === null || studio[header] === undefined ? "" : studio[header];
    if (converted !== expected) {
      mismatches.push(
        `第 ${index + 1} 列（${columnLetter(index)}）${JSON.stringify(header)} [${verdictOf(header)}]：`
        + `换算后 ${JSON.stringify(converted)} ≠ Studio ${JSON.stringify(expected)}`,
      );
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `两条映射已在换算表之外分叉（阶段三合流前必须先修表）：\n${mismatches.join("\n")}`,
  );
});

test("STUDIO_UNIMPLEMENTED 五列确实是「Studio 写空、被吸收侧有值」，一旦 Studio 开始写就变红", () => {
  const absorbed = buildTemuDraftPlan({ drafts: goldenDraft() }).rows[0].cells;
  const studio = studioGoldenCells();
  for (const [header, verdict] of CONVERSION_VERDICTS) {
    if (verdict !== VERDICT.STUDIO_UNIMPLEMENTED) continue;
    assert.equal(studio[header], "", `${header}：Studio 已开始写这一列，换算表必须更新`);
    assert.notEqual(
      absorbed[header] === null || absorbed[header] === "" ? "" : "有值",
      "",
      `${header}：被吸收侧本应有值，否则这一列不该归入 STUDIO_UNIMPLEMENTED`,
    );
  }
});

test("换算规则 (a)：被吸收侧空值写 null、Studio 写 \"\"，写入器把二者写成同一个空单元格", async () => {
  const absorbed = buildTemuDraftPlan({ drafts: goldenDraft() }).rows[0].cells;
  const studio = studioGoldenCells();
  const absorbedNulls = TEMU_TEMPLATE_HEADERS.filter((header) => absorbed[header] === null);
  const studioBlanks = TEMU_TEMPLATE_HEADERS.filter((header) => studio[header] === "");

  assert.ok(absorbedNulls.length > 0, "被吸收侧必须真的产出 null，否则这条换算规则是虚的");
  assert.ok(studioBlanks.length > 0, "Studio 侧必须真的产出 \"\"");
  assert.deepEqual(
    TEMU_TEMPLATE_HEADERS.filter((header) => studio[header] === null),
    [],
    "Studio 侧不写 null；出现 null 说明 createBlankCells 的契约变了",
  );

  const cells = Object.fromEntries(TEMU_TEMPLATE_HEADERS.map((header) => [header, "占位"]));
  cells["识别码"] = null;
  cells["识别码类型"] = "";
  const { buffer } = await buildTemuWorkbookBuffer({
    plan: { rows: [{ setId: "s", productName: "p", skuId: "k", skuName: "n", rowKey: "r", cells }], issues: [] },
    includeIssueSheet: false,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("导入模板");
  const nullColumn = TEMU_TEMPLATE_HEADERS.indexOf("识别码") + 1;
  const blankColumn = TEMU_TEMPLATE_HEADERS.indexOf("识别码类型") + 1;
  assert.equal(sheet.getCell(2, nullColumn).value, null);
  assert.equal(sheet.getCell(2, blankColumn).value, null, "null 与 \"\" 必须落成同一个空单元格");
});

test("换算规则 (b)：逐列 text/number 之选与写入器的 numFmt \"@\" 契约", async () => {
  const absorbed = buildTemuDraftPlan({ drafts: goldenDraft() }).rows[0].cells;
  const studio = studioGoldenCells();

  // 两侧类型不同的列必须全部落在 STUDIO_UNIMPLEMENTED 里，否则是新分歧。
  const typeDivergent = TEMU_TEMPLATE_HEADERS.filter((header) => {
    if (absorbed[header] === null || absorbed[header] === undefined) return false;
    return typeof absorbed[header] !== typeof studio[header];
  });
  assert.deepEqual(
    typeDivergent,
    ["建议售价（USD）", "发货时效（天）"],
    "两侧 text/number 之选出现了新的分歧列",
  );
  for (const header of typeDivergent) {
    assert.equal(typeof absorbed[header], "number", `${header}：被吸收侧应逐列选 number`);
    assert.equal(studio[header], "", `${header}：Studio 今天不写这一列`);
  }

  // 写入器按 typeof 分支：字符串盖 numFmt "@"，数字不盖。模板第 2 行本身不带任何 numFmt，
  // 所以 "@" 只可能来自写入器自己那一步。
  const cells = Object.fromEntries(TEMU_TEMPLATE_HEADERS.map((header) => [header, "文本"]));
  cells["*申报价格\n(店铺币种)"] = 19.99;
  cells["库存"] = 50;
  const { buffer } = await buildTemuWorkbookBuffer({
    plan: { rows: [{ setId: "s", productName: "p", skuId: "k", skuName: "n", rowKey: "r", cells }], issues: [] },
    includeIssueSheet: false,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("导入模板");
  const numberFormats = [];
  const textWithoutAt = [];
  let textWithAt = 0;
  for (const [index, header] of TEMU_TEMPLATE_HEADERS.entries()) {
    const cell = sheet.getCell(2, index + 1);
    const numFmt = cell.style?.numFmt ?? null;
    if (typeof cell.value === "number") numberFormats.push([header, numFmt]);
    else if (numFmt === "@") textWithAt += 1;
    else textWithoutAt.push([header, numFmt]);
  }
  assert.deepEqual(
    numberFormats,
    [["*申报价格\n(店铺币种)", null], ["库存", null]],
    "数字单元格不得被盖上文本格式 \"@\"（Excel 与 Temu 导入器都会误读）",
  );
  assert.deepEqual(textWithoutAt, [], "字符串单元格必须全部带 numFmt \"@\"");
  assert.equal(textWithAt, TEMU_TEMPLATE_HEADERS.length - 2);
});

test("换算规则 (c)：轮播图去重——Studio 去重胜出，且域内对重复 URL 一条校验都没有", () => {
  const draft = goldenDraft();
  const urls = draft.assets.carousel.map((asset) => asset.url);
  assert.equal(urls.length, 3);
  assert.equal(new Set(urls).size, 2, "fixture 必须真的含一条重复 URL，否则这条规则测不到");

  const absorbed = buildTemuDraftPlan({ drafts: draft }).rows[0].cells["*轮播图"];
  const studio = studioGoldenCells()["*轮播图"];
  assert.equal(String(absorbed).split("\n").length, 3, "被吸收侧只 filter(Boolean)，不去重");
  assert.equal(String(studio).split("\n").length, 2, "Studio 侧做 [...new Set(urls)]");
  assert.equal(
    convertAbsorbedToStudio("*轮播图", absorbed),
    studio,
    "对被吸收侧套上 Studio 的去重后必须相等，否则本测试从第一天就是红的",
  );

  // 重复 URL 在被吸收侧的领域校验里完全合法：valid=true，且没有任何 duplicate 类 issue。
  const validation = validateDraft(draft, { allowLocalSources: false, requirePublicImageUrls: true });
  assert.equal(validation.valid, true, "同一 URL 放两次在被吸收侧本应校验通过（现状）");
  assert.deepEqual(
    [...validation.errors, ...validation.warnings].filter((issue) => /duplicate|重复/u.test(`${issue.code}${issue.message}`)),
    [],
    "域内出现重复 URL 校验是行为变化：需要同步更新换算表与 design.md 的记录",
  );
});

/* ==========================================================================
 * 12.1 — 三个 URL 校验器共用同一张私网/保留地址表
 * ======================================================================== */

// 三个实现点：
//   domain  = lib/temu/domain.mjs            inspectPublicUrl（被吸收侧，非图片字段容忍 http）
//   export  = lib/creation-temu-export.mjs   isPublicHttpsImageUrl（Studio 图片列，HTTPS-only）
//   remote  = lib/creation-temu-remote-images.mjs normalizeRemoteImageUrl + assertPublicDnsTarget
//             （未导出，经 verifyCreationTemuRemoteImage 这条唯一入口测；注入的 fetch/lookup
//              一被调用就说明地址已通过闸门，据此区分「拒在闸门」与「放行到网络」）
const REJECT = "reject";
const ACCEPT = "accept";

// 每一格都是实测值。凡三者不一致，分歧就写在这张表里而不是删掉该行——
// 删掉等于让三处继续分叉却没人知道。
const PRIVATE_RANGE_TABLE = [
  // ---- 三者一致拒绝：RFC1918 与经典保留段 ----
  { host: "10.0.0.1", note: "RFC1918 10/8", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "10.255.255.254", note: "RFC1918 10/8 上界", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "172.16.0.1", note: "RFC1918 172.16/12 下界", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "172.31.255.254", note: "RFC1918 172.16/12 上界", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "192.168.0.1", note: "RFC1918 192.168/16", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "192.168.255.254", note: "RFC1918 192.168/16 上界", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "127.0.0.1", note: "回环 127/8", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "169.254.169.254", note: "链路本地 169.254/16（云元数据）", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "0.0.0.0", note: "0/8", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "100.64.0.1", note: "CGNAT 100.64/10", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "198.18.0.1", note: "基准测试 198.18/15", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "198.19.255.254", note: "基准测试 198.18/15 上界", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "224.0.0.1", note: "组播 224/4", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "255.255.255.255", note: "广播", domain: REJECT, export: REJECT, remote: REJECT },
  // ---- 三者一致拒绝：IPv6 ----
  { host: "[::1]", note: "IPv6 回环", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[::]", note: "IPv6 未指定", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[fc00::1]", note: "fc00::/7 唯一本地", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[fd12:3456::1]", note: "fc00::/7 唯一本地", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[fe80::1]", note: "fe80::/10 链路本地", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[feb0::1]", note: "fe80::/10 上段", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[::ffff:10.0.0.1]", note: "IPv4-mapped（点分写法）", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[::ffff:192.168.1.1]", note: "IPv4-mapped（点分写法）", domain: REJECT, export: REJECT, remote: REJECT },
  { host: "[::ffff:a00:1]", note: "IPv4-mapped（十六进制写法，URL 规范化后的形态）", domain: REJECT, export: REJECT, remote: REJECT },
  // ---- 实测分歧：文档/保留段 ----
  // 只有 remote 带完整 CIDR 表；domain 与 export 的手写条件式漏掉这几段。
  { host: "198.51.100.7", note: "TEST-NET-2 198.51.100/24", domain: ACCEPT, export: ACCEPT, remote: REJECT },
  { host: "203.0.113.9", note: "TEST-NET-3 203.0.113/24", domain: ACCEPT, export: ACCEPT, remote: REJECT },
  { host: "192.0.2.5", note: "TEST-NET-1 192.0.2/24", domain: ACCEPT, export: REJECT, remote: REJECT },
  { host: "192.0.0.8", note: "IETF 协议分配 192.0.0/24", domain: ACCEPT, export: REJECT, remote: REJECT },
  { host: "[2001:db8::1]", note: "IPv6 文档段 2001:db8::/32", domain: REJECT, export: ACCEPT, remote: REJECT },
  // ---- 公网对照组：证明三者不是一律拒绝 ----
  { host: "172.15.0.1", note: "紧邻 172.16/12 下界之外，属公网", domain: ACCEPT, export: ACCEPT, remote: ACCEPT },
  { host: "172.32.0.1", note: "紧邻 172.16/12 上界之外，属公网", domain: ACCEPT, export: ACCEPT, remote: ACCEPT },
  { host: "8.8.8.8", note: "公网字面 IPv4", domain: ACCEPT, export: ACCEPT, remote: ACCEPT },
  // domain 对一切 IPv6 字面量都拒，理由是 hostname 里没有 "."，与私网表无关（见下一条测试）。
  { host: "[2606:4700::1111]", note: "公网字面 IPv6", domain: REJECT, export: ACCEPT, remote: ACCEPT },
];

async function remoteVerdict(host) {
  let reachedNetwork = false;
  try {
    await verifyCreationTemuRemoteImage({
      url: `https://${host}/image.png`,
      lookup: () => {
        reachedNetwork = true;
        throw new Error("lookup 不应被调用");
      },
      fetchImpl: () => {
        reachedNetwork = true;
        throw new Error("fetch 不应被调用");
      },
    });
  } catch {
    // 抛错本身不区分「拒在闸门」与「放行后网络失败」，只有 reachedNetwork 能区分。
  }
  return reachedNetwork ? ACCEPT : REJECT;
}

test("三个 URL 校验器对同一张私网/保留地址表的判定逐格符合实测契约", async () => {
  const mismatches = [];
  for (const entry of PRIVATE_RANGE_TABLE) {
    const url = `https://${entry.host}/image.png`;
    const actual = {
      domain: inspectPublicUrl(url).valid ? ACCEPT : REJECT,
      export: isPublicHttpsImageUrl(url) ? ACCEPT : REJECT,
      remote: await remoteVerdict(entry.host),
    };
    for (const validator of ["domain", "export", "remote"]) {
      if (actual[validator] !== entry[validator]) {
        mismatches.push(
          `${entry.host}（${entry.note}）在 ${validator}：期望 ${entry[validator]}，实际 ${actual[validator]}`,
        );
      }
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `URL 校验器与共用地址表出现偏离：\n${mismatches.join("\n")}`,
  );
});

test("核心私网段必须被三者一致拒绝，且对照组必须被三者一致接受（防止整表退化成一律拒绝）", async () => {
  const unanimousRejects = PRIVATE_RANGE_TABLE.filter(
    (entry) => entry.domain === REJECT && entry.export === REJECT && entry.remote === REJECT,
  );
  const unanimousAccepts = PRIVATE_RANGE_TABLE.filter(
    (entry) => entry.domain === ACCEPT && entry.export === ACCEPT && entry.remote === ACCEPT,
  );
  assert.equal(unanimousRejects.length, 23, "三者一致拒绝的条目数已变化");
  assert.equal(unanimousAccepts.length, 3, "公网对照组条目数已变化；没有对照组时「一律拒绝」也能骗过本表");

  // 逐条复核对照组：任何一处把公网地址也拒掉，都会在这里变红。
  for (const entry of unanimousAccepts) {
    const url = `https://${entry.host}/image.png`;
    assert.equal(inspectPublicUrl(url).valid, true, `${entry.host} 本应被 domain 接受`);
    assert.equal(isPublicHttpsImageUrl(url), true, `${entry.host} 本应被 export 接受`);
    assert.equal(await remoteVerdict(entry.host), ACCEPT, `${entry.host} 本应通过 remote 的闸门`);
  }
});

test("已记录的结构性差异：domain 拒掉一切 IPv6 字面量是因为 hostname 里没有 \".\"，与私网表无关", () => {
  for (const host of ["[::1]", "[fc00::1]", "[2606:4700::1111]", "[2001:db8::1]"]) {
    const result = inspectPublicUrl(`https://${host}/image.png`);
    assert.equal(result.valid, false);
    assert.equal(
      result.error,
      "本机或局域网地址无法被平台访问",
      `${host}：domain 的拒绝理由一旦变成私网表，说明它真正实现了 IPv6 判定，本条记录需更新`,
    );
  }
  // 反证：公网 IPv6 也被同一条理由拒掉，所以这是过度拒绝（偏安全侧），不是私网表在起作用。
  assert.equal(inspectPublicUrl("https://[2606:4700::1111]/i.png").valid, false);
  assert.equal(isPublicHttpsImageUrl("https://[2606:4700::1111]/i.png"), true);
});

test("已裁决的分层：inspectPublicUrl 对 http 只给警告，两个 Studio 校验器一律拒 http", async () => {
  const httpUrl = "http://cdn.example.com/image.png";
  const inspected = inspectPublicUrl(httpUrl);
  assert.equal(inspected.valid, true, "被吸收侧容忍 http（只服务 站外产品链接/视频/说明书/来源URL）");
  assert.equal(inspected.warning, "建议改用 HTTPS 地址");
  assert.equal(isPublicHttpsImageUrl(httpUrl), false, "Studio 图片列一律 HTTPS");
  assert.equal(await remoteVerdict("cdn.example.com"), ACCEPT, "同一主机的 https 形态应通过闸门");
  let reachedNetwork = false;
  await assert.rejects(
    verifyCreationTemuRemoteImage({
      url: httpUrl,
      lookup: () => { reachedNetwork = true; return []; },
      fetchImpl: () => { reachedNetwork = true; return null; },
    }),
    (error) => {
      assert.equal(error.code, "REMOTE_IMAGE_URL_INVALID");
      return true;
    },
  );
  assert.equal(reachedNetwork, false, "远程校验器必须在闸门处拒掉 http，不得先发请求");
});

test("图片字段一律走 HTTPS：即便 inspectPublicUrl 受理 http，validateDraft 仍对图片列报 https_required", () => {
  const draft = goldenDraft();
  draft.assets.carousel = [{ id: "c1", url: "http://cdn.example.com/a.jpg", width: 1200, height: 1200, status: "verified" }];
  draft.skus[0].image = { id: "s1", url: "http://cdn.example.com/s.jpg", width: 1200, height: 1200, status: "verified" };
  const validation = validateDraft(draft, { allowLocalSources: false, requirePublicImageUrls: true });
  const httpsRequired = validation.errors.filter((issue) => issue.code === "https_required").map((issue) => issue.path);
  assert.deepEqual(
    httpsRequired.sort(),
    ["assets.carousel.0", "skus.0.image"],
    "图片字段的 HTTPS 门禁必须独立于 inspectPublicUrl 的 http 容忍",
  );
  assert.equal(validation.valid, false);
});

/* ==========================================================================
 * 12.1 — square > 800 边界表：五个实现点共用一张表
 * ======================================================================== */

// 实现点清单（实测得到，与任务描述有一处出入，见 problems）：
//   1 remote-images      lib/creation-temu-remote-images.mjs  assertSquareDimensions（仅 sku/material 角色触发）
//   2 domain             lib/temu/domain.mjs                  validateDraft
//   3 quick-edit         lib/temu/sku-image-quick-edit.mjs    createSkuImageFromCarousel
//   4 verifier           lib/temu-server/public-image-verifier.mjs verifyDraftPublicImages
//   5 preflight          lib/creation-temu-preflight.mjs      buildCreationTemuPreflightSummary
// lib/creation-temu-images.mjs 里没有任何宽高/800/正方判定（它只 import isPublicHttpsImageUrl），
// 因此它不是第四个实现点；真正容易漏的第五处是 preflight。
const NA = "n/a";

function pngBytes(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

const SQUARE_IMAGE_URL = "https://cdn.example.com/sku.png";
const squareLookup = () => [{ address: "93.184.216.34", family: 4 }];

function squareDraft(width, height) {
  const draft = createDefaultDraft();
  Object.assign(draft.product, { title: "边界用例", englishTitle: "Boundary Case" });
  draft.variants = { name1: "颜色", values1: ["白色"], name2: "", values2: [] };
  draft.assets.carousel = [{ id: "c1", url: SQUARE_IMAGE_URL, width: 1200, height: 1200, status: "verified" }];
  draft.skus = [{
    key: '["白色",""]',
    variant1Value: "白色",
    variant2Value: "",
    skuCode: "BOUND-1",
    declaredPrice: "1",
    length: "1",
    width: "1",
    height: "1",
    weight: "1",
    inventory: "1",
    image: { id: "s1", url: SQUARE_IMAGE_URL, width, height, status: "verified" },
  }];
  return draft;
}

async function squarePointRemote(width, height) {
  // 该实现点永远从字节里量尺寸，构造不出「尺寸未知」这一格。
  if (width == null || height == null) return NA;
  try {
    await verifyCreationTemuRemoteImage({
      url: SQUARE_IMAGE_URL,
      role: "sku",
      lookup: squareLookup,
      fetchImpl: async () => new Response(pngBytes(width, height), { headers: { "content-type": "image/png" } }),
    });
    return ACCEPT;
  } catch (error) {
    return `reject:${error.code}`;
  }
}

function squarePointDomain(width, height) {
  const codes = validateDraft(squareDraft(width, height))
    .errors.filter((issue) => issue.path === "skus.0.image")
    .map((issue) => issue.code);
  return codes.length ? `reject:${codes.join("+")}` : ACCEPT;
}

function squarePointQuickEdit(width, height) {
  const asset = createSkuImageFromCarousel({ id: "x", url: SQUARE_IMAGE_URL, width, height, status: "verified" });
  return asset.status === "error" ? `reject:${asset.error}` : ACCEPT;
}

async function squarePointVerifier(width, height) {
  try {
    await verifyDraftPublicImages(squareDraft(1200, 1200), {
      verifyImage: async () => ({ url: SQUARE_IMAGE_URL, width, height, bytes: 1024, format: "png" }),
    });
    return ACCEPT;
  } catch (error) {
    return `reject:${(error.issues ?? []).map((issue) => issue.code).join("+")}`;
  }
}

function squarePointPreflight(width, height) {
  const summary = buildCreationTemuPreflightSummary({
    finalizedPlan: {
      rows: [{ setId: "s", skuId: "k", skuName: "n", dataRow: 2, cells: { "预览图": SQUARE_IMAGE_URL } }],
      issues: [],
      imageRequirements: [],
    },
    remoteVerification: {
      results: new Map([[SQUARE_IMAGE_URL, { url: SQUARE_IMAGE_URL, width, height }]]),
      issues: [],
    },
  });
  const codes = summary.blockers.filter((problem) => /DIMENSIONS/u.test(problem.code)).map((problem) => problem.code);
  return codes.length ? `reject:${codes.join("+")}` : ACCEPT;
}

// 边界是「大于 800」，因此 800×800 拒、801×801 收。最后一行「尺寸未知」是四处真会分叉的那一格：
// quick-edit 静默放行、domain 报 unverified_dimensions、verifier 与 preflight 各自用别的码拒掉。
// 把这一格写进表里，是这张表能不能真起作用的分界；漏掉它，四处仍然分叉而守卫是空的。
const SQUARE_BOUNDARY_TABLE = [
  {
    label: "800×800（正方但未超过 800）",
    width: 800,
    height: 800,
    remote: "reject:SKU_IMAGE_DIMENSIONS_INVALID",
    domain: "reject:sku_image_dimensions",
    quickEdit: "reject:SKU 图必须为大于 800×800 的正方形",
    verifier: "reject:sku_image_dimensions",
    preflight: "reject:SKU_IMAGE_DIMENSIONS_INVALID",
  },
  {
    label: "801×801（刚刚超过 800 的正方）",
    width: 801,
    height: 801,
    remote: ACCEPT,
    domain: ACCEPT,
    quickEdit: ACCEPT,
    verifier: ACCEPT,
    preflight: ACCEPT,
  },
  {
    label: "1200×800（非正方）",
    width: 1200,
    height: 800,
    remote: "reject:SKU_IMAGE_DIMENSIONS_INVALID",
    domain: "reject:sku_image_dimensions",
    quickEdit: "reject:SKU 图必须为大于 800×800 的正方形",
    verifier: "reject:sku_image_dimensions",
    preflight: "reject:SKU_IMAGE_DIMENSIONS_INVALID",
  },
  {
    label: "1200×1200（合格）",
    width: 1200,
    height: 1200,
    remote: ACCEPT,
    domain: ACCEPT,
    quickEdit: ACCEPT,
    verifier: ACCEPT,
    preflight: ACCEPT,
  },
  {
    label: "尺寸未知（width/height 为空）——四处在此分叉",
    width: null,
    height: null,
    remote: NA,
    domain: "reject:unverified_dimensions",
    quickEdit: ACCEPT,
    verifier: "reject:sku_image_dimensions",
    preflight: "reject:SKU_IMAGE_DIMENSIONS_INVALID",
  },
];

test("square > 800 边界表：五个实现点逐格符合实测契约（含「尺寸未知」这一格）", async () => {
  const mismatches = [];
  for (const row of SQUARE_BOUNDARY_TABLE) {
    const actual = {
      remote: await squarePointRemote(row.width, row.height),
      domain: squarePointDomain(row.width, row.height),
      quickEdit: squarePointQuickEdit(row.width, row.height),
      verifier: await squarePointVerifier(row.width, row.height),
      preflight: squarePointPreflight(row.width, row.height),
    };
    for (const point of ["remote", "domain", "quickEdit", "verifier", "preflight"]) {
      if (actual[point] !== row[point]) {
        mismatches.push(`${row.label} 在 ${point}：期望 ${row[point]}，实际 ${actual[point]}`);
      }
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `某个实现点已偏离共用边界表：\n${mismatches.join("\n")}`,
  );
});

test("边界表必须真的把 800 与 801 分开，否则整表可以被「一律拒绝/一律放行」骗过", () => {
  const rejected = SQUARE_BOUNDARY_TABLE.find((row) => row.width === 800);
  const accepted = SQUARE_BOUNDARY_TABLE.find((row) => row.width === 801);
  for (const point of ["remote", "domain", "quickEdit", "verifier", "preflight"]) {
    assert.notEqual(rejected[point], ACCEPT, `800×800 在 ${point} 本应被拒`);
    assert.equal(accepted[point], ACCEPT, `801×801 在 ${point} 本应被收`);
  }
});

test("「尺寸未知」一格的分歧逐条钉住：quick-edit 静默放行，另三处各用不同的码拒掉", async () => {
  // quick-edit 的守卫是 asset.width && asset.height，空值直接短路，status 停在传入值。
  const quickEdit = createSkuImageFromCarousel({ id: "x", url: SQUARE_IMAGE_URL, width: null, height: null, status: "verified" });
  assert.equal(quickEdit.status, "verified", "quick-edit 对尺寸未知是静默放行（现状，design.md 已记录）");
  assert.equal(quickEdit.error, "");

  assert.equal(squarePointDomain(null, null), "reject:unverified_dimensions", "domain 报的是「未验证」而非「不合格」");
  assert.equal(
    await squarePointVerifier(null, null),
    "reject:sku_image_dimensions",
    "verifier 因 null <= 800 为真而拒，但用的是「不是正方」的码——与 domain 的语义不同",
  );
  assert.equal(squarePointPreflight(null, null), "reject:SKU_IMAGE_DIMENSIONS_INVALID");

  // 四处确实不一致：把四个判定收成集合，元素数必须 > 1，否则这一格已被统一（届时需更新本表）。
  const verdicts = new Set([
    squarePointQuickEdit(null, null),
    squarePointDomain(null, null),
    await squarePointVerifier(null, null),
    squarePointPreflight(null, null),
  ]);
  assert.ok(verdicts.size > 1, "「尺寸未知」已被四处统一处理，本表与 design.md 的记录需要一起更新");
});

/* ==========================================================================
 * 12.2 — 全仓 grep 守卫
 * ======================================================================== */

// 只跳过构建产物与 VCS 目录，其余全仓扫描。artifacts/、dist/、output/ 等都在 .gitignore 里，
// 里面留着吸收之前的旧安装包，必然含 sharp 与 4173，不属于本仓库源码。
const SKIPPED_DIRECTORIES = new Set([
  ".git", "node_modules", "artifacts", "dist", "output", "outputs", "test-results",
  ".vercel", ".local", ".playwright-cli", ".playwright-mcp", ".superpowers", ".codex",
]);
const SCANNED_EXTENSIONS = [".mjs", ".js", ".cjs", ".json", ".html"];

async function collectSourceFiles(rootDirectory) {
  const found = [];
  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        await walk(absolute);
      } else if (entry.isFile() && SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        found.push(absolute);
      }
    }
  }
  await walk(rootDirectory);
  return found.sort();
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("<!--");
}

// 只截掉行尾的 // 注释，且要求它前面不是 ":" 或 "/"，以免把 https:// 或正则里的 // 当注释。
function codePartOf(line) {
  if (isCommentLine(line)) return "";
  return line.replace(/(?<![:/])\/\/.*$/u, "");
}

const FORBIDDEN_SPECIFIERS = ["sharp", "@oai/artifact-tool"];

// 引号类里的反引号用 ` 表达（普通字符串里写成双反斜杠），既不提前结束模板，
// 也不会在 u 模式下变成非法转义。整个模式用拼接而非模板字面量，避免再引入反引号。
const QUOTE_CLASS = "['\"\\u0060]";
const NOT_QUOTE_CLASS = "[^'\"\\u0060]";

function forbiddenImportPattern(specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  // 覆盖 import … from "x"、import "x"、import("x")、require("x")，以及 "x/子路径"。
  const pattern = "(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)"
    + QUOTE_CLASS + escaped + "(?:/" + NOT_QUOTE_CLASS + "*)?" + QUOTE_CLASS;
  return new RegExp(pattern, "u");
}

async function scanForbiddenImports(rootDirectory, { excludeRelative = [] } = {}) {
  const excluded = new Set(excludeRelative);
  const violations = [];
  let scannedCount = 0;
  for (const file of await collectSourceFiles(rootDirectory)) {
    const relativePath = relative(rootDirectory, file);
    if (excluded.has(relativePath)) continue;
    scannedCount += 1;
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      const code = codePartOf(line);
      if (!code) continue;
      for (const specifier of FORBIDDEN_SPECIFIERS) {
        if (forbiddenImportPattern(specifier).test(code)) {
          violations.push(`${relativePath}:${index + 1} 导入了 ${specifier}`);
        }
      }
    }
  }
  return { violations, scannedCount };
}

test("全仓任何文件都不得导入 @oai/artifact-tool 或 sharp", async () => {
  // 排除本文件：它必须逐字写出这两个说明符才能扫描它们。
  const { violations, scannedCount } = await scanForbiddenImports(REPO_ROOT, {
    excludeRelative: [SELF_RELATIVE_PATH],
  });
  // 没有这条下限，一次目录遍历失误（例如把仓库根也加进 SKIPPED_DIRECTORIES）会让守卫
  // 扫到 0 个文件却依然全绿——那种“覆盖”比没有守卫更糟。
  assert.ok(
    scannedCount >= 400,
    `全仓只扫到 ${scannedCount} 个文件，遍历显然没走到位（本仓库应有 500 个上下）`,
  );
  assert.deepEqual(
    violations,
    [],
    `出现了不可分发依赖的导入（@oai/artifact-tool 未发布到公共 npm，sharp 是原生预编译依赖）：\n${violations.join("\n")}`,
  );

  const manifest = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8"));
  for (const specifier of FORBIDDEN_SPECIFIERS) {
    assert.ok(!Object.hasOwn(manifest.dependencies ?? {}, specifier), `dependencies 不得含 ${specifier}`);
    assert.ok(!Object.hasOwn(manifest.devDependencies ?? {}, specifier), `devDependencies 不得含 ${specifier}`);
  }
});

test("从仓库根动态 import 这两个说明符仍抛 ERR_MODULE_NOT_FOUND", async () => {
  for (const specifier of FORBIDDEN_SPECIFIERS) {
    await assert.rejects(
      import(specifier),
      (error) => {
        assert.equal(error.code, "ERR_MODULE_NOT_FOUND", `${specifier} 竟能被解析`);
        return true;
      },
      `${specifier} 不应可解析`,
    );
  }
});

test("detector 自检：禁用导入扫描器对四种写法都报，且不误报注释里的提及", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, "nested"), { recursive: true });
    await writeFile(join(dir, "a.mjs"), 'import sharp from "sharp";\n', "utf8");
    await writeFile(join(dir, "nested", "b.mjs"), 'const t = await import("@oai/artifact-tool");\n', "utf8");
    await writeFile(join(dir, "c.cjs"), 'const s = require("sharp/lib/index.js");\n', "utf8");
    await writeFile(join(dir, "d.mjs"), 'import "@oai/artifact-tool/build";\n', "utf8");
    // 诱饵：注释里提名字、以及仅出现名字而不是导入，都不该被报。
    await writeFile(
      join(dir, "decoy.mjs"),
      '// 这里只是提到 sharp 与 @oai/artifact-tool，没有导入\nconst label = "sharpen";\n',
      "utf8",
    );
    // node_modules 里的真导入必须被跳过，否则守卫在装了依赖的机器上永远红。
    await mkdir(join(dir, "node_modules", "x"), { recursive: true });
    await writeFile(join(dir, "node_modules", "x", "index.js"), 'require("sharp");\n', "utf8");

    const { violations } = await scanForbiddenImports(dir);
    assert.deepEqual(violations.sort(), [
      "a.mjs:1 导入了 sharp",
      "c.cjs:1 导入了 sharp",
      "d.mjs:1 导入了 @oai/artifact-tool",
      `${join("nested", "b.mjs")}:1 导入了 @oai/artifact-tool`,
    ].sort());

    // 删掉四个违规文件后必须恢复全绿——证明红是这四处造成的，不是扫描器恒红。
    for (const name of ["a.mjs", "c.cjs", "d.mjs", join("nested", "b.mjs")]) {
      await rm(join(dir, name));
    }
    assert.deepEqual((await scanForbiddenImports(dir)).violations, []);
  });
});

// 被吸收目录：子文档、共享纯模块、服务端模块。
// public/lib/temu/** 是 scripts/sync-public-lib.mjs 生成的镜像，与 lib/temu/** 逐字节相同，
// 故不单独扫描（改镜像不改源会先卡在 sync:public-lib --check 上）。
const ABSORBED_DIRECTORIES = [
  join("public", "temu"),
  join("lib", "temu"),
  join("lib", "temu-server"),
];

// 合法写法只有一种：由被吸收目录内的模块导出成常量。
// fetch("/api/temu/export") 这类裸字面量、以及拼接出来的路径，都算违规——
// 这条守卫正是子文档必须 import TEMU_STUDIO_IMAGE_PATH 而不是自己写死前缀的原因。
const EXPORTED_API_CONSTANT = /^\s*export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*['"](\/api\/[^'"]*)['"]\s*;?\s*$/u;

async function scanApiPathLiterals(rootDirectory, directories) {
  const violations = [];
  const declarations = [];
  for (const directory of directories) {
    const absolute = join(rootDirectory, directory);
    for (const file of await collectSourceFiles(absolute)) {
      const relativePath = relative(rootDirectory, file).split(sep).join("/");
      const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
      for (const [index, line] of lines.entries()) {
        const code = codePartOf(line);
        if (!code.includes("/api/")) continue;
        const declaration = EXPORTED_API_CONSTANT.exec(line);
        if (declaration) {
          declarations.push({ file: relativePath, line: index + 1, name: declaration[1], value: declaration[2] });
          continue;
        }
        violations.push(`${relativePath}:${index + 1} 出现裸 "/api/ 字面量：${line.trim()}`);
      }
    }
  }
  return { violations, declarations };
}

test("被吸收目录内不得出现裸 \"/api/ 字面量，只允许导出常量来定义这些路径", async () => {
  const scanned = [];
  for (const directory of ABSORBED_DIRECTORIES) {
    const files = await collectSourceFiles(join(REPO_ROOT, directory));
    assert.ok(files.length > 0, `${directory} 下没有可扫描文件：守卫会变成空的`);
    scanned.push(...files);
  }
  assert.ok(scanned.length >= 11, `被吸收目录只扫到 ${scanned.length} 个文件，少于预期`);

  const { violations, declarations } = await scanApiPathLiterals(REPO_ROOT, ABSORBED_DIRECTORIES);
  assert.deepEqual(
    violations,
    [],
    `接口路径必须来自单一导出常量，不得逐处写死：\n${violations.join("\n")}`,
  );

  assert.equal(
    declarations.length,
    2,
    `合法的接口路径常量应恰有两个，实际 ${declarations.length} 个：`
    + declarations.map((entry) => `${entry.file}:${entry.line} ${entry.name}`).join("、"),
  );
  const byName = new Map(declarations.map((entry) => [entry.name, entry]));
  assert.ok(byName.has("TEMU_STUDIO_IMAGE_PATH"), "TEMU_STUDIO_IMAGE_PATH 必须仍是其中之一");
  assert.equal(byName.get("TEMU_STUDIO_IMAGE_PATH").value, TEMU_STUDIO_IMAGE_PATH);
  for (const entry of declarations) {
    assert.ok(
      entry.value.startsWith("/api/"),
      `${entry.name} 必须位于 /api/ 之下：非 GET 请求在 /api/ 之外会整段跳过 CSRF 检查`,
    );
  }
});

test("detector 自检：/api/ 字面量扫描器报裸字面量、放行导出常量、忽略注释", async () => {
  await withTempDir(async (dir) => {
    const absorbed = join("lib", "fake-temu");
    await mkdir(join(dir, absorbed), { recursive: true });
    await writeFile(
      join(dir, absorbed, "constants.mjs"),
      'export const FAKE_TEMU_PATH = "/api/temu/studio/image";\n',
      "utf8",
    );
    await writeFile(
      join(dir, absorbed, "offender.mjs"),
      'const r = await fetch("/api/temu/export", { method: "POST" });\n',
      "utf8",
    );
    await writeFile(
      join(dir, absorbed, "commented.mjs"),
      '// 五个接口都挂在 /api/temu/ 之下\nconst base = FAKE_TEMU_PATH;\n',
      "utf8",
    );

    const dirty = await scanApiPathLiterals(dir, [absorbed]);
    assert.deepEqual(dirty.violations, [
      "lib/fake-temu/offender.mjs:1 出现裸 \"/api/ 字面量：const r = await fetch(\"/api/temu/export\", { method: \"POST\" });",
    ]);
    assert.deepEqual(dirty.declarations.map((entry) => entry.name), ["FAKE_TEMU_PATH"]);

    // 把裸字面量改成引用常量后必须转绿。
    await writeFile(
      join(dir, absorbed, "offender.mjs"),
      'import { FAKE_TEMU_PATH } from "./constants.mjs";\nconst r = await fetch(FAKE_TEMU_PATH);\n',
      "utf8",
    );
    const clean = await scanApiPathLiterals(dir, [absorbed]);
    assert.deepEqual(clean.violations, []);
    assert.equal(clean.declarations.length, 1);
  });
});

/* --------------------------------------------------------------------------
 * 独立端口时代的残留物
 * ------------------------------------------------------------------------ */

// 扫描范围是「会随安装包分发的那一面」。刻意排除两处：
//   test/**    —— 守卫自身必须逐字写出这些针（含本文件），扫描它们会自相矛盾；
//   openspec/**—— 提案与设计正当地记述被吸收项目的旧形态。
const SHIPPED_SCAN_ROOTS = ["lib", "public", "scripts", "desktop"];
const SHIPPED_SCAN_FILES = ["server.mjs", "package.json"];

const STANDALONE_NEEDLES = [
  { needle: "4173", label: "独立服务端口 4173" },
  { needle: "IMAGE_STUDIO_URL", label: "跨进程回环环境变量 IMAGE_STUDIO_URL" },
  { needle: "/vendor/lucide.js", label: "旧的 /vendor/lucide.js 路由（图标已改为构建期烘焙）" },
];

// IMAGE_STUDIO_URL 在被吸收的适配器里留有一条「已删除传输层」的注释，属正当记述。
// 按 文件→条数 钉死：任何新增出现（无论注释还是代码）都会让计数对不上。
const ALLOWED_COMMENT_MENTIONS = new Map([
  ["IMAGE_STUDIO_URL", new Map([["lib/temu-server/studio-set-adapter.mjs", 1]])],
  ["/vendor/lucide.js", new Map([["lib/temu-server/routes.mjs", 1]])],
]);

async function scanStandaloneNeedles(rootDirectory, { roots, files }) {
  const targets = [];
  for (const directory of roots) {
    targets.push(...await collectSourceFiles(join(rootDirectory, directory)));
  }
  for (const name of files) {
    targets.push(join(rootDirectory, name));
  }

  const inCode = [];
  const inComments = new Map();
  for (const file of targets) {
    const relativePath = relative(rootDirectory, file).split(sep).join("/");
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    for (const [index, line] of content.split(/\r?\n/u).entries()) {
      for (const { needle, label } of STANDALONE_NEEDLES) {
        if (!line.includes(needle)) continue;
        if (isCommentLine(line)) {
          const perFile = inComments.get(needle) ?? new Map();
          perFile.set(relativePath, (perFile.get(relativePath) ?? 0) + 1);
          inComments.set(needle, perFile);
          continue;
        }
        inCode.push(`${relativePath}:${index + 1} 残留 ${label}：${line.trim()}`);
      }
    }
  }
  return { inCode, inComments };
}

test("会分发的那一面不得残留独立端口时代的产物（4173 / IMAGE_STUDIO_URL / /vendor/lucide.js）", async () => {
  const { inCode, inComments } = await scanStandaloneNeedles(REPO_ROOT, {
    roots: SHIPPED_SCAN_ROOTS,
    files: SHIPPED_SCAN_FILES,
  });
  assert.deepEqual(
    inCode,
    [],
    `独立服务时代的产物又回到了会分发的代码里：\n${inCode.join("\n")}`,
  );

  for (const { needle } of STANDALONE_NEEDLES) {
    const expected = ALLOWED_COMMENT_MENTIONS.get(needle) ?? new Map();
    const actual = inComments.get(needle) ?? new Map();
    assert.deepEqual(
      Object.fromEntries([...actual].sort()),
      Object.fromEntries([...expected].sort()),
      `${needle} 在注释里的出现位置或次数已变化：注释可以记述「已删除」，但新增出现必须显式登记`,
    );
  }
});

test("detector 自检：残留物扫描器对三根针都报，且按注释/代码分流", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, "lib"), { recursive: true });
    await writeFile(
      join(dir, "lib", "bad.mjs"),
      'const base = process.env.IMAGE_STUDIO_URL || "http://127.0.0.1:4173";\n'
      + 'const icons = "/vendor/lucide.js";\n',
      "utf8",
    );
    await writeFile(join(dir, "server.mjs"), "// 曾经用过 IMAGE_STUDIO_URL，现已删除\n", "utf8");

    const dirty = await scanStandaloneNeedles(dir, { roots: ["lib"], files: ["server.mjs"] });
    assert.equal(dirty.inCode.length, 3, `代码里的三根针都应被报，实际 ${dirty.inCode.length}：${dirty.inCode.join(" | ")}`);
    assert.ok(dirty.inCode.some((entry) => entry.includes("4173")));
    assert.ok(dirty.inCode.some((entry) => entry.includes("IMAGE_STUDIO_URL")));
    assert.ok(dirty.inCode.some((entry) => entry.includes("lucide")));
    assert.deepEqual(
      Object.fromEntries(dirty.inComments.get("IMAGE_STUDIO_URL") ?? new Map()),
      { "server.mjs": 1 },
      "注释里的提及必须被分到 inComments，不进 inCode",
    );

    // 删掉代码里的那一行后必须只剩注释，证明红是那一行造成的。
    await writeFile(join(dir, "lib", "bad.mjs"), "const base = STUDIO_SETS_PATH;\n", "utf8");
    const clean = await scanStandaloneNeedles(dir, { roots: ["lib"], files: ["server.mjs"] });
    assert.deepEqual(clean.inCode, []);
  });
});
