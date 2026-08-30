// 替代 lucide UMD 包的极小 shim：只实现工作台真正用到的那一小片
// `window.lucide.createIcons({ attrs })`，字形取自构建期烘焙的 lucide-icon-nodes.mjs。
// 为什么不改成静态内联 <svg>：部分字形名是 data-lucide="${cond ? "a" : "b"}" 的模板字符串动态值，
// 改标记必踩；shim 保留「重建 innerHTML 后调一次 createIcons」这套现有用法不变。
import { TEMU_LUCIDE_ICON_NODES } from "./lucide-icon-nodes.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

// 与 lucide 的 defaultAttributes 逐字一致，否则子文档 CSS 里按 24 格视口写的尺寸会错。
const DEFAULT_SVG_ATTRS = Object.freeze({
  xmlns: SVG_NS,
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
});

const A11Y_ATTRS = ["role", "title"];

function hasA11yAttr(attrs) {
  return Object.keys(attrs).some((name) => name.startsWith("aria-") || A11Y_ATTRS.includes(name));
}

function readAttrs(element) {
  const attrs = {};
  for (const attr of Array.from(element.attributes ?? [])) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function mergeClassNames(...names) {
  const merged = [];
  for (const name of names.flatMap((name) => String(name ?? "").split(" "))) {
    if (name && !merged.includes(name)) merged.push(name);
  }
  return merged.join(" ");
}

function createSvgNode(ownerDocument, [tag, attrs, children]) {
  const node = ownerDocument.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, String(value));
  }
  for (const child of children ?? []) {
    node.appendChild(createSvgNode(ownerDocument, child));
  }
  return node;
}

// 缺字形时保持 lucide 的行为：警告并原地留着元素，不抛、不清空。
// 同时把名字回给调用方，让「漏烘焙」这件事可被断言，而不是只在控制台一闪而过。
export function createIcons({ icons = TEMU_LUCIDE_ICON_NODES, nameAttr = "data-lucide", attrs = {}, root } = {}) {
  const scope = root ?? globalThis.document;
  if (!scope) {
    throw new Error("createIcons() 需要一个 DOM root");
  }
  const ownerDocument = scope.ownerDocument ?? scope;

  const missing = [];
  let replaced = 0;

  for (const element of Array.from(scope.querySelectorAll(`[${nameAttr}]`))) {
    const iconName = element.getAttribute(nameAttr);
    if (iconName == null) continue;

    const iconNode = icons[iconName];
    if (!iconNode) {
      missing.push(iconName);
      globalThis.console?.warn?.(`lucide 字形 ${iconName} 未烘焙，元素保持原样`);
      continue;
    }

    const elementAttrs = readAttrs(element);
    const iconAttrs = {
      ...DEFAULT_SVG_ATTRS,
      [nameAttr]: iconName,
      ...(hasA11yAttr(elementAttrs) ? {} : { "aria-hidden": "true" }),
      ...attrs,
      ...elementAttrs,
    };
    const className = mergeClassNames("lucide", `lucide-${iconName}`, elementAttrs.class, attrs.class);
    if (className) iconAttrs.class = className;

    const svg = createSvgNode(ownerDocument, ["svg", iconAttrs, iconNode]);
    const parent = element.parentNode;
    if (!parent) continue;
    parent.replaceChild(svg, element);
    replaced += 1;
  }

  return { replaced, missing };
}

export function installTemuLucideShim(target = globalThis) {
  const lucide = { createIcons, icons: TEMU_LUCIDE_ICON_NODES };
  target.lucide = lucide;
  return lucide;
}

// 原来是一个 UMD script 标签，副作用式地挂上 window.lucide。
// 这里保持同样的形状：浏览器里 import 即装好，Node 测试里没有 document 所以不留副作用。
if (globalThis.document) {
  installTemuLucideShim();
}
