import { getGenerationActivityDisplayText } from "./generation-activity-feed.mjs";
import {
  DEFAULT_GENERATION_LOG_GROUP_UNIT,
  GENERATION_LOG_ALL_CHANNELS,
  formatGenerationLogGroupSummary,
  formatGenerationLogRelayText,
  getGenerationLogChannelLabel,
  summarizeGenerationLogGroup,
} from "./generation-log-store.mjs";

export const GENERATION_LOG_PANEL_EMPTY_TEXT = "暂无生成日志";
export const GENERATION_LOG_GROUP_TOGGLE_ATTRIBUTE = "data-generation-log-group-toggle";
export const GENERATION_LOG_CHANNEL_TAB_ATTRIBUTE = "data-generation-log-channel-tab";

function cleanText(value) {
  return String(value || "").trim();
}

function getDocumentRef(host, documentRef) {
  return documentRef || host?.ownerDocument || globalThis.document;
}

function createElement(documentRef, tagName, className, textContent = "") {
  const element = documentRef.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
}

function appendRelay(documentRef, main, relayUrl) {
  const relayText = formatGenerationLogRelayText(relayUrl);
  if (!relayText) {
    return false;
  }
  main.appendChild(createElement(documentRef, "span", "timeline-relay", relayText));
  return true;
}

function appendMeta(documentRef, row, entry, { formatTime }) {
  const meta = createElement(documentRef, "span", "timeline-meta");
  if (cleanText(entry.modeLabel)) {
    meta.appendChild(createElement(documentRef, "span", "timeline-mode", cleanText(entry.modeLabel)));
  }

  const ratioSize = [cleanText(entry.ratio), cleanText(entry.size) ? `(${cleanText(entry.size)})` : ""].filter(Boolean).join(" ");
  if (ratioSize) {
    meta.appendChild(createElement(documentRef, "span", "timeline-ratio-size", ratioSize));
  }

  const times = entry.generationStartedAt || entry.generationCompletedAt
    ? [entry.generationStartedAt, entry.generationCompletedAt].filter(Boolean)
    : [entry.at].filter(Boolean);
  times.forEach((value) => {
    const wrapper = createElement(documentRef, "span", "timeline-start-time");
    const time = createElement(documentRef, "time", "", formatTime(value));
    time.dateTime = value;
    wrapper.appendChild(time);
    meta.appendChild(wrapper);
  });

  if (meta.childNodes.length > 0) {
    row.appendChild(meta);
  }
}

function createEntryRow(documentRef, entry, { showChannelLabel, formatTime, isChild = false }) {
  const row = createElement(documentRef, "li", `timeline-item ${entry.status || "active"}`);
  row.dataset.timelineKey = cleanText(entry.key);
  if (isChild) {
    row.classList.add("timeline-item-child");
  }
  row.appendChild(createElement(documentRef, "span", "timeline-dot"));

  const copy = createElement(documentRef, "div", "timeline-copy");
  const displayText = getGenerationActivityDisplayText(entry.detail);
  const main = createElement(documentRef, "span", "timeline-main");
  main.appendChild(createElement(documentRef, "span", "timeline-summary", displayText.summary || cleanText(entry.title)));
  if (showChannelLabel) {
    const channelLabel = getGenerationLogChannelLabel(entry.channel);
    if (channelLabel) {
      main.appendChild(createElement(documentRef, "span", "timeline-channel", channelLabel));
    }
  }
  if (appendRelay(documentRef, main, entry.relayUrl)) {
    row.classList.add("has-relay");
  }
  copy.appendChild(main);

  if (cleanText(entry.imageUrl)) {
    row.classList.add("has-url");
    const link = createElement(documentRef, "a", "timeline-url", cleanText(entry.imageUrl));
    link.href = cleanText(entry.imageUrl);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    copy.appendChild(link);
  }

  if (displayText.detail) {
    row.classList.add("has-detail");
    copy.appendChild(createElement(documentRef, "p", "timeline-detail", displayText.detail));
  }

  row.appendChild(copy);
  appendMeta(documentRef, row, entry, { formatTime });
  return row;
}

function createGroupRow(documentRef, group, { showChannelLabel, formatTime, expanded }) {
  const summary = summarizeGenerationLogGroup(group);
  const row = createElement(documentRef, "li", `timeline-item timeline-item-group ${summary.status}`);
  row.dataset.timelineKey = cleanText(group.key);
  row.dataset.generationLogGroupId = cleanText(group.groupId);
  row.dataset.generationLogGroupExpanded = String(Boolean(expanded));
  row.appendChild(createElement(documentRef, "span", "timeline-dot"));

  const copy = createElement(documentRef, "div", "timeline-copy");
  const main = createElement(documentRef, "span", "timeline-main");
  const toggle = createElement(documentRef, "button", "timeline-group-toggle");
  toggle.type = "button";
  toggle.setAttribute(GENERATION_LOG_GROUP_TOGGLE_ATTRIBUTE, cleanText(group.groupId));
  toggle.setAttribute("aria-expanded", String(Boolean(expanded)));
  toggle.appendChild(createElement(documentRef, "span", "timeline-group-caret", expanded ? "▾" : "▸"));
  toggle.appendChild(createElement(documentRef, "span", "timeline-summary", cleanText(group.groupLabel) || "生成批次"));
  main.appendChild(toggle);
  if (showChannelLabel) {
    const channelLabel = getGenerationLogChannelLabel(group.channel);
    if (channelLabel) {
      main.appendChild(createElement(documentRef, "span", "timeline-channel", channelLabel));
    }
  }
  main.appendChild(
    createElement(
      documentRef,
      "span",
      "timeline-group-summary",
      formatGenerationLogGroupSummary(group, cleanText(group.groupUnit) || DEFAULT_GENERATION_LOG_GROUP_UNIT),
    ),
  );
  if (appendRelay(documentRef, main, group.relayUrl)) {
    row.classList.add("has-relay");
  }
  copy.appendChild(main);
  row.appendChild(copy);
  appendMeta(documentRef, row, { ...group, ratio: "", size: "" }, { formatTime });
  return row;
}

export function renderGenerationLogRows(
  list,
  {
    entries = [],
    channel = GENERATION_LOG_ALL_CHANNELS,
    expandedGroupIds = null,
    emptyText = GENERATION_LOG_PANEL_EMPTY_TEXT,
    formatTime = (value) => cleanText(value),
    documentRef = null,
  } = {},
) {
  if (!list) {
    return list;
  }

  const documentValue = getDocumentRef(list, documentRef);
  const showChannelLabel = cleanText(channel) === GENERATION_LOG_ALL_CHANNELS;
  const expanded = expandedGroupIds instanceof Set ? expandedGroupIds : new Set(Array.isArray(expandedGroupIds) ? expandedGroupIds : []);
  list.replaceChildren();

  if (entries.length === 0) {
    const empty = createElement(documentValue, "li", "timeline-item timeline-item-empty pending");
    empty.dataset.timelineKey = "generation-log:empty";
    empty.appendChild(createElement(documentValue, "span", "timeline-dot"));
    const copy = createElement(documentValue, "div", "timeline-copy");
    const main = createElement(documentValue, "span", "timeline-main");
    main.appendChild(createElement(documentValue, "span", "timeline-summary", emptyText));
    copy.appendChild(main);
    empty.appendChild(copy);
    list.appendChild(empty);
    return list;
  }

  entries.forEach((entry) => {
    if (entry?.kind !== "group") {
      list.appendChild(createEntryRow(documentValue, entry, { showChannelLabel, formatTime }));
      return;
    }

    const isExpanded = expanded.has(cleanText(entry.groupId));
    list.appendChild(createGroupRow(documentValue, entry, { showChannelLabel, formatTime, expanded: isExpanded }));
    if (!isExpanded) {
      return;
    }
    (Array.isArray(entry.children) ? entry.children : []).forEach((child) => {
      list.appendChild(createEntryRow(documentValue, { ...child, channel: entry.channel }, { showChannelLabel: false, formatTime, isChild: true }));
    });
  });

  return list;
}

/* 板块切换：日志面板只有配置区那一个，靠这排标签把各板块的条目彼此隔开。 */
export function renderGenerationLogChannelTabs(
  host,
  { channels = [], activeChannel = GENERATION_LOG_ALL_CHANNELS, getChannelLabel = () => "", allLabel = "全部板块", documentRef = null } = {},
) {
  if (!host) {
    return host;
  }

  const documentValue = getDocumentRef(host, documentRef);
  host.replaceChildren();
  channels.forEach((channel) => {
    const normalizedChannel = cleanText(channel);
    const label = normalizedChannel === GENERATION_LOG_ALL_CHANNELS ? allLabel : getChannelLabel(normalizedChannel);
    if (!label) {
      return;
    }
    const tab = createElement(documentValue, "button", "generation-log-channel-tab", label);
    tab.type = "button";
    tab.setAttribute(GENERATION_LOG_CHANNEL_TAB_ATTRIBUTE, normalizedChannel);
    const isActive = normalizedChannel === cleanText(activeChannel);
    tab.setAttribute("aria-pressed", String(isActive));
    if (isActive) {
      tab.classList.add("is-active");
    }
    host.appendChild(tab);
  });
  return host;
}

export function readGenerationLogChannelTabValue(target) {
  const tab = target?.closest?.(`[${GENERATION_LOG_CHANNEL_TAB_ATTRIBUTE}]`);
  return tab ? cleanText(tab.getAttribute(GENERATION_LOG_CHANNEL_TAB_ATTRIBUTE)) : "";
}

export function readGenerationLogGroupToggleId(target) {
  const toggle = target?.closest?.(`[${GENERATION_LOG_GROUP_TOGGLE_ATTRIBUTE}]`);
  return toggle ? cleanText(toggle.getAttribute(GENERATION_LOG_GROUP_TOGGLE_ATTRIBUTE)) : "";
}

export function toggleGenerationLogGroup(expandedGroupIds, groupId) {
  const next = expandedGroupIds instanceof Set ? new Set(expandedGroupIds) : new Set(Array.isArray(expandedGroupIds) ? expandedGroupIds : []);
  const normalizedId = cleanText(groupId);
  if (!normalizedId) {
    return next;
  }
  if (next.has(normalizedId)) {
    next.delete(normalizedId);
  } else {
    next.add(normalizedId);
  }
  return next;
}
