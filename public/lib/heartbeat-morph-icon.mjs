import { HEARTBEAT_MORPH_ICON_ENTRIES } from "./heartbeat-morph-icon-paths.mjs";

/* 心跳图标：上游每推来一次 heartbeat 就变形一次，20 个图标随机轮换。
   一次变形 = 一次心跳唤起，所以变形只由心跳事件驱动，不跑自己的定时器——
   界面上看到图标动，就等于刚收到一次上游心跳。 */

const HEARTBEAT_MORPH_SPRING = "bouncy";

function getDocumentRef(documentRef = null) {
  return documentRef || globalThis.document;
}

/* 变形引擎一次性注册：createGenerationLoadingShell 有十来个调用点，
   逐个透传 createMorph 会把无关代码全改一遍。morphicons 的产物只存在于
   public/lib/vendor/，而本模块要逐字节同步到 public/lib/ 且需在 Node 测试里可导入，
   所以这里不能直接 import 它，改由浏览器入口启动时注册一次。 */
let registeredCreateMorph = null;

export function registerHeartbeatMorphEngine(createMorph) {
  registeredCreateMorph = typeof createMorph === "function" ? createMorph : null;
  return registeredCreateMorph;
}

export function getHeartbeatMorphEngine() {
  return registeredCreateMorph;
}

export function getHeartbeatMorphIconCount() {
  return HEARTBEAT_MORPH_ICON_ENTRIES.length;
}

/* 连续两次抽到同一个图标时界面上什么都不会变，那一次心跳就白跳了，
   所以下一个索引一定与当前不同。 */
export function pickNextHeartbeatMorphIndex(currentIndex, random = Math.random) {
  const total = HEARTBEAT_MORPH_ICON_ENTRIES.length;
  if (total <= 1) {
    return 0;
  }

  const value = Number(random());
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= total) {
    return Math.floor(safeValue * total);
  }

  /* 在「除当前项以外的 total-1 项」里均匀抽取，再映射回完整下标，
     这样每个候选概率相同，不会因为跳过当前项而让某一项偏多。 */
  const offset = Math.floor(safeValue * (total - 1));
  return offset >= currentIndex ? offset + 1 : offset;
}

export function createHeartbeatMorphIcon(
  documentRef = null,
  { createMorph = null, random = Math.random, startIndex = 0, reducedMotion = "user" } = {},
) {
  const documentValue = getDocumentRef(documentRef);
  const total = HEARTBEAT_MORPH_ICON_ENTRIES.length;
  const initialIndex = Number.isInteger(startIndex) && startIndex >= 0 && startIndex < total ? startIndex : 0;
  const [initialName, initialPath] = HEARTBEAT_MORPH_ICON_ENTRIES[initialIndex];

  const svg = documentValue.createElementNS
    ? documentValue.createElementNS("http://www.w3.org/2000/svg", "svg")
    : documentValue.createElement("svg");
  svg.setAttribute("class", "generation-loading-heartbeat");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  /* 图标只是心跳的视觉回执，状态文本已经把同样的信息读给了辅助技术。 */
  svg.setAttribute("aria-hidden", "true");

  const path = documentValue.createElementNS
    ? documentValue.createElementNS("http://www.w3.org/2000/svg", "path")
    : documentValue.createElement("path");
  path.setAttribute("d", initialPath);
  svg.append?.(path);

  const engine = typeof createMorph === "function" ? createMorph : registeredCreateMorph;
  let morph = null;
  if (typeof engine === "function") {
    try {
      morph = engine(path, initialPath, { reducedMotion });
    } catch {
      /* 变形引擎起不来时退化成直接换 d：心跳回执比动画重要，不能因为它整个消失。 */
      morph = null;
    }
  }

  const nodes = {
    svg,
    path,
    morph,
    index: initialIndex,
    name: initialName,
    beats: 0,
    random: typeof random === "function" ? random : Math.random,
  };
  svg.dataset && (svg.dataset.heartbeatIcon = initialName);
  return nodes;
}

/* 每收到一次 heartbeat 调一次。返回本次切到的图标名，方便测试与调试。 */
export function beatHeartbeatMorphIcon(nodes) {
  if (!nodes?.path) {
    return "";
  }

  const nextIndex = pickNextHeartbeatMorphIndex(nodes.index, nodes.random);
  const [nextName, nextPath] = HEARTBEAT_MORPH_ICON_ENTRIES[nextIndex];
  nodes.index = nextIndex;
  nodes.name = nextName;
  nodes.beats += 1;

  if (nodes.morph?.morphTo) {
    nodes.morph.morphTo(nextPath, HEARTBEAT_MORPH_SPRING);
  } else {
    nodes.path.setAttribute("d", nextPath);
  }

  if (nodes.svg?.dataset) {
    nodes.svg.dataset.heartbeatIcon = nextName;
    nodes.svg.dataset.heartbeatBeats = String(nodes.beats);
  }
  return nextName;
}

export function destroyHeartbeatMorphIcon(nodes) {
  if (nodes?.morph?.destroy) {
    try {
      nodes.morph.destroy();
    } catch {
      /* 已经销毁或引擎异常时忽略：调用点只关心节点能安全丢弃。 */
    }
  }
  if (nodes) {
    nodes.morph = null;
  }
  return nodes || null;
}
