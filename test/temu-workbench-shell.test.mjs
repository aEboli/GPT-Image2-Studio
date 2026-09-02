import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "parse5";

import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temuDir = join(rootDir, "public", "temu");

const html = readFileSync(join(temuDir, "index.html"), "utf8");
const appSource = readFileSync(join(temuDir, "app.js"), "utf8");
const styles = readFileSync(join(temuDir, "styles.css"), "utf8");

const document = parse(html);

function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
}

const elements = [...walk(document)].filter((node) => typeof node.tagName === "string");

function attr(element, name) {
  return element.attrs?.find((candidate) => candidate.name === name)?.value ?? null;
}

function elementsWith(tagName, predicate = () => true) {
  return elements.filter((element) => element.tagName === tagName && predicate(element));
}

test("六个 data-view 分区齐全且顺序不变", () => {
  const views = elements.map((element) => attr(element, "data-view")).filter(Boolean);

  assert.deepEqual(views, ["product", "images", "skus", "description", "shipping", "compliance"]);

  // 侧边导航的 data-view-button 必须与分区一一对应，否则目录点不动对应分区。
  const navTargets = elements.map((element) => attr(element, "data-view-button")).filter(Boolean);
  assert.deepEqual(navTargets, views);
});

test("资源引用走绝对 /temu/ 路径，不会退回 Studio 自己的 styles.css 与 app.js", () => {
  const stylesheets = elementsWith("link", (element) => attr(element, "rel") === "stylesheet")
    .map((element) => attr(element, "href"));
  const scripts = elementsWith("script").map((element) => attr(element, "src")).filter(Boolean);

  assert.deepEqual(stylesheets, ["/temu/styles.css"]);
  assert.ok(scripts.includes("/temu/app.js"), "必须加载 /temu/app.js");

  // 裸 /styles.css 与 /app.js 是 Studio 主应用自己的文件。相对写法 ./styles.css 在
  // 无斜杠的 /temu 上会解析到应用根目录，静默加载主应用整份 app.js，而页面主体看起来完全正常。
  for (const reference of [...stylesheets, ...scripts]) {
    assert.notEqual(reference, "/styles.css");
    assert.notEqual(reference, "/app.js");
    assert.ok(reference.startsWith("/"), `${reference} 必须是绝对路径，相对路径在 /temu 上会解析错`);
    assert.ok(!reference.includes("?v="), `${reference} 不应带 ?v= 缓存串`);
  }
});

test("lucide 走烘焙 shim，vendor 脚本已消失", () => {
  const scripts = elementsWith("script").map((element) => attr(element, "src")).filter(Boolean);

  assert.ok(
    scripts.includes("/lib/temu/lucide-shim.mjs"),
    "必须加载烘焙 shim，否则全部 <i data-lucide> 渲染成空元素且无任何测试会红",
  );
  assert.ok(!html.includes("/vendor/lucide.js"), "lucide UMD 包不在本仓库依赖里");

  // shim 必须先于 app.js：app.js 顶层的 renderDynamic() 会立刻调 window.lucide?.createIcons()。
  assert.ok(
    scripts.indexOf("/lib/temu/lucide-shim.mjs") < scripts.indexOf("/temu/app.js"),
    "shim 必须排在 app.js 之前",
  );

  // 标记一个字形都不能改写：有两处 data-lucide="${…}" 是模板字符串动态值。
  assert.ok(html.includes("data-lucide=\"package-open\""), "静态字形标记应原样保留");
});

test("#appVersion 与 #templateMetric 都在——删掉任一个会永久禁用导出按钮", () => {
  // checkHealth() 无空值保护地取这两个元素后写 .textContent，且它在顶层被无保护调用。
  // 元素缺失即抛 TypeError，templateReady 永远停在 false，
  // 而导出按钮 disabled = !batchReady || !templateReady || exportPending。
  for (const id of ["appVersion", "templateMetric"]) {
    const matches = elements.filter((element) => attr(element, "id") === id);
    assert.equal(matches.length, 1, `#${id} 必须恰好存在一个`);
  }

  assert.match(appSource, /document\.querySelector\("#appVersion"\)/);
  assert.match(appSource, /document\.querySelector\("#templateMetric"\)/);
});

test("变种信息提供新增变种入口并接入单行追加交互", () => {
  const buttons = elementsWith("button", (element) => attr(element, "id") === "addSkuVariantButton");
  assert.equal(buttons.length, 1, "新增变种按钮必须恰好存在一个");
  assert.equal(attr(buttons[0], "type"), "button");
  assert.equal(attr(buttons[0], "aria-label"), "新增变种");
  assert.match(appSource, /import \{[\s\S]*?\baddSkuVariant,[\s\S]*?\} from "\/lib\/temu\/domain\.mjs"/);
  assert.match(appSource, /function addSkuVariantRow\(\)[\s\S]*?addSkuVariant\(draft, variant1Value, variant2Value\)/);
  assert.match(appSource, /document\.querySelector\("#addSkuVariantButton"\)\.addEventListener\("click", addSkuVariantRow\)/);
  assert.match(appSource, /requestAnimationFrame\(\(\) => \{[\s\S]*?startSkuVariantValueEdit\(input\)/);
  assert.match(appSource, /function skuVariantCombinationKey\(sku, field, value\)/);
  assert.match(appSource, /duplicateIndex = draft\.skus\.findIndex\([\s\S]*?skuVariantCombinationKey\(sku\) === candidateKey/);
  assert.match(appSource, /document\.addEventListener\("click", \(event\) => \{[\s\S]*?startSkuVariantValueEdit\(input\)/);
  assert.match(appSource, /title="点击编辑变种值"/);
  assert.match(styles, /\.sku-table thead th:nth-child\(2\), \.sku-table thead th:nth-child\(3\) \{ width: auto; \}/);
  assert.match(styles, /#addSkuVariantButton \{ min-height: 44px; height: 44px; \}/);
  assert.match(styles, /\.sku-table \.sku-variant-value \{ font-size: 16px; \}/);
});

test("被无保护立即解引用的元素都在文档里", () => {
  // 源项目有大量 document.querySelector("#id").addEventListener(...) / .textContent = ...，
  // 缺元素即抛 TypeError。判据取「查询后紧跟一个点」——也就是没有 ?. 也没有先存变量再判空的那些；
  // 用 ?.focus() 或先存变量再 if (!a || !b) return 的位置本来就允许元素不存在
  // （例如 #studioEstimateOption 一组是 innerHTML 造出来的，渲染前确实取不到）。
  const dereferenced = new Set(
    [...appSource.matchAll(/document\.querySelector\("#([A-Za-z0-9_-]+)"\)\s*\./g)].map((match) => match[1]),
  );
  const present = new Set(elements.map((element) => attr(element, "id")).filter(Boolean));

  assert.ok(dereferenced.size > 40, `应扫出足够多的解引用点，实际 ${dereferenced.size}`);
  const missing = [...dereferenced].filter((id) => !present.has(id));
  assert.deepEqual(missing, [], `文档缺少这些 id：${missing.join(", ")}`);
});

test("模块说明符指向已镜像的 /lib/temu/*，且不带 ?v=", () => {
  const specifiers = [...appSource.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);

  assert.ok(specifiers.length >= 6, `应有 6 个共享模块导入，实际 ${specifiers.length}`);
  for (const specifier of specifiers) {
    assert.ok(specifier.startsWith("/lib/temu/"), `${specifier} 必须指向镜像目录`);
    assert.ok(!specifier.includes("?v="), `${specifier} 不应带 ?v= 缓存串`);
    assert.ok(specifier.endsWith(".mjs"), `${specifier} 应是 .mjs`);
    // 镜像文件必须真在盘上，否则浏览器里是 404，而 node --check 不会发现。
    assert.ok(existsSync(join(rootDir, "public", specifier)), `${specifier} 在盘上不存在`);
  }

  // 源项目的相对说明符（./domain.js 等）一个都不该留下。
  assert.ok(!/from\s+"\.\//.test(appSource), "不应残留 ./ 相对说明符");
});

test("五个接口全部落在 /api/temu/ 之下，且无裸 \"/api/ 字面量", () => {
  assert.ok(
    !appSource.includes("\"/api/") && !appSource.includes("'/api/"),
    "裸 \"/api/ 字面量必须收归常量，否则 /api/temu 前缀迁移时会静默留在旧路径",
  );
  assert.ok(!html.includes("/api/"), "index.html 不应出现接口字面量");

  // 前缀从全仓唯一那处声明反推。
  assert.match(appSource, /import \{ TEMU_STUDIO_IMAGE_PATH \} from "\/lib\/temu\/template-headers\.mjs"/);
  assert.equal(TEMU_STUDIO_IMAGE_PATH, "/api/temu/studio/image");

  const base = TEMU_STUDIO_IMAGE_PATH.replace(/\/studio\/image$/, "");
  assert.equal(base, "/api/temu");

  // 五个 fetch 目标都必须是常量而非字面量，且常量名出现在 fetch( 里。
  for (const name of ["API_HEALTH", "API_STUDIO_SETS", "API_ASSETS_VERIFY", "API_EXPORT"]) {
    assert.match(appSource, new RegExp(`const ${name} = \\\`\\$\\{API_BASE\\}/`), `${name} 应由 API_BASE 拼出`);
    assert.ok(appSource.includes(`fetch(${name}`), `${name} 应被 fetch 使用`);
  }
  // /studio/sets 有两处独立调用（导入对话框、补选原轮播图）。
  assert.equal(appSource.split("fetch(API_STUDIO_SETS").length - 1, 2);

  // 预览 URL 前缀判断改用常量：其中一处是精确 pathname 相等，漏改会静默把素材标成 error。
  assert.equal(appSource.split("${TEMU_STUDIO_IMAGE_PATH}?").length - 1, 2);
  assert.ok(!appSource.includes("/api/studio/image"), "旧预览 URL 前缀不应残留");
});

test("子文档的五个 fetch 目标与路由模块登记的路径逐条相同", async () => {
  // 这是最容易静默的一处：路径写错不会有任何构建期报错，工作台只是每个请求都 404，
  // 表现为「读不到套图记录」「导出失败」，而两边各自的测试都是绿的。
  const { TEMU_WORKBENCH_ROUTES } = await import("../lib/temu-server/routes.mjs");

  // 后缀必须从 app.js 源码里真读出来，不能在测试里按同样的规则再算一遍——
  // 那样比的是「测试 vs 路由模块」，app.js 把 /health 写成 /healthz 也照样绿。
  const base = TEMU_STUDIO_IMAGE_PATH.replace(/\/studio\/image$/, "");
  const suffixOf = (name) => {
    const found = new RegExp(`const ${name} = \`\\$\\{API_BASE\\}(/[^\`]*)\``).exec(appSource);
    assert.ok(found, `app.js 里找不到 ${name} 的定义`);
    return found[1];
  };

  const subdocument = {
    health: base + suffixOf("API_HEALTH"),
    studioSets: base + suffixOf("API_STUDIO_SETS"),
    studioImage: TEMU_STUDIO_IMAGE_PATH,
    assetsVerify: base + suffixOf("API_ASSETS_VERIFY"),
    export: base + suffixOf("API_EXPORT"),
  };

  for (const [key, path] of Object.entries(subdocument)) {
    assert.equal(TEMU_WORKBENCH_ROUTES[key], path, `${key} 两侧路径不一致`);
  }

  // 非 GET 必须落在 /api/ 之下：CSRF 检查对 /api/ 之外的非 GET 请求直接放行。
  for (const path of [subdocument.assetsVerify, subdocument.export]) {
    assert.ok(path.startsWith("/api/"), `${path} 必须位于 /api/ 前缀内才会被 CSRF 检查覆盖`);
  }
});

test("三条跨文档消息按名字齐全，两端都校验来源", () => {
  assert.match(appSource, /const WORKBENCH_MESSAGE_INIT = "temu-workbench:init"/);
  assert.match(appSource, /const WORKBENCH_MESSAGE_THEME = "temu-workbench:theme"/);
  assert.match(appSource, /const WORKBENCH_MESSAGE_REQUEST_CLOSE = "temu-workbench:request-close"/);

  // 接收侧按 location.origin 校验，发送侧把 location.origin 作为 targetOrigin。
  assert.match(appSource, /event\.origin === location\.origin/);
  assert.match(
    appSource,
    /postMessage\(\{ type: WORKBENCH_MESSAGE_REQUEST_CLOSE \}, location\.origin\)/,
  );

  // init 必须既落主题语言，又用已勾选的 setIds 跑现有导入流程。
  assert.match(appSource, /data\.type === WORKBENCH_MESSAGE_INIT/);
  assert.match(appSource, /openStudioImportDialog\(setIds\)/);
  assert.match(appSource, /data\.type === WORKBENCH_MESSAGE_THEME/);
  assert.match(appSource, /function openStudioImportDialog\(preselectedSetIds = \[\]\)/);
});

test("Escape 转发关闭请求的判据是 dialog[open]，不是写死的个数", () => {
  const dialogs = elementsWith("dialog");

  // 文档现有 6 个 dialog，还有两个 hidden 的上下文菜单。写死数量会随改动漂移，
  // 所以判据必须是 querySelector("dialog[open]")。
  assert.ok(dialogs.length > 1, `文档应有多个 dialog，实际 ${dialogs.length}`);
  assert.match(appSource, /document\.querySelector\("dialog\[open\]"\)/);

  // 断言判据里没有任何按数量比较 dialog 的写法。
  assert.ok(
    !/querySelectorAll\("dialog[^"]*"\)\s*\.length/.test(appSource),
    "不应按 dialog 数量判断",
  );
});

test("浅色调色板由 <html data-theme=\"light\"> 驱动并覆盖整屏渐变层", () => {
  assert.match(styles, /html\[data-theme="light"\]\s*\{[^}]*color-scheme: light/);

  // body::before / body::after 是这套外观的本体（position: fixed; inset: 0 的深色渐变），
  // 不覆盖它们的话，变量改得再全也只是浮在一块深色板上。
  assert.match(styles, /html\[data-theme="light"\] body::before/);
  assert.match(styles, /html\[data-theme="light"\] body::after/);

  // 灯箱在无 backdrop-filter 兜底里必须被排除，否则看图时变白底。
  assert.match(styles, /html\[data-theme="light"\] dialog:not\(\.image-lightbox\)/);

  // JS 侧：light 落属性，其余值回落到深色默认。
  assert.match(appSource, /dataset\.theme = "light"/);
  assert.match(appSource, /delete document\.documentElement\.dataset\.theme/);
});

test("独立服务时代的痕迹已清除", () => {
  for (const source of [html, appSource, styles]) {
    assert.ok(!source.includes("4173"), "不应残留独立服务端口");
    assert.ok(!source.includes("IMAGE_STUDIO_URL"), "不应残留跨进程回环环境变量");
    assert.ok(!source.includes("127.0.0.1:3600"), "不应残留「先启动 Studio」类指引");
    assert.ok(!source.includes("/vendor/"), "不应残留 vendor 路由");
  }
});

test("三份文件行尾一致且无替换字符", () => {
  // 不能断言「必须是 CRLF」或「必须是 LF」：.gitattributes 是 `* text=auto`，
  // 同一份内容的 LF 版与 CRLF 版过 clean filter 后是同一个 blob（已实测哈希相同），
  // 所以 Windows 检出得到 CRLF、CI 的 Linux 检出得到 LF，钉死任一种都会在另一边假红。
  // 真正会造成 diff 噪音的是同一文件里混用，所以断言的是一致性。
  for (const [name, source] of [["index.html", html], ["styles.css", styles], ["app.js", appSource]]) {
    const lf = (source.match(/\n/g) ?? []).length;
    const crlf = (source.match(/\r\n/g) ?? []).length;
    assert.ok(lf > 0, `${name} 应有内容`);
    assert.ok(crlf === lf || crlf === 0, `${name} 行尾混用（LF ${lf} / CRLF ${crlf}）`);
    assert.ok(!source.includes("�"), `${name} 不应含替换字符`);
  }
});
