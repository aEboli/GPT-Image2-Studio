import { isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";

function cleanString(value) {
  return String(value || "").trim();
}

const DEFAULT_SKU_BUNDLE_COUNT = 1;
const MAX_SKU_BUNDLE_COUNT = 20;
const SKU_BUNDLE_COUNT_WORDS = new Map([
  ["单", 1],
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);
const UNIT_COUNT_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);
const CHINESE_UNIT_COUNT_WORDS = new Map([
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function clampSkuBundleCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SKU_BUNDLE_COUNT;
  }
  return Math.min(MAX_SKU_BUNDLE_COUNT, Math.max(DEFAULT_SKU_BUNDLE_COUNT, Math.round(value)));
}

export function normalizeCreationSkuBundleCountForPayload(value, fallback = DEFAULT_SKU_BUNDLE_COUNT) {
  const fallbackCount = clampSkuBundleCount(Number.parseInt(cleanString(fallback), 10));
  const raw = cleanString(value);
  if (!raw) {
    return fallbackCount;
  }
  const digitMatch = raw.match(/\d+/);
  if (digitMatch) {
    return clampSkuBundleCount(Number.parseInt(digitMatch[0], 10));
  }
  if (raw.includes("十")) {
    const [left, right] = raw.split("十");
    const tens = SKU_BUNDLE_COUNT_WORDS.get(left) || 1;
    const ones = SKU_BUNDLE_COUNT_WORDS.get(right) || 0;
    return clampSkuBundleCount(tens * 10 + ones);
  }
  for (const [word, count] of SKU_BUNDLE_COUNT_WORDS) {
    if (raw.includes(word)) {
      return clampSkuBundleCount(count);
    }
  }
  return fallbackCount;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function normalizeIndexArray(value) {
  return Array.isArray(value)
    ? value.map((item) => Number.parseInt(cleanString(item), 10)).filter((item) => Number.isFinite(item) && item > 0)
    : [];
}

function normalizeSubjectUnitCount(value) {
  const count = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(count) && count > 1 ? Math.min(MAX_SKU_BUNDLE_COUNT, Math.round(count)) : 0;
}

function parseUnitCountToken(value) {
  const token = cleanString(value);
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return normalizeSubjectUnitCount(digitCount);
  }
  if (CHINESE_UNIT_COUNT_WORDS.has(token)) {
    return normalizeSubjectUnitCount(CHINESE_UNIT_COUNT_WORDS.get(token));
  }
  if (token.includes("十")) {
    const [left, right] = token.split("十");
    const tens = left ? CHINESE_UNIT_COUNT_WORDS.get(left) || 0 : 1;
    const ones = right ? CHINESE_UNIT_COUNT_WORDS.get(right) || 0 : 0;
    return normalizeSubjectUnitCount(tens * 10 + ones);
  }
  return 0;
}

function inferSubjectUnitCount(value = "") {
  const text = cleanString(value).toLowerCase();
  const digitMatch = text.match(/\b(\d+)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (digitMatch) {
    return normalizeSubjectUnitCount(digitMatch[1]);
  }
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (wordMatch) {
    return normalizeSubjectUnitCount(UNIT_COUNT_WORDS.get(wordMatch[1].toLowerCase()));
  }
  const chineseMatch = text.match(/([一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款|种|组|套)?\s*(?:完整|可见|完整可见|可售|不同|独立)?\s*(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵)/u);
  return chineseMatch ? parseUnitCountToken(chineseMatch[1]) : 0;
}

function buildReferenceRoleMap(referenceRoles = []) {
  const roleMap = new Map();
  if (!Array.isArray(referenceRoles)) {
    return roleMap;
  }

  referenceRoles.forEach((entry = {}) => {
    const filename = cleanString(entry.filename || entry.name).toLowerCase();
    const role = cleanString(entry.role || "product");
    if (filename) {
      roleMap.set(filename, role || "product");
    }
  });

  return roleMap;
}

function isSubjectBackedOnlyByNonProductReferences(subject = {}, roleMap = new Map()) {
  const matchedRoles = normalizeStringArray(subject.filenames)
    .map((filename) => roleMap.get(filename.toLowerCase()))
    .filter(Boolean);
  if (!roleMap.size || matchedRoles.length === 0) {
    return false;
  }
  return matchedRoles.length > 0 && matchedRoles.every((role) => !isCreationSubjectReferenceRole(role));
}

function isSubjectMissingCurrentReferences(subject = {}, roleMap = new Map()) {
  if (!roleMap.size) {
    return false;
  }
  return normalizeStringArray(subject.filenames).every((filename) => !roleMap.has(filename.toLowerCase()));
}

function getProductReferenceEntriesForSku(referenceRoles = []) {
  return (Array.isArray(referenceRoles) ? referenceRoles : [])
    .map((entry, index) => ({ ...entry, referenceIndex: index + 1 }))
    .filter((entry) => isCreationSubjectReferenceRole(entry.role) && cleanString(entry.filename));
}

function buildProductReferenceSkuSubjects(referenceRoles = []) {
  return getProductReferenceEntriesForSku(referenceRoles)
    .map((entry, index) => {
      const note = entry.note || "";
      const subjectUnitCount = normalizeSubjectUnitCount(entry.subjectUnitCount ?? entry.subject_unit_count) ||
        inferSubjectUnitCount([entry.filename, note].join(" "));
      return {
        id: entry.filename || `sku-${index + 1}`,
        title: entry.filename || `SKU ${index + 1}`,
        referenceIndexes: [entry.referenceIndex],
        filenames: [entry.filename].filter(Boolean),
        note,
        ...(subjectUnitCount ? { subjectUnitCount } : {}),
      };
    });
}

function getMatchingProductReferenceSubjects(subject = {}, productReferenceSubjects = []) {
  const filenames = new Set(
    normalizeStringArray(subject.filenames).map((filename) => filename.toLowerCase()),
  );
  if (filenames.size === 0) {
    return [];
  }

  return (Array.isArray(productReferenceSubjects) ? productReferenceSubjects : []).filter((entry) =>
    normalizeStringArray(entry.filenames).some((filename) => filenames.has(filename.toLowerCase())),
  );
}

function mergeSubjectNotes(baseNote = "", extraNotes = []) {
  const parts = [];
  const seen = new Set();
  const append = (value) => {
    const text = cleanString(value);
    if (!text) {
      return;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    parts.push(text);
  };

  append(baseNote);
  extraNotes.forEach(append);
  return parts.join(" | ");
}

function enrichSkuSubjectFromProductReferences(subject = {}, productReferenceSubjects = []) {
  const matchedSubjects = getMatchingProductReferenceSubjects(subject, productReferenceSubjects);
  if (matchedSubjects.length === 0) {
    return subject;
  }

  const referenceIndexes = uniqueNumbers([
    ...normalizeIndexArray(subject.referenceIndexes),
    ...matchedSubjects.flatMap((entry) => normalizeIndexArray(entry.referenceIndexes)),
  ]);
  const ownNote = cleanString(subject.note);
  const referenceNote = mergeSubjectNotes("", matchedSubjects.map((entry) => entry.note));
  const inferenceNote = mergeSubjectNotes(ownNote, referenceNote ? [referenceNote] : []);
  const note = !ownNote || (referenceNote && referenceNote.length > ownNote.length)
    ? mergeSubjectNotes(ownNote, referenceNote ? [referenceNote] : [])
    : ownNote;
  const subjectUnitCount = Math.max(
    normalizeSubjectUnitCount(subject.subjectUnitCount),
    ...matchedSubjects.map((entry) => normalizeSubjectUnitCount(entry.subjectUnitCount)),
    inferSubjectUnitCount([subject.title, inferenceNote].join(" ")),
  );

  return {
    ...subject,
    ...(referenceIndexes.length > 0 ? { referenceIndexes } : {}),
    ...(note ? { note } : {}),
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
  };
}

function hasSameSellableSubjectSignal(subject = {}) {
  const text = [
    subject.id,
    subject.title,
    subject.note,
    subject.description,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\b(same|single|one)\s+(?:sellable\s+)?(?:sku|subject|product|item)\b|\b(front|back|side|view|views|angle|angles|photo|photos)\b/.test(text);
}

function hasGroupedSubjectUnitCount(subject = {}) {
  return (
    normalizeSubjectUnitCount(subject.subjectUnitCount) ||
    inferSubjectUnitCount([subject.title, subject.note, subject.description].join(" "))
  ) > 1;
}

function shouldPreserveAppliedGroupedSubjects(subjects = []) {
  return (Array.isArray(subjects) ? subjects : []).some((subject) => hasGroupedSubjectUnitCount(subject));
}

function shouldSplitAmbiguousCoveredGroups(normalizedSubjects = [], productReferenceSubjects = []) {
  if (normalizedSubjects.length === 0 || productReferenceSubjects.length <= normalizedSubjects.length) {
    return false;
  }

  const productReferenceFilenames = new Set(
    productReferenceSubjects.flatMap((subject) =>
      normalizeStringArray(subject.filenames).map((filename) => filename.toLowerCase()),
    ),
  );
  const productReferenceIndexes = new Set(
    productReferenceSubjects.flatMap((subject) => normalizeIndexArray(subject.referenceIndexes)),
  );

  return normalizedSubjects.some((subject) => {
    if (hasGroupedSubjectUnitCount(subject)) {
      return false;
    }
    const productFilenames = normalizeStringArray(subject.filenames).filter((filename) =>
      productReferenceFilenames.has(filename.toLowerCase()),
    );
    const productIndexes = normalizeIndexArray(subject.referenceIndexes).filter((referenceIndex) =>
      productReferenceIndexes.has(referenceIndex),
    );
    return (productFilenames.length > 1 || productIndexes.length > 1) && !hasSameSellableSubjectSignal(subject);
  });
}

function buildSkuSubjectCoverage(subjects = []) {
  const filenames = new Set();
  const referenceIndexes = new Set();
  (Array.isArray(subjects) ? subjects : []).forEach((subject) => {
    normalizeStringArray(subject.filenames).forEach((filename) => filenames.add(filename.toLowerCase()));
    normalizeIndexArray(subject.referenceIndexes).forEach((referenceIndex) => referenceIndexes.add(referenceIndex));
  });
  return { filenames, referenceIndexes };
}

function isProductReferenceSubjectCovered(subject = {}, coverage = {}) {
  const filenames = coverage.filenames instanceof Set ? coverage.filenames : new Set();
  const referenceIndexes = coverage.referenceIndexes instanceof Set ? coverage.referenceIndexes : new Set();
  return (
    normalizeStringArray(subject.filenames).some((filename) => filenames.has(filename.toLowerCase())) ||
    normalizeIndexArray(subject.referenceIndexes).some((referenceIndex) => referenceIndexes.has(referenceIndex))
  );
}

function hydrateProductReferenceIndexes(normalizedSubjects = [], productReferenceSubjects = []) {
  if (normalizedSubjects.length === 0 || productReferenceSubjects.length === 0) {
    return normalizedSubjects;
  }

  const indexByFilename = new Map();
  productReferenceSubjects.forEach((subject) => {
    const referenceIndexes = normalizeIndexArray(subject.referenceIndexes);
    normalizeStringArray(subject.filenames).forEach((filename) => {
      indexByFilename.set(filename.toLowerCase(), referenceIndexes);
    });
  });

  return normalizedSubjects.map((subject) => {
    if (normalizeIndexArray(subject.referenceIndexes).length > 0) {
      return subject;
    }
    const referenceIndexes = uniqueNumbers(
      normalizeStringArray(subject.filenames).flatMap((filename) => indexByFilename.get(filename.toLowerCase()) || []),
    );
    return referenceIndexes.length > 0 ? { ...subject, referenceIndexes } : subject;
  });
}

function appendMissingProductReferenceSubjects(normalizedSubjects = [], productReferenceSubjects = []) {
  if (normalizedSubjects.length === 0) {
    return productReferenceSubjects.map((subject) => enrichSkuSubjectFromProductReferences(subject, productReferenceSubjects));
  }
  if (productReferenceSubjects.length === 0) {
    return normalizedSubjects;
  }
  if (shouldSplitAmbiguousCoveredGroups(normalizedSubjects, productReferenceSubjects)) {
    return productReferenceSubjects.map((subject) => enrichSkuSubjectFromProductReferences(subject, productReferenceSubjects));
  }

  const hydratedSubjects = hydrateProductReferenceIndexes(normalizedSubjects, productReferenceSubjects)
    .map((subject) => enrichSkuSubjectFromProductReferences(subject, productReferenceSubjects));
  if (shouldPreserveAppliedGroupedSubjects(hydratedSubjects)) {
    return hydratedSubjects;
  }
  const coverage = buildSkuSubjectCoverage(hydratedSubjects);
  const missingProductSubjects = productReferenceSubjects.filter((subject) => !isProductReferenceSubjectCovered(subject, coverage));

  return missingProductSubjects.length > 0
    ? [...hydratedSubjects, ...missingProductSubjects.map((subject) => enrichSkuSubjectFromProductReferences(subject, productReferenceSubjects))]
    : hydratedSubjects;
}

export function normalizeCreationSkuSubjectForPayload(entry = {}, index = 0) {
  const filenames = normalizeStringArray(entry.filenames);
  const referenceIndexes = normalizeIndexArray(entry.referenceIndexes || entry.reference_indexes);
  const id = cleanString(entry.id || entry.subjectId || entry.subject_id || filenames[0] || `sku-${index + 1}`);
  const title = cleanString(entry.title || entry.name || filenames[0] || id);
  const note = cleanString(entry.note || entry.description);
  const rawBundleCount = entry.bundleCount ?? entry.bundle_count ?? entry.quantity ?? entry.count ?? entry.skuBundleCount;
  const bundleCount = rawBundleCount === undefined || rawBundleCount === null || cleanString(rawBundleCount) === ""
    ? 0
    : normalizeCreationSkuBundleCountForPayload(rawBundleCount);
  const rawSubjectUnitCount =
    entry.subjectUnitCount ??
    entry.subject_unit_count ??
    entry.visibleUnitCount ??
    entry.visible_unit_count ??
    entry.unitCount ??
    entry.unit_count;
  const subjectUnitCount = normalizeSubjectUnitCount(rawSubjectUnitCount) || inferSubjectUnitCount([title, note].join(" "));

  return id && filenames.length > 0
    ? {
        id,
        title,
        referenceIndexes,
        filenames,
        note,
        ...(bundleCount ? { bundleCount } : {}),
        ...(subjectUnitCount ? { subjectUnitCount } : {}),
      }
    : null;
}

function uniqueNumbers(values = []) {
  const seen = new Set();
  return values
    .filter((value) => Number.isFinite(value) && value > 0)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

function mergeSameReferenceSubjects(subjects = [], roleMap = new Map()) {
  const groups = new Map();
  subjects.forEach((subject) => {
    const filenames = normalizeStringArray(subject.filenames);
    if (filenames.length !== 1 || !isCreationSubjectReferenceRole(roleMap.get(filenames[0].toLowerCase()))) {
      return;
    }
    const key = filenames[0].toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(subject);
  });

  const mergedKeys = new Set([...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key]) => key));
  if (mergedKeys.size === 0) {
    return subjects;
  }

  return subjects.flatMap((subject) => {
    const filename = normalizeStringArray(subject.filenames)[0];
    const key = cleanString(filename).toLowerCase();
    if (!mergedKeys.has(key)) {
      return [subject];
    }
    const group = groups.get(key);
    if (group[0] !== subject) {
      return [];
    }
    return [{
      id: filename,
      title: group.map((item) => cleanString(item.title)).filter(Boolean).join(" / ") || filename,
      referenceIndexes: uniqueNumbers(group.flatMap((item) => item.referenceIndexes || [])),
      filenames: [filename],
      note: group.map((item) => cleanString(item.note)).filter(Boolean).join(" | "),
      subjectUnitCount: Math.max(group.length, ...group.map((item) => Number(item.subjectUnitCount) || 0)),
    }];
  });
}

export function buildCreationSkuSubjectsForPayload({
  analysis = null,
  applied = false,
  dirty = false,
  referenceRoles = [],
} = {}) {
  const roleMap = buildReferenceRoleMap(referenceRoles);
  const productReferenceSubjects = buildProductReferenceSkuSubjects(referenceRoles);

  const appliedSubjects = analysis && applied ? analysis.skuSubjects || [] : [];
  const normalizedSubjects = appliedSubjects
    .map((entry, index) => normalizeCreationSkuSubjectForPayload(entry, index))
    .filter(Boolean)
    .filter((subject) => !(dirty && isSubjectMissingCurrentReferences(subject, roleMap)))
    .filter((subject) => !isSubjectBackedOnlyByNonProductReferences(subject, roleMap));
  const groupedSubjects = mergeSameReferenceSubjects(normalizedSubjects, roleMap);
  if (groupedSubjects.length > 0) {
    return appendMissingProductReferenceSubjects(groupedSubjects, productReferenceSubjects);
  }

  return productReferenceSubjects;
}
