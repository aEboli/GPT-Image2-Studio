import { sanitizeGenerationActivityDetail } from "./generation-activity-feed.mjs";

export const DEFAULT_GENERATION_LOG_CHANNEL = "prompt";
export const GENERATION_LOG_ALL_CHANNELS = "all";
export const GENERATION_LOG_CHANNEL_LIMIT = 12;
export const GENERATION_LOG_GROUP_CHILD_LIMIT = 24;
export const GENERATION_LOG_STORAGE_VERSION = 2;
export const DEFAULT_GENERATION_LOG_GROUP_UNIT = "张";

export const GENERATION_LOG_CHANNELS = [
  "prompt",
  "style-transfer",
  "image-edit",
  "quick-blend",
  "image-decomposition",
  "reference-analysis",
  "creation",
  "portrait",
  "article-illustration",
  "ppt",
];

/* 批量板块按批次聚合为一条组行；其余板块按任务平铺，不引入分组层级。 */
export const GENERATION_LOG_BATCH_CHANNELS = ["creation", "portrait", "article-illustration", "ppt"];

export const GENERATION_LOG_CHANNEL_LABELS = {
  prompt: "提示词生图",
  "style-transfer": "风格迁移",
  "image-edit": "图片编辑",
  "quick-blend": "快速溶图",
  "image-decomposition": "图片拆解",
  "reference-analysis": "融图分析",
  creation: "套图模式",
  portrait: "写真模式",
  "article-illustration": "文章插图",
  ppt: "PPT生成",
};

const GENERATION_LOG_STATUSES = ["active", "done", "error", "pending"];
const GENERATION_LOG_RUNNING_STATUSES = ["active", "pending"];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return GENERATION_LOG_STATUSES.includes(value) ? value : "active";
}

function normalizeTotal(value) {
  const total = Number(value);
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

export function normalizeGenerationLogChannel(channel) {
  const normalized = cleanText(channel);
  return GENERATION_LOG_CHANNELS.includes(normalized) ? normalized : DEFAULT_GENERATION_LOG_CHANNEL;
}

export function isGenerationLogBatchChannel(channel) {
  return GENERATION_LOG_BATCH_CHANNELS.includes(normalizeGenerationLogChannel(channel));
}

export function getGenerationLogChannelLabel(channel) {
  const normalized = normalizeGenerationLogChannel(channel);
  return GENERATION_LOG_CHANNEL_LABELS[normalized] || "";
}

/* 中转地址只存裸 URL，`URL：` 前缀留给渲染层，避免同一个值在存储里出现两种形态。 */
export function normalizeGenerationLogRelayUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  const labeled = text.match(/^(?:URL|中转)\s*[：:]\s*(.+)$/);
  return cleanText(labeled ? labeled[1] : text);
}

export function formatGenerationLogRelayText(relayUrl) {
  const normalized = normalizeGenerationLogRelayUrl(relayUrl);
  return normalized ? `URL：${normalized}` : "";
}

export function createGenerationLogStore() {
  return { version: GENERATION_LOG_STORAGE_VERSION, channels: {} };
}

function getChannelRows(store, channel) {
  const rows = store?.channels?.[channel];
  return Array.isArray(rows) ? rows : [];
}

function sortByOrderDesc(rows) {
  return [...rows].sort((left, right) => cleanText(right?.orderAt).localeCompare(cleanText(left?.orderAt)));
}

function normalizeEntry(entry, existing = null) {
  const key = cleanText(entry?.key) || cleanText(existing?.key);
  if (!key) {
    return null;
  }

  const at = cleanText(entry?.at) || cleanText(existing?.at);
  const relayUrl = normalizeGenerationLogRelayUrl(entry?.relayUrl) || normalizeGenerationLogRelayUrl(existing?.relayUrl);
  return {
    ...existing,
    ...entry,
    key,
    kind: "entry",
    title: cleanText(entry?.title) || cleanText(existing?.title),
    detail: sanitizeGenerationActivityDetail(entry?.detail ?? existing?.detail),
    modeLabel: cleanText(entry?.modeLabel) || cleanText(existing?.modeLabel),
    imageUrl: cleanText(entry?.imageUrl) || cleanText(existing?.imageUrl),
    relayUrl,
    ratio: cleanText(entry?.ratio) || cleanText(existing?.ratio),
    size: cleanText(entry?.size) || cleanText(existing?.size),
    status: normalizeStatus(entry?.status ?? existing?.status),
    at,
    generationStartedAt: cleanText(existing?.generationStartedAt) || cleanText(entry?.generationStartedAt),
    generationCompletedAt: cleanText(existing?.generationCompletedAt) || cleanText(entry?.generationCompletedAt),
    orderAt: cleanText(existing?.orderAt) || cleanText(existing?.at) || cleanText(entry?.orderAt) || at,
  };
}

/* 组行汇总只从子条目实时推导，不缓存计数，重渲染即与卡片一致。 */
export function summarizeGenerationLogGroup(group = {}) {
  const children = Array.isArray(group?.children) ? group.children : [];
  const completedCount = children.filter((child) => child?.status === "done").length;
  const failedCount = children.filter((child) => child?.status === "error").length;
  const runningCount = children.filter((child) => GENERATION_LOG_RUNNING_STATUSES.includes(child?.status)).length;
  const totalCount = Math.max(normalizeTotal(group?.totalCount), children.length);
  const pendingCount = Math.max(0, totalCount - completedCount - failedCount - runningCount);
  const status = runningCount > 0 || pendingCount > 0 ? "active" : failedCount > 0 ? "error" : completedCount > 0 ? "done" : "active";
  return { totalCount, completedCount, failedCount, runningCount: runningCount + pendingCount, status };
}

export function formatGenerationLogGroupSummary(group = {}, unit = DEFAULT_GENERATION_LOG_GROUP_UNIT) {
  const summary = summarizeGenerationLogGroup(group);
  const unitText = cleanText(unit) || DEFAULT_GENERATION_LOG_GROUP_UNIT;
  return [
    `${summary.totalCount} ${unitText}`,
    `完成 ${summary.completedCount}`,
    `失败 ${summary.failedCount}`,
    `进行中 ${summary.runningCount}`,
  ].join(" · ");
}

function normalizeGroup(group, existing = null) {
  const groupId = cleanText(group?.groupId) || cleanText(existing?.groupId);
  if (!groupId) {
    return null;
  }

  const at = cleanText(group?.at) || cleanText(existing?.at);
  const relayUrl = normalizeGenerationLogRelayUrl(group?.relayUrl) || normalizeGenerationLogRelayUrl(existing?.relayUrl);
  return {
    ...existing,
    ...group,
    key: `group:${groupId}`,
    kind: "group",
    groupId,
    groupLabel: cleanText(group?.groupLabel) || cleanText(existing?.groupLabel),
    groupUnit: cleanText(group?.groupUnit) || cleanText(existing?.groupUnit) || DEFAULT_GENERATION_LOG_GROUP_UNIT,
    totalCount: Math.max(normalizeTotal(group?.totalCount), normalizeTotal(existing?.totalCount)),
    modeLabel: cleanText(group?.modeLabel) || cleanText(existing?.modeLabel),
    relayUrl,
    children: Array.isArray(existing?.children) ? existing.children : [],
    at,
    orderAt: cleanText(existing?.orderAt) || cleanText(existing?.at) || cleanText(group?.orderAt) || at,
  };
}

function replaceChannelRows(store, channel, rows) {
  const normalizedChannel = normalizeGenerationLogChannel(channel);
  return {
    version: GENERATION_LOG_STORAGE_VERSION,
    channels: { ...store?.channels, [normalizedChannel]: sortByOrderDesc(rows).slice(0, GENERATION_LOG_CHANNEL_LIMIT) },
  };
}

export function upsertGenerationLogEntry(store, entry = {}) {
  const channel = normalizeGenerationLogChannel(entry?.channel);
  const rows = getChannelRows(store, channel);
  const key = cleanText(entry?.key);
  if (!key) {
    return store || createGenerationLogStore();
  }

  const existing = rows.find((row) => row?.kind !== "group" && cleanText(row?.key) === key) || null;
  const nextEntry = normalizeEntry({ ...entry, channel }, existing);
  if (!nextEntry) {
    return store || createGenerationLogStore();
  }

  const nextRows = existing
    ? rows.map((row) => (row?.kind !== "group" && cleanText(row?.key) === key ? nextEntry : row))
    : [nextEntry, ...rows];
  return replaceChannelRows(store, channel, nextRows);
}

export function upsertGenerationLogGroupEntry(store, entry = {}) {
  const channel = normalizeGenerationLogChannel(entry?.channel);
  const groupId = cleanText(entry?.groupId);
  if (!groupId) {
    return upsertGenerationLogEntry(store, entry);
  }

  const rows = getChannelRows(store, channel);
  const existingGroup = rows.find((row) => row?.kind === "group" && cleanText(row?.groupId) === groupId) || null;
  const group = normalizeGroup({ ...entry, channel }, existingGroup);
  if (!group) {
    return store || createGenerationLogStore();
  }

  const groupItemId = cleanText(entry?.groupItemId);
  const childKey = cleanText(entry?.key) || (groupItemId ? `${groupId}:${groupItemId}` : "");
  if (childKey) {
    const children = Array.isArray(existingGroup?.children) ? existingGroup.children : [];
    const existingChild = children.find((child) => cleanText(child?.key) === childKey) || null;
    const nextChild = normalizeEntry({ ...entry, channel, key: childKey, groupItemId }, existingChild);
    if (nextChild) {
      /* 子条目按插入顺序排列，让批次内的第 1 张到第 N 张保持计划顺序。 */
      const nextChildren = existingChild
        ? children.map((child) => (cleanText(child?.key) === childKey ? nextChild : child))
        : [...children, nextChild];
      group.children = nextChildren.slice(-GENERATION_LOG_GROUP_CHILD_LIMIT);
    }
  }

  /* 组行的排序时间锁在批次创建时刻，避免每张图更新都把整组顶到最上面。 */
  group.at = cleanText(entry?.at) || group.at;
  const nextRows = existingGroup
    ? rows.map((row) => (row?.kind === "group" && cleanText(row?.groupId) === groupId ? group : row))
    : [group, ...rows];
  return replaceChannelRows(store, channel, nextRows);
}

export function getGenerationLogChannelEntries(store, channel) {
  const normalizedChannel = normalizeGenerationLogChannel(channel);
  return sortByOrderDesc(getChannelRows(store, normalizedChannel)).map((row) => ({ ...row, channel: normalizedChannel }));
}

export function getGenerationLogAllEntries(store) {
  const rows = GENERATION_LOG_CHANNELS.flatMap((channel) => getGenerationLogChannelEntries(store, channel));
  return sortByOrderDesc(rows).slice(0, GENERATION_LOG_CHANNEL_LIMIT * GENERATION_LOG_CHANNELS.length);
}

export function serializeGenerationLogStore(store) {
  const channels = GENERATION_LOG_CHANNELS.reduce((accumulator, channel) => {
    const rows = getChannelRows(store, channel);
    return rows.length > 0 ? { ...accumulator, [channel]: rows.slice(0, GENERATION_LOG_CHANNEL_LIMIT) } : accumulator;
  }, {});
  return { version: GENERATION_LOG_STORAGE_VERSION, channels };
}

function reviveRow(row, normalizeRow) {
  if (row?.kind === "group") {
    const group = normalizeGroup(row, null);
    if (!group) {
      return null;
    }
    const children = (Array.isArray(row?.children) ? row.children : [])
      .map((child) => normalizeEntry(normalizeRow ? normalizeRow(child) : child, null))
      .filter(Boolean)
      .slice(-GENERATION_LOG_GROUP_CHILD_LIMIT);
    return { ...group, children };
  }

  return normalizeEntry(normalizeRow ? normalizeRow(row) : row, null);
}

/* v1 存的是单一数组，全部来自走任务队列的板块，整体归入 prompt 分区即可无损迁移。 */
export function parseGenerationLogStore(raw, { normalizeRow = null } = {}) {
  const source = typeof raw === "string" ? safeParseJson(raw) : raw;
  if (Array.isArray(source)) {
    const rows = source.map((row) => reviveRow(row, normalizeRow)).filter(Boolean);
    return replaceChannelRows(createGenerationLogStore(), DEFAULT_GENERATION_LOG_CHANNEL, rows);
  }

  if (!source || typeof source !== "object" || !source.channels || typeof source.channels !== "object") {
    return createGenerationLogStore();
  }

  return GENERATION_LOG_CHANNELS.reduce((store, channel) => {
    const rows = (Array.isArray(source.channels[channel]) ? source.channels[channel] : [])
      .map((row) => reviveRow(row, normalizeRow))
      .filter(Boolean);
    return rows.length > 0 ? replaceChannelRows(store, channel, rows) : store;
  }, createGenerationLogStore());
}

function safeParseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}
