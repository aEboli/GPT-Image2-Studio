const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GALLERY_HISTORY_DAYS_PER_PAGE = 5;
const VALID_GALLERY_WINDOW_FILTERS = new Set(["all", "today", "recent", "older"]);
const VALID_GALLERY_REFERENCE_FILTERS = new Set(["all", "with-reference", "without-reference"]);
const PROMPT_GENERATION_KINDS = new Set(["", "prompt", "image"]);
const NON_PROMPT_GENERATION_KINDS = new Set([
  "style-transfer",
  "reference-analysis",
  "image-decomposition",
  "quick-blend",
]);
const GALLERY_LAYOUT_BREAKPOINTS = {
  mobileMaxWidth: 720,
  tabletMaxWidth: 1180,
};
const DEFAULT_GALLERY_COLUMN_GAP = 12;
const DEFAULT_GALLERY_MIN_COLUMN_WIDTH = 264;
const DEFAULT_GALLERY_MAX_COLUMNS = 6;

function toValidDate(dateLike) {
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    const [year, month, day] = dateLike.split("-").map((value) => Number(value));
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(dateLike) {
  const date = toValidDate(dateLike);
  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDay(dateLike) {
  const date = toValidDate(dateLike);
  if (!date) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeKind(value) {
  return normalizeText(value).replace(/_/g, "-");
}

function relativePathHasKind(relativePath, kind) {
  const normalizedPath = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
  return normalizedPath
    .split("/")
    .some((segment) => segment === kind || segment.endsWith(`-${kind}`));
}

function getExplicitGalleryKinds(item) {
  return [item?.mode, item?.generationMode, item?.assetKind].map(normalizeKind).filter(Boolean);
}

function parseSizeValue(value) {
  const match = /^\s*(\d+)\s*x\s*(\d+)\s*$/i.exec(String(value || ""));
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    width,
    height,
    area: width * height,
  };
}

function formatSizeLabel(value) {
  return String(value || "").replace(/x/gi, " × ");
}

function getDayDifference(dateLike, referenceNow) {
  const day = startOfLocalDay(dateLike);
  const referenceDay = startOfLocalDay(referenceNow);
  if (!day || !referenceDay) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((referenceDay.getTime() - day.getTime()) / DAY_IN_MS);
}

function matchesWindow(dateLike, filterValue, referenceNow) {
  const dayDifference = getDayDifference(dateLike, referenceNow);

  if (!Number.isFinite(dayDifference) || dayDifference < 0) {
    return filterValue === "all";
  }

  if (filterValue === "today") {
    return dayDifference === 0;
  }

  if (filterValue === "recent") {
    return dayDifference >= 0 && dayDifference < 7;
  }

  if (filterValue === "older") {
    return dayDifference >= 7;
  }

  return true;
}

function hasReferenceImages(item) {
  return Boolean(item?.hasReferenceImage) || Boolean(item?.referenceImageName) || item?.referenceImageNames?.length > 0;
}

function matchesSearch(item, query) {
  if (!query) {
    return true;
  }

  const haystack = normalizeText(
    [
      item?.prompt,
      item?.filename,
      item?.createdAt,
      toDateKey(item?.createdAt),
      item?.size,
      item?.ratio,
      item?.ratioLabel,
      item?.quality,
      item?.format,
      item?.responsesModel,
      item?.imageModel,
      item?.referenceImageName,
      ...(Array.isArray(item?.referenceImageNames) ? item.referenceImageNames : []),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return query.split(/\s+/).every((token) => haystack.includes(token));
}

function matchesDate(dateLike, exactDate) {
  if (!exactDate) {
    return true;
  }

  return toDateKey(dateLike) === exactDate;
}

function matchesSize(sizeLike, sizeFilter) {
  if (sizeFilter === "all") {
    return true;
  }

  return normalizeText(sizeLike) === normalizeText(sizeFilter);
}

function matchesReference(item, referenceFilter) {
  if (referenceFilter === "all") {
    return true;
  }

  const hasReference = hasReferenceImages(item);
  if (referenceFilter === "with-reference") {
    return hasReference;
  }

  if (referenceFilter === "without-reference") {
    return !hasReference;
  }

  return true;
}

function buildSectionLabel(sectionKey, referenceNow) {
  const dayDifference = getDayDifference(sectionKey, referenceNow);

  if (dayDifference === 0) {
    return "今天";
  }

  if (dayDifference === 1) {
    return "昨天";
  }

  return sectionKey;
}

export function normalizeGalleryWindowFilter(value) {
  return VALID_GALLERY_WINDOW_FILTERS.has(value) ? value : "all";
}

export function normalizeGalleryReferenceFilter(value) {
  return VALID_GALLERY_REFERENCE_FILTERS.has(value) ? value : "all";
}

export function normalizeGallerySearchQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeGalleryDateFilter(value) {
  return toDateKey(value);
}

export function normalizeGallerySizeFilter(value, items = []) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue || normalizedValue === "all") {
    return "all";
  }

  for (const item of items) {
    const candidate = String(item?.size || "").trim();
    if (candidate && normalizeText(candidate) === normalizedValue) {
      return candidate;
    }
  }

  return "all";
}

export function normalizeGalleryFilters(filters = {}, items = []) {
  return {
    query: normalizeGallerySearchQuery(filters.query),
    window: normalizeGalleryWindowFilter(filters.window),
    date: normalizeGalleryDateFilter(filters.date),
    size: normalizeGallerySizeFilter(filters.size, items),
    reference: normalizeGalleryReferenceFilter(filters.reference),
  };
}

export function sortGalleryItemsByCreatedAtDesc(items) {
  return [...items].sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
  );
}

export function isPromptGenerationGalleryItem(item) {
  const explicitKinds = getExplicitGalleryKinds(item);
  if (explicitKinds.some((kind) => NON_PROMPT_GENERATION_KINDS.has(kind))) {
    return false;
  }

  if (explicitKinds.some((kind) => !PROMPT_GENERATION_KINDS.has(kind))) {
    return false;
  }

  return ![...NON_PROMPT_GENERATION_KINDS].some((kind) => relativePathHasKind(item?.relativePath, kind));
}

export function getPromptGenerationGalleryItems(items) {
  return sortGalleryItemsByCreatedAtDesc(items).filter(isPromptGenerationGalleryItem);
}

export function getRecentGalleryItems(items, limit = 4) {
  const resolvedLimit = Number.isInteger(limit) && limit > 0 ? limit : 4;
  return sortGalleryItemsByCreatedAtDesc(items).slice(0, resolvedLimit);
}

export function normalizeGalleryHistoryPage(value) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 0;
}

function normalizeGalleryHistoryPageSize(value) {
  const pageSize = Number(value);
  return Number.isFinite(pageSize) && pageSize > 0
    ? Math.floor(pageSize)
    : DEFAULT_GALLERY_HISTORY_DAYS_PER_PAGE;
}

export function paginateGallerySections(
  sections,
  page = 0,
  pageSize = DEFAULT_GALLERY_HISTORY_DAYS_PER_PAGE,
) {
  const sourceSections = Array.isArray(sections) ? sections : [];
  const resolvedPageSize = normalizeGalleryHistoryPageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(sourceSections.length / resolvedPageSize));
  const resolvedPage = Math.min(normalizeGalleryHistoryPage(page), totalPages - 1);
  const startIndex = resolvedPage * resolvedPageSize;
  const pagedSections = sourceSections.slice(startIndex, startIndex + resolvedPageSize);

  return {
    page: resolvedPage,
    pageSize: resolvedPageSize,
    totalPages,
    totalSections: sourceSections.length,
    startSection: sourceSections.length === 0 ? 0 : startIndex + 1,
    endSection: Math.min(sourceSections.length, startIndex + pagedSections.length),
    hasPrevious: resolvedPage > 0,
    hasNext: resolvedPage < totalPages - 1,
    sections: pagedSections,
  };
}

export function getGalleryLayoutModeForWidth(width) {
  const resolvedWidth = Number(width);
  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    return "desktop";
  }

  if (resolvedWidth <= GALLERY_LAYOUT_BREAKPOINTS.mobileMaxWidth) {
    return "mobile";
  }

  if (resolvedWidth <= GALLERY_LAYOUT_BREAKPOINTS.tabletMaxWidth) {
    return "tablet";
  }

  return "desktop";
}

export function getGalleryColumnCountForWidth(width, options = {}) {
  const resolvedWidth = Number(width);
  if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0) {
    return 1;
  }

  const gap = Math.max(0, Number(options.gap) || DEFAULT_GALLERY_COLUMN_GAP);
  const minColumnWidth = Math.max(180, Number(options.minColumnWidth) || DEFAULT_GALLERY_MIN_COLUMN_WIDTH);
  const maxColumns = Math.max(1, Number(options.maxColumns) || DEFAULT_GALLERY_MAX_COLUMNS);

  return Math.max(1, Math.min(maxColumns, Math.floor((resolvedWidth + gap) / (minColumnWidth + gap))));
}

export function distributeGalleryItemsIntoColumns(items, columnCount) {
  const resolvedCount = Math.max(1, Number.isInteger(columnCount) ? columnCount : 1);
  const columns = Array.from({ length: resolvedCount }, () => []);

  sortGalleryItemsByCreatedAtDesc(items).forEach((item, index) => {
    columns[index % resolvedCount].push(item);
  });

  return columns.filter((column) => column.length > 0);
}

export function buildGalleryTimeFilterOptions(items, referenceNow = new Date()) {
  const sortedItems = sortGalleryItemsByCreatedAtDesc(items);

  return [
    { value: "all", label: "全部", count: sortedItems.length },
    {
      value: "today",
      label: "今天",
      count: sortedItems.filter((item) => matchesWindow(item.createdAt, "today", referenceNow)).length,
    },
    {
      value: "recent",
      label: "近 7 天",
      count: sortedItems.filter((item) => matchesWindow(item.createdAt, "recent", referenceNow)).length,
    },
    {
      value: "older",
      label: "更早",
      count: sortedItems.filter((item) => matchesWindow(item.createdAt, "older", referenceNow)).length,
    },
  ];
}

export function buildGallerySizeFilterOptions(items) {
  const counts = new Map();

  for (const item of items) {
    const size = String(item?.size || "").trim();
    if (!size) {
      continue;
    }

    counts.set(size, (counts.get(size) || 0) + 1);
  }

  const sizeOptions = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      const leftSize = parseSizeValue(left[0]);
      const rightSize = parseSizeValue(right[0]);
      if (leftSize && rightSize && rightSize.area !== leftSize.area) {
        return rightSize.area - leftSize.area;
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([value, count]) => ({
      value,
      label: formatSizeLabel(value),
      count,
    }));

  return [{ value: "all", label: "全部尺寸", count: items.length }, ...sizeOptions];
}

export function buildGalleryReferenceFilterOptions(items) {
  const withReferenceCount = items.filter((item) => hasReferenceImages(item)).length;

  return [
    { value: "all", label: "全部来源", count: items.length },
    { value: "with-reference", label: "带参考图", count: withReferenceCount },
    { value: "without-reference", label: "无参考图", count: items.length - withReferenceCount },
  ];
}

export function filterGalleryItemsByWindow(items, filterValue, referenceNow = new Date()) {
  return filterGalleryItems(items, { window: filterValue }, referenceNow);
}

export function filterGalleryItems(items, filters = {}, referenceNow = new Date()) {
  const normalizedFilters = normalizeGalleryFilters(filters, items);

  return sortGalleryItemsByCreatedAtDesc(items).filter(
    (item) =>
      matchesSearch(item, normalizeText(normalizedFilters.query)) &&
      matchesWindow(item.createdAt, normalizedFilters.window, referenceNow) &&
      matchesDate(item.createdAt, normalizedFilters.date) &&
      matchesSize(item.size, normalizedFilters.size) &&
      matchesReference(item, normalizedFilters.reference),
  );
}

export function buildGallerySections(items, referenceNow = new Date()) {
  const sections = new Map();

  for (const item of sortGalleryItemsByCreatedAtDesc(items)) {
    const sectionKey = toDateKey(item.createdAt) || "未标记日期";
    const current = sections.get(sectionKey) || [];
    current.push(item);
    sections.set(sectionKey, current);
  }

  return [...sections.entries()].map(([key, sectionItems]) => ({
    key,
    label: key === "未标记日期" ? key : buildSectionLabel(key, referenceNow),
    dateText: key,
    count: sectionItems.length,
    items: sectionItems,
  }));
}
