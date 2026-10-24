/*
 * Prompt Kit 的 YouMind 图片 / 提示词配对目录。
 *
 * 每条官网记录只保存一次；分类导航是通过同一组分类 id 对记录做筛选，
 * 不再为每个分类复制一份模板，也不会用关键词把不相关的图片塞进分类。
 */

import { YOUMIND_PROFILE_ENTRIES, YOUMIND_PROFILE_META } from "./youmind-profile-entries.mjs";
import {
  PROMPT_TEMPLATE_CATEGORIES,
  PROMPT_TEMPLATE_DIMENSIONS,
  PROMPT_TEMPLATE_DISCOVERY_CATEGORY,
  PROMPT_TEMPLATE_SOURCES,
} from "./prompt-template-taxonomy.mjs";

export { PROMPT_TEMPLATE_SOURCES, YOUMIND_PROFILE_META };

const TAG_NAME_BY_ID = new Map();
for (const dimension of PROMPT_TEMPLATE_DIMENSIONS) {
  for (const child of dimension.children) {
    TAG_NAME_BY_ID.set(child.id, child.name);
  }
}


export const PROMPT_TEMPLATE_SORT_OPTIONS = Object.freeze([
  { id: "featured", name: "推荐优先" },
  { id: "latest", name: "最新发布" },
  { id: "name", name: "名称排序" },
]);

const DISCOVERY_KIND_BY_CHILD_ID = Object.freeze(
  Object.fromEntries(PROMPT_TEMPLATE_DISCOVERY_CATEGORY.children.map((child) => [child.id, child.kind])),
);

function normalizeText(value) {
  return String(value || "").trim();
}

function getEntryTagIds(entry) {
  return {
    useCases: Array.isArray(entry?.tagIds?.useCases) ? entry.tagIds.useCases : [],
    styles: Array.isArray(entry?.tagIds?.styles) ? entry.tagIds.styles : [],
    subjects: Array.isArray(entry?.tagIds?.subjects) ? entry.tagIds.subjects : [],
  };
}

const ENTRY_TAG_IDS = new Map(
  YOUMIND_PROFILE_ENTRIES.map((entry) => [entry.id, getEntryTagIds(entry)]),
);

function getEntryTagNames(entry) {
  const tagIds = ENTRY_TAG_IDS.get(entry.id) || getEntryTagIds(entry);
  return [...tagIds.useCases, ...tagIds.styles, ...tagIds.subjects]
    .map((id) => TAG_NAME_BY_ID.get(id))
    .filter(Boolean);
}

function entryMatchesDimensionChild(entry, dimension, childId) {
  const tags = ENTRY_TAG_IDS.get(entry.id) || getEntryTagIds(entry);
  return Array.isArray(tags[dimension.sourceDimension]) && tags[dimension.sourceDimension].includes(childId);
}

function getPrettyPromptFallback(prompt) {
  return String(prompt || "")
    .replace(/\{argument\s+name="[^"]*"\s+default="([^"]*)"\}/g, "$1")
    .replace(/[{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function materializeTemplate(entry, category, child) {
  const tagNames = getEntryTagNames(entry);
  const summary = String(entry.description || "").trim() || getPrettyPromptFallback(entry.prompt);
  const searchText = [
    entry.title,
    entry.description,
    entry.prompt,
    entry.authorName,
    ...tagNames,
    category.name,
    child.name,
  ].join("\n").toLocaleLowerCase();

  return Object.freeze({
    id: entry.id,
    name: entry.title,
    prompt: entry.prompt,
    description: entry.description,
    summary,
    promptLength: entry.prompt.length,
    categoryId: category.id,
    subcategoryId: child.id,
    categoryName: category.name,
    subcategoryName: child.name,
    previewKey: entry.id,
    previewAccent: category.accent,
    previewMotif: child.id,
    previewImage: entry.path,
    previewAlt: entry.title,
    previewSourceUrl: entry.sourceUrl,
    previewSourcePage: entry.sourcePage,
    previewSourceLabel: "YouMind",
    model: entry.model,
    modelLabel: entry.modelLabel,
    needReferenceImages: Boolean(entry.needReferenceImages),
    publishedAt: entry.sourcePublishedAt,
    authorName: entry.authorName,
    imageWidth: entry.imageWidth,
    imageHeight: entry.imageHeight,
    qualityRank: entry.sourceIndex,
    featured: Boolean(entry.featured),
    tagNames,
    searchText,
    sourceLicense: entry.sourceLicense,
    sourceLink: entry.sourceLink,
  });
}

function entriesForDiscoveryChild(child) {
  const kind = DISCOVERY_KIND_BY_CHILD_ID[child.id] || "all";
  if (kind === "featured") {
    return YOUMIND_PROFILE_ENTRIES.filter((entry) => entry.featured);
  }
  if (kind === "reference") {
    return YOUMIND_PROFILE_ENTRIES.filter((entry) => entry.needReferenceImages);
  }
  if (kind === "text-only") {
    return YOUMIND_PROFILE_ENTRIES.filter((entry) => !entry.needReferenceImages);
  }
  return YOUMIND_PROFILE_ENTRIES;
}

function entriesForDimensionChild(dimension, child) {
  return YOUMIND_PROFILE_ENTRIES.filter((entry) => entryMatchesDimensionChild(entry, dimension, child.id));
}

function buildCategory(category) {
  const dimension = PROMPT_TEMPLATE_DIMENSIONS.find((item) => item.id === category.id) || null;
  return Object.freeze({
    ...category,
    children: category.children.map((child) => {
      const entries = dimension ? entriesForDimensionChild(dimension, child) : entriesForDiscoveryChild(child);
      return Object.freeze({
        ...child,
        templates: Object.freeze(entries.map((entry) => materializeTemplate(entry, category, child))),
      });
    }),
  });
}

export const PROMPT_TEMPLATE_LIBRARY = Object.freeze(
  PROMPT_TEMPLATE_CATEGORIES.map((category) => buildCategory(category)),
);

export function normalizePromptTemplateLibraryModel(model) {
  const candidate = normalizeText(model);
  return PROMPT_TEMPLATE_SOURCES.some((source) => source.id === candidate) ? candidate : "all";
}

function getTemplatesForChild(category, child, model) {
  const normalizedModel = normalizePromptTemplateLibraryModel(model);
  const templates = child?.templates || [];
  return normalizedModel === "all"
    ? templates
    : templates.filter((template) => template.model === normalizedModel);
}

export function flattenPromptTemplateLibrary({ categoryId = "", subcategoryId = "", model = "all" } = {}) {
  const categories = categoryId
    ? PROMPT_TEMPLATE_LIBRARY.filter((category) => category.id === categoryId)
    : PROMPT_TEMPLATE_LIBRARY;
  const seen = new Set();
  const templates = [];
  for (const category of categories) {
    for (const child of category.children) {
      if (subcategoryId && (category.id !== categoryId || child.id !== subcategoryId)) {
        continue;
      }
      for (const template of getTemplatesForChild(category, child, model)) {
        if (seen.has(template.id)) {
          continue;
        }
        seen.add(template.id);
        templates.push(template);
      }
    }
  }
  return templates;
}

export function sortPromptTemplateLibraryTemplates(templates, sortBy = "featured") {
  const normalizedSort = PROMPT_TEMPLATE_SORT_OPTIONS.some((option) => option.id === sortBy) ? sortBy : "featured";
  return [...templates].sort((left, right) => {
    if (normalizedSort === "latest") {
      const dateDelta = Date.parse(right.publishedAt || "") - Date.parse(left.publishedAt || "");
      if (Number.isFinite(dateDelta) && dateDelta !== 0) {
        return dateDelta;
      }
    } else if (normalizedSort === "name") {
      const nameDelta = left.name.localeCompare(right.name, "zh-CN");
      if (nameDelta !== 0) {
        return nameDelta;
      }
    }
    return left.qualityRank - right.qualityRank || left.id.localeCompare(right.id);
  });
}

export function getPromptTemplateLibraryCategory(categoryId) {
  return PROMPT_TEMPLATE_LIBRARY.find((category) => category.id === categoryId) || PROMPT_TEMPLATE_LIBRARY[0] || null;
}

export function getPromptTemplateLibrarySubcategory(categoryId, subcategoryId) {
  return getPromptTemplateLibraryCategory(categoryId)?.children.find((child) => child.id === subcategoryId) || null;
}

export function getPromptTemplateLibraryChildCount(categoryId, subcategoryId, { model = "all" } = {}) {
  const category = PROMPT_TEMPLATE_LIBRARY.find((item) => item.id === categoryId);
  const child = category?.children.find((item) => item.id === subcategoryId);
  if (!category || !child) {
    return 0;
  }
  return getTemplatesForChild(category, child, model).length;
}

export function getPromptTemplateLibraryCategoryCount(categoryId, { model = "all" } = {}) {
  return flattenPromptTemplateLibrary({ categoryId, model }).length;
}

export function getPromptTemplateLibraryModelCounts() {
  return Object.fromEntries(
    PROMPT_TEMPLATE_SOURCES.map((source) => [
      source.id,
      flattenPromptTemplateLibrary({ model: source.id }).length,
    ]),
  );
}

export function getPromptTemplateLibraryCounts({ model = "all" } = {}) {
  return {
    categories: PROMPT_TEMPLATE_LIBRARY.length,
    subcategories: PROMPT_TEMPLATE_LIBRARY.reduce((sum, category) => sum + category.children.length, 0),
    templates: flattenPromptTemplateLibrary({ model }).length,
  };
}

export function getPromptTemplatePreviewUrl(template) {
  return String(template?.previewImage || "");
}
