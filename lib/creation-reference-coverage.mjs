export const DEFAULT_CREATION_REFERENCE_COVERAGE_ROLE_TARGETS = {
  usage: ["usage-suggestion"],
  scene: ["scene", "atmosphere"],
  material: ["product-detail", "ingredient-material"],
  dimensions: ["size-capacity-fit", "spec-table"],
  package: ["accessory-gift"],
};

const REQUIRED_REFERENCE_COVERAGE_ROLES = new Set(["usage", "scene"]);
const REFERENCE_COVERAGE_REPLACEMENT_PRIORITY = [
  "multi-angle",
  "series-showcase",
  "brand-story",
  "after-sales",
  "craft-process",
  "effect-comparison",
  "atmosphere",
  "benefit",
  "product-detail",
  "size-capacity-fit",
  "spec-table",
  "ingredient-material",
  "accessory-gift",
  "scene",
  "usage-suggestion",
];

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeRoleIds(roles = [], supportedRoles = []) {
  const supported = new Set(supportedRoles.map(cleanString).filter(Boolean));
  const seen = new Set();
  return (Array.isArray(roles) ? roles : [])
    .map(cleanString)
    .filter((role) => role && (supported.size === 0 || supported.has(role)))
    .filter((role) => {
      if (seen.has(role)) {
        return false;
      }
      seen.add(role);
      return true;
    });
}

function getCoverageTargets(role = "", roleTargets = DEFAULT_CREATION_REFERENCE_COVERAGE_ROLE_TARGETS) {
  return roleTargets[cleanString(role)] || [];
}

function getCoverageSources(analysis = {}, roleTargets = DEFAULT_CREATION_REFERENCE_COVERAGE_ROLE_TARGETS) {
  return (Array.isArray(analysis?.recommendations) ? analysis.recommendations : [])
    .filter((entry) => getCoverageTargets(entry?.role, roleTargets).length > 0)
    .map((entry) => ({
      filename: cleanString(entry.filename),
      role: cleanString(entry.role),
      note: cleanString(entry.note),
    }))
    .filter((entry) => entry.filename);
}

function findReplacementIndex(roles = [], protectedRoles = new Set()) {
  for (const role of REFERENCE_COVERAGE_REPLACEMENT_PRIORITY) {
    const index = roles.findIndex((value) => value === role && !protectedRoles.has(value));
    if (index >= 0) {
      return index;
    }
  }
  for (let index = roles.length - 1; index >= 0; index -= 1) {
    if (roles[index] && !protectedRoles.has(roles[index])) {
      return index;
    }
  }
  return -1;
}

export function normalizeCreationCoverageFields(item = {}) {
  return {
    coverageSources: Array.isArray(item.coverageSources) ? item.coverageSources.map((source) => ({ filename: cleanString(source?.filename), role: cleanString(source?.role), roleLabel: cleanString(source?.roleLabel), rolePromptLabel: cleanString(source?.rolePromptLabel), note: cleanString(source?.note) })).filter((source) => source.filename) : [],
    coverageSummary: String(item.coverageSummary || ""),
    coverageWarnings: Array.isArray(item.coverageWarnings) ? item.coverageWarnings.map((warning) => String(warning)).filter(Boolean) : [],
  };
}

export function applyCreationReferenceCoverageRolePlan({
  roles = [],
  analysis = null,
  supportedRoles = [],
  roleTargets = DEFAULT_CREATION_REFERENCE_COVERAGE_ROLE_TARGETS,
} = {}) {
  const nextRoles = normalizeRoleIds(roles, supportedRoles);
  const supported = new Set(supportedRoles.map(cleanString).filter(Boolean));
  const coverageSources = getCoverageSources(analysis, roleTargets);
  const requiredSourceRoles = [
    ...new Set(coverageSources.map((source) => source.role).filter((role) => REQUIRED_REFERENCE_COVERAGE_ROLES.has(role))),
  ];
  const protectedRoles = new Set(["hero"]);

  requiredSourceRoles.forEach((sourceRole) => {
    const targets = getCoverageTargets(sourceRole, roleTargets);
    if (targets.some((role) => nextRoles.includes(role))) {
      return;
    }
    const preferredRole = targets.find((role) => supported.has(role) || supported.size === 0);
    if (!preferredRole || nextRoles.includes(preferredRole)) {
      return;
    }
    const replacementIndex = findReplacementIndex(nextRoles, protectedRoles);
    if (replacementIndex >= 0) {
      nextRoles[replacementIndex] = preferredRole;
    }
  });

  return normalizeRoleIds(nextRoles, supportedRoles);
}

export function buildCreationCoverageSummaryText(item = {}) {
  const summary = cleanString(item.coverageSummary);
  if (summary) {
    return summary;
  }

  const sources = Array.isArray(item.coverageSources) ? item.coverageSources : [];
  const sourceText = sources
    .map((source) => {
      const filename = cleanString(source?.filename);
      const role = cleanString(source?.rolePromptLabel || source?.roleLabel || source?.role);
      const note = cleanString(source?.note);
      return [filename, role, note].filter(Boolean).join(" - ");
    })
    .filter(Boolean);
  return sourceText.length > 0 ? `Reference coverage: ${sourceText.join("; ")}` : "";
}

export function appendCreationCoverageSummary(card, item = {}, { hideGenerationDetails = false, documentRef = globalThis.document } = {}) {
  if (!card || hideGenerationDetails) {
    return null;
  }

  const coverageSummaryText = buildCreationCoverageSummaryText(item);
  if (!coverageSummaryText || !documentRef?.createElement) {
    return null;
  }

  const coverage = Object.assign(documentRef.createElement("p"), { className: "creation-card-coverage", textContent: coverageSummaryText });
  card.appendChild(coverage);
  return coverage;
}

export function toggleCreationSelectedRoles(role, roles = [], supportedRoles = []) {
  const currentRoles = new Set(normalizeRoleIds(roles, supportedRoles));
  if (currentRoles.has(role)) {
    if (currentRoles.size <= 1) {
      return null;
    }
    currentRoles.delete(role);
  } else {
    currentRoles.add(role);
  }
  return normalizeRoleIds([...currentRoles], supportedRoles);
}
