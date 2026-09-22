export const VERSION_BUMP_TYPES = Object.freeze(["major", "minor", "feature", "patch"]);

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d{1,3})$/u;

export function parseVersion(version) {
  const value = String(version || "").trim();
  const match = value.match(VERSION_PATTERN);
  if (!match) {
    throw new Error(`版本号必须符合 major.minor.patch 格式，且 patch 为一到三位数字：${value || "空值"}`);
  }

  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    throw new Error(`版本号超出安全整数范围：${value}`);
  }

  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

export function isCanonicalVersion(version) {
  try {
    return formatVersion(parseVersion(version)) === String(version || "").trim();
  } catch {
    return false;
  }
}

export function assertCanonicalVersion(version) {
  const value = String(version || "").trim();
  if (!isCanonicalVersion(value)) {
    throw new Error(`版本号必须使用三位 patch 格式（例如 0.2.019）：${value || "空值"}`);
  }
  return value;
}

export function formatVersion({ major, minor, patch }) {
  if (![major, minor, patch].every((part) => Number.isSafeInteger(part) && part >= 0)) {
    throw new Error("版本号各段必须是非负安全整数");
  }
  if (patch > 999) {
    throw new Error("版本号 patch 位不能超过 999，请先提升 feature、minor 或 major 位");
  }
  return `${major}.${minor}.${String(patch).padStart(3, "0")}`;
}

export function isVersion(version) {
  try {
    parseVersion(version);
    return true;
  } catch {
    return false;
  }
}

export function bumpVersion(version, type = "patch") {
  const current = parseVersion(version);
  if (!VERSION_BUMP_TYPES.includes(type)) {
    throw new Error(`不支持的版本升级类型：${type}；可选值为 ${VERSION_BUMP_TYPES.join(", ")}`);
  }

  if (type === "major") {
    return formatVersion({ major: current.major + 1, minor: 0, patch: 0 });
  }
  if (type === "minor") {
    return formatVersion({ major: current.major, minor: current.minor + 1, patch: 0 });
  }
  if (type === "feature") {
    return formatVersion({ major: current.major, minor: current.minor, patch: current.patch + 10 });
  }
  return formatVersion({ major: current.major, minor: current.minor, patch: current.patch + 1 });
}

export function getVersionBumpDescription(type) {
  const descriptions = {
    major: "大版本升级：主版本 +1，次版本和更新位归零",
    minor: "小版本升级：次版本 +1，更新位归零",
    feature: "小功能更新：更新位 +10",
    patch: "普通更新：更新位 +1",
  };
  return descriptions[type] || "版本更新";
}
