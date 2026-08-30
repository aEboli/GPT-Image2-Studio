import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

import JSZip from "jszip";

import { reorderCarouselAsset, generateSkuMatrix } from "../lib/temu/domain.mjs";
import { TEMU_STUDIO_IMAGE_PATH, TEMU_TEMPLATE_HEADERS } from "../lib/temu/template-headers.mjs";
import {
  buildProductDescriptionHtml,
  buildTemuDraftPlan,
  mapNormalizedSkuToTemplateRow,
  mapSkuToTemplateRow,
  zipTemplateRowCells,
} from "../lib/temu-server/draft-plan.mjs";
import { buildTemuWorkbookBuffer } from "../lib/creation-temu-workbook.mjs";
import { createValidDraft } from "./temu-fixtures.mjs";

const repoRoot = new URL("../", import.meta.url);
const skuUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const carouselUrl = "https://res.cloudinary.com/demo/image/upload/main-carousel.jpg";
const packagingUrl = "https://res.cloudinary.com/demo/image/upload/packaging.jpg";

// 工作台路径实测体积（exceljs，includeIssueSheet: false，本机 Node 24）：
// 4 行 12,239 B；2000 行同款内容 308,333 B；2000 份各不相同的重内容草稿（每份 10 轮播 + 6 外包装
// + 10 来源 URL + 500 字描述，全部 URL 逐份唯一，共享字符串表无从去重）648,775 B。
// 因此这条路径的合法上界在 1 MiB 内，被吸收侧那 3,000,000 字节的常量在本路径上永远不会触发。
const WORKBENCH_MAX_OBSERVED_BYTES = 1024 * 1024;

function planCell(plan, rowIndex, header) {
  return plan.rows[rowIndex].cells[header];
}

function rowValues(plan, rowIndex) {
  return TEMU_TEMPLATE_HEADERS.map((header) => plan.rows[rowIndex].cells[header]);
}

const longUrl = (tag) => `https://res.cloudinary.com/demo/image/upload/v1700000000/${"segment-".repeat(12)}${tag}.jpg`;

function heavyDraft(tag, skuCount) {
  const draft = createValidDraft();
  draft.product.description = `商品${tag}描述${"描".repeat(480)}`;
  draft.product.packageList = Array.from({ length: 20 }, (_, index) => `${tag}清单${index}`);
  draft.product.packageQuantities = Array.from({ length: 20 }, (_, index) => String(index + 1));
  draft.product.sourceUrls = Array.from({ length: 10 }, (_, index) => longUrl(`${tag}-src${index}`));
  draft.assets.carousel = Array.from({ length: 10 }, (_, index) => ({
    id: `c${index}`, name: "c.jpg", url: longUrl(`${tag}-car${index}`), width: 1200, height: 1200, status: "verified",
  }));
  draft.assets.packaging = Array.from({ length: 6 }, (_, index) => ({
    id: `p${index}`, name: "p.jpg", url: longUrl(`${tag}-pkg${index}`), width: 1200, height: 1200, status: "verified",
  }));
  draft.variants = { name1: "颜色", values1: Array.from({ length: skuCount }, (_, index) => `色${index}`), name2: "", values2: [] };
  draft.skus = generateSkuMatrix(draft).map((sku, index) => ({
    ...sku,
    skuCode: `${tag}-SKU-${index}`,
    image: { id: `s${index}`, name: "s.jpg", url: longUrl(`${tag}-sku${index}`), width: 1200, height: 1200, status: "verified" },
  }));
  return draft;
}

test("表头漂移会失败关闭", () => {
  // 被吸收侧用 compareHeaders 比对“从模板读到的表头”与它自己那份常量；本仓库这件事已由
  // lib/creation-temu-workbook.mjs 的 assertTemplateStructure 与 test/temu-template-headers.test.mjs
  // 各自承担。留在本模块里的唯一表头契约是定位数组与 51 列表头的位数必须一致，
  // 因此改用同一条规则的活路径守卫来表达：新增一列而不改映射，必须失败关闭而不是静默写 undefined。
  const draft = createValidDraft();
  const values = mapSkuToTemplateRow(draft, draft.skus[0]);
  assert.equal(values.length, TEMU_TEMPLATE_HEADERS.length);
  const cells = zipTemplateRowCells(values);
  assert.deepEqual(Object.keys(cells), [...TEMU_TEMPLATE_HEADERS]);
  assert.deepEqual(TEMU_TEMPLATE_HEADERS.map((header) => cells[header]), values);

  for (const drifted of [values.slice(0, 50), [...values, "第 52 列"], undefined, "not-an-array"]) {
    assert.throws(
      () => zipTemplateRowCells(drifted),
      (error) => error?.code === "TEMU_DRAFT_ROW_ARITY" && /51 个定位值/u.test(error.message),
      `drifted arity ${Array.isArray(drifted) ? drifted.length : String(drifted)} should fail closed`,
    );
  }
});

test("SKU 映射输出精确 51 列公网 URL", () => {
  const draft = createValidDraft();
  draft.assets.carousel[0].url = carouselUrl;
  draft.assets.packaging = [{ ...draft.assets.carousel[0], id: "packaging-1", url: packagingUrl }];
  const row = mapSkuToTemplateRow(draft, draft.skus[0]);
  assert.equal(row.length, 51);
  assert.equal(row[0], "便携收纳盒");
  assert.equal(row[2], `<img src="${carouselUrl}"/><br><p>桌面小物分类收纳盒。</p>`);
  assert.equal(row[4], "颜色");
  assert.equal(row[6], draft.variants.name2);
  assert.equal(row[7], draft.skus[0].variant2Value);
  assert.equal(row[8], skuUrl);
  assert.equal(row[18], carouselUrl);
  assert.equal(row[19], carouselUrl);
  assert.equal(row[22], packagingUrl);
  assert.equal(row[50], "中国大陆-浙江省");
});

test("轮播重排后模板首图和轮播全序列使用新顺序", () => {
  const draft = createValidDraft();
  const [first, second, third] = ["first", "second", "third"].map((name) => ({
    ...draft.assets.carousel[0],
    id: `carousel-${name}`,
    name: `${name}.jpg`,
    url: `https://res.cloudinary.com/demo/image/upload/${name}.jpg`,
  }));
  draft.assets.carousel = [first, second, third];

  const reordered = reorderCarouselAsset(draft, 2, 0);
  const row = mapSkuToTemplateRow(reordered, reordered.skus[0]);

  assert.equal(row[18], [third, first, second].map((asset) => asset.url).join("\n"));
  assert.equal(row[19], third.url);
  assert.match(row[2], new RegExp(`<img src="${third.url.replaceAll(".", "\\.")}"`));
});

test("SKU 映射保留用户选择的第一变种属性名", () => {
  const draft = createValidDraft();
  draft.variants.name1 = "材质";
  const row = mapSkuToTemplateRow(draft, draft.skus[0]);
  assert.equal(row[4], "材质");
  assert.equal(row[5], draft.skus[0].variant1Value);
});

test("默认单 SKU 把第一张主图 URL 写入变种值、SKU 图和素材图列", () => {
  const draft = createValidDraft();
  draft.variants = { name1: "颜色", values1: ["默认"], name2: "", values2: [] };
  draft.assets.carousel[0].url = carouselUrl;
  draft.skus = [{
    ...draft.skus[0],
    variant1Value: "默认",
    variant2Value: "",
    image: { ...draft.assets.carousel[0] },
  }];

  const row = mapSkuToTemplateRow(draft, draft.skus[0]);
  assert.equal(row[5], "默认");
  assert.equal(row[8], carouselUrl);
  assert.equal(row[18], carouselUrl);
  assert.equal(row[19], carouselUrl);
});

test("产品描述使用首图并把多行纯文本安全转为 HTML", () => {
  const html = buildProductDescriptionHtml(
    `${carouselUrl}?label=a&quote=%22`,
    `第一行 <b>不能执行</b> & "双引号"\n\n第二行`,
  );
  assert.equal(
    html,
    `<img src="${carouselUrl}?label=a&amp;quote=%22"/><br><p>第一行 &lt;b&gt;不能执行&lt;/b&gt; &amp; &quot;双引号&quot;</p><p>第二行</p>`,
  );
});

test("真实模板生成 URL-only 四行 SKU 工作簿", { timeout: 120000 }, async () => {
  const rootBefore = (await readdir(repoRoot)).sort();
  const draft = createValidDraft();
  draft.assets.carousel[0].url = carouselUrl;

  const plan = buildTemuDraftPlan({ drafts: draft });
  assert.equal(plan.rows.length, 4);
  assert.deepEqual(plan.rows.map((row) => row.dataRow), [2, 3, 4, 5]);
  assert.ok(plan.rows.every((_, index) => rowValues(plan, index).length === 51));
  assert.ok(plan.rows.every((row) => row.cells["预览图"] === skuUrl
    && row.cells["*轮播图"] === carouselUrl
    && row.cells["*产品素材图"] === carouselUrl));
  assert.ok(plan.rows.every((row) => String(row.cells["产品描述"]).startsWith(`<img src="${carouselUrl}"/><br>`)));

  // 同一个 exceljs 写入器，工作台路径传 includeIssueSheet: false 得到 2 sheet 形态。
  const result = await buildTemuWorkbookBuffer({ plan, includeIssueSheet: false });
  assert.ok(result.buffer.byteLength > 10000);
  assert.ok(
    result.buffer.byteLength <= WORKBENCH_MAX_OBSERVED_BYTES,
    `4 行工作簿 ${result.buffer.byteLength} 字节，超过实测上界`,
  );
  assert.equal(result.rowCount, 4);
  assert.equal(result.issueSheetName, null);

  // 被吸收侧这里用 @oai/artifact-tool 的 workbook.inspect 做回读，且它只在测试里被调用过；
  // 改为对 zip 直接断言——同一份源测试本来就已经在用 JSZip 做这几条。
  const zip = await JSZip.loadAsync(result.buffer);
  const parts = Object.keys(zip.files);
  assert.equal(zip.file("xl/cellimages.xml"), null);
  assert.equal(zip.file("xl/_rels/cellimages.xml.rels"), null);
  assert.deepEqual(parts.filter((name) => /^xl\/media\//u.test(name)), []);
  assert.deepEqual(parts.filter((name) => /^xl\/drawings\//u.test(name)), []);
  const worksheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.doesNotMatch(worksheetXml, /DISPIMG|cellImage/u);
  // 文本单元格值走共享字符串表，所以内容断言在 sharedStrings.xml 上（被吸收侧靠 workbook.inspect 读值）。
  const sharedStrings = await zip.file("xl/sharedStrings.xml").async("string");
  assert.match(sharedStrings, /便携收纳盒/u);
  assert.match(sharedStrings, /main-carousel\.jpg/u);
  // 被吸收侧的 workbook.inspect 还查过公式错误值；改为直接扫工作表与共享字符串。
  for (const xml of [worksheetXml, sharedStrings]) {
    assert.doesNotMatch(xml, /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/u);
  }
  // 定位数组本身不含公式，写入器也把公式触发字符按普通文本写入：整份工作簿不应出现任何 <f> 元素。
  assert.doesNotMatch(worksheetXml, /<f[ >]/u);

  const sheetNames = await zip.file("xl/workbook.xml").async("string");
  assert.match(sheetNames, /导入模板/u);
  assert.match(sheetNames, /导入示例/u);
  assert.doesNotMatch(sheetNames, /导出问题/u);

  // 被吸收侧的这条测试要清理 artifact-tool 写下的 inspect sidecar 文件。本路径不写任何文件，
  // 所以改为直接断言仓库根目录没有新增条目（也覆盖 tasks.md 13.4 的“测试不得写入未忽略目录”）。
  assert.deepEqual((await readdir(repoRoot)).sort(), rootBefore);
});

test("两个商品按列表顺序合并到同一工作簿且字段不串写", { timeout: 120000 }, async () => {
  const first = createValidDraft();
  first.assets.carousel[0].url = "https://res.cloudinary.com/demo/image/upload/product-a.jpg";
  first.skus.forEach((sku, index) => {
    sku.skuCode = `PRODUCT-A-${index + 1}`;
    sku.image.url = "https://res.cloudinary.com/demo/image/upload/product-a-sku.jpg";
  });

  const second = createValidDraft();
  Object.assign(second.product, {
    title: "折叠收纳篮",
    englishTitle: "Foldable Storage Basket",
    productCode: "BASKET-002",
  });
  second.assets.carousel[0].url = "https://res.cloudinary.com/demo/image/upload/product-b.jpg";
  second.skus = second.skus.slice(0, 2).map((sku, index) => ({
    ...sku,
    skuCode: `PRODUCT-B-${index + 1}`,
    image: { ...sku.image, url: "https://res.cloudinary.com/demo/image/upload/product-b-sku.jpg" },
  }));

  const plan = buildTemuDraftPlan({ drafts: [first, second] });
  assert.equal(plan.rows.length, 6);
  assert.deepEqual(plan.rows.map((row) => row.cells["*产品标题"]), [
    "便携收纳盒",
    "便携收纳盒",
    "便携收纳盒",
    "便携收纳盒",
    "折叠收纳篮",
    "折叠收纳篮",
  ]);
  assert.ok(plan.rows.slice(0, 4).every((row) => row.cells["产品货号"] === "BOX-001"
    && String(row.cells["预览图"]).includes("product-a-sku")));
  assert.ok(plan.rows.slice(4).every((row) => row.cells["产品货号"] === "BASKET-002"
    && String(row.cells["预览图"]).includes("product-b-sku")));
  assert.ok(plan.rows.slice(0, 4).every((row) => String(row.cells["*轮播图"]).includes("product-a.jpg")));
  assert.ok(plan.rows.slice(4).every((row) => String(row.cells["*轮播图"]).includes("product-b.jpg")));
  assert.deepEqual(plan.rows.map((row) => row.draftIndex), [0, 0, 0, 0, 1, 1]);

  const result = await buildTemuWorkbookBuffer({ plan, includeIssueSheet: false });
  assert.equal(result.rowCount, 6);
  assert.equal(planCell(plan, 4, "*产品标题"), "折叠收纳篮");
});

test("批量模板校验错误标注对应商品序号", () => {
  const first = createValidDraft();
  const second = createValidDraft();
  second.product.title = "";
  assert.throws(() => buildTemuDraftPlan({ drafts: [first, second] }), (error) => {
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(error.validation.errors.some((issue) => issue.path.startsWith("drafts.1.") && issue.message.startsWith("商品 2：")));
    return true;
  });
  // 空数组也必须失败关闭，否则写入器会因“没有可写入的数据行”抛出更晚、更难归因的错误。
  assert.throws(() => buildTemuDraftPlan({ drafts: [] }), (error) => {
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(error.validation.errors.some((issue) => issue.code === "draft_required"));
    return true;
  });
});

test("只有本地图片时模板导出失败关闭", () => {
  const draft = createValidDraft();
  draft.settings = { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" };
  draft.assets.carousel[0] = {
    ...draft.assets.carousel[0],
    url: "",
    studioPreviewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=set-1&itemId=carousel-1`,
    status: "local",
  };
  assert.throws(() => buildTemuDraftPlan({ drafts: draft }), (error) => {
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(error.validation.errors.some((issue) => issue.code === "public_image_url_required"));
    return true;
  });
});

test("草稿校验警告随计划回到调用方并落到对应数据行", () => {
  const draft = createValidDraft();
  // 站外产品链接容忍 http 但发警告（图片字段不适用：那些一律要求 HTTPS）。
  draft.product.externalProductUrl = "http://detail.1688.com/offer/1.html";
  draft.skus[2].image = { ...draft.skus[2].image, status: "pending" };

  const plan = buildTemuDraftPlan({ drafts: draft });
  assert.ok(plan.validation.valid);
  const codes = plan.issues.map((issue) => issue.code);
  assert.ok(codes.includes("http_url"), `missing http_url in ${codes.join(",")}`);
  assert.ok(codes.includes("asset_pending"), `missing asset_pending in ${codes.join(",")}`);

  const httpIssue = plan.issues.find((issue) => issue.code === "http_url");
  assert.equal(httpIssue.severity, "警告");
  assert.equal(httpIssue.dataRow, 2, "商品级警告应指向该草稿的首行");
  assert.equal(httpIssue.source, "product.externalProductUrl");

  const pendingIssue = plan.issues.find((issue) => issue.code === "asset_pending");
  assert.equal(pendingIssue.dataRow, 4, "skus.2 的警告应指向第 3 个 SKU 所在数据行");
  assert.equal(pendingIssue.skuId, draft.skus[2].skuCode);
});

test("工作台路径 2000 行上限内的最坏体积仍在 1 MiB 内", { timeout: 300000 }, async () => {
  // 每份草稿的 URL、描述与清单逐份唯一，使 xlsx 共享字符串表无从去重——这是本路径的最坏情形。
  const drafts = Array.from({ length: 2000 }, (_, index) => heavyDraft(`D${index}`, 1));
  const plan = buildTemuDraftPlan({ drafts });
  assert.equal(plan.rows.length, 2000);

  const result = await buildTemuWorkbookBuffer({ plan, includeIssueSheet: false });
  assert.equal(result.rowCount, 2000);
  assert.ok(
    result.buffer.byteLength <= WORKBENCH_MAX_OBSERVED_BYTES,
    `2000 行最坏体积 ${result.buffer.byteLength} 字节，超过 ${WORKBENCH_MAX_OBSERVED_BYTES} 字节实测上界`,
  );
  assert.ok(result.buffer.byteLength > 256 * 1024, `期望这是一份大工作簿，实际 ${result.buffer.byteLength} 字节`);

  // 行数上限由写入器持有；工作台路径首次会撞上它，所以在这里钉住它确实生效。
  const overflow = buildTemuDraftPlan({ drafts: [...drafts, heavyDraft("D2000", 1)] });
  assert.equal(overflow.rows.length, 2001);
  await assert.rejects(
    buildTemuWorkbookBuffer({ plan: overflow, includeIssueSheet: false }),
    (error) => error?.code === "TEMU_WORKBOOK_INVALID" && /2000 行/u.test(error.message),
  );
});

test("golden-draft 等价：定位数组与表头取值互为镜像", () => {
  const draft = createValidDraft();
  draft.assets.carousel[0].url = carouselUrl;
  const plan = buildTemuDraftPlan({ drafts: draft });

  plan.rows.forEach((row, index) => {
    const values = mapNormalizedSkuToTemplateRow(plan.validation.draft, plan.validation.draft.skus[index]);
    assert.deepEqual(TEMU_TEMPLATE_HEADERS.map((header) => row.cells[header]), values);
  });

  // 换算表的两端：空文本与非有限数一律为 null（不是 ""），数字列保持 number。
  const empty = createValidDraft();
  empty.product.identifierType = "";
  empty.product.netContent = "";
  empty.product.liquidCapacity = "不是数字";
  const emptyPlan = buildTemuDraftPlan({ drafts: empty });
  assert.equal(planCell(emptyPlan, 0, "识别码类型"), null);
  assert.equal(planCell(emptyPlan, 0, "单品净含量"), null);
  assert.equal(planCell(emptyPlan, 0, "液体容量"), null);
  assert.equal(typeof planCell(emptyPlan, 0, "*申报价格\n(店铺币种)"), "number");
  assert.equal(planCell(emptyPlan, 0, "*申报价格\n(店铺币种)"), 12.5);
});

test("多值列分隔符契约：5 处换行连接与 2 处逗号连接", () => {
  const draft = createValidDraft();
  draft.product.packageList = ["收纳盒", "说明卡"];
  draft.product.packageQuantities = ["1", "2"];
  draft.product.sourceUrls = ["https://a.example.com/1", "https://b.example.com/2"];
  draft.product.manualLanguages = ["中文", "English"];
  draft.product.sensitive = "是";
  draft.product.sensitiveValues = ["磁性", "液体"];
  draft.product.liquidCapacity = "100";
  draft.assets.carousel = ["one", "two"].map((name, index) => ({
    ...draft.assets.carousel[0],
    id: `carousel-${name}`,
    url: `https://res.cloudinary.com/demo/image/upload/${name}.jpg`,
    status: "verified",
  }));
  draft.assets.packaging = ["pack-a", "pack-b"].map((name) => ({
    ...draft.assets.carousel[0],
    id: name,
    url: `https://res.cloudinary.com/demo/image/upload/${name}.jpg`,
    status: "verified",
  }));

  const plan = buildTemuDraftPlan({ drafts: draft });
  assert.equal(planCell(plan, 0, "*轮播图"), "https://res.cloudinary.com/demo/image/upload/one.jpg\nhttps://res.cloudinary.com/demo/image/upload/two.jpg");
  assert.equal(planCell(plan, 0, "外包装图片"), "https://res.cloudinary.com/demo/image/upload/pack-a.jpg\nhttps://res.cloudinary.com/demo/image/upload/pack-b.jpg");
  assert.equal(planCell(plan, 0, "包装清单"), "收纳盒\n说明卡");
  assert.equal(planCell(plan, 0, "包装清单数量"), "1\n2");
  assert.equal(planCell(plan, 0, "来源URL"), "https://a.example.com/1\nhttps://b.example.com/2");
  assert.equal(planCell(plan, 0, "说明书语种"), "中文,English");
  assert.equal(planCell(plan, 0, "敏感属性值"), "磁性,液体");
});

test("全仓不得解析出 sharp 或 @oai/artifact-tool", async () => {
  for (const specifier of ["sharp", "@oai/artifact-tool"]) {
    await assert.rejects(
      () => import(specifier),
      (error) => error?.code === "ERR_MODULE_NOT_FOUND",
      `${specifier} 必须无法解析`,
    );
  }
});
