function snapshotKey(snapshot = {}) {
  return JSON.stringify({ platform: String(snapshot.platform || "universal"), category: String(snapshot.category || "general") });
}

export function createCreationReferenceAnalysisGuard(initialSnapshot = {}) {
  let version = 0;
  let currentSnapshot = snapshotKey(initialSnapshot);
  return {
    begin(snapshot = initialSnapshot) {
      version += 1;
      currentSnapshot = snapshotKey(snapshot);
      return { version, snapshot: currentSnapshot };
    },
    invalidate(snapshot = initialSnapshot) {
      version += 1;
      currentSnapshot = snapshotKey(snapshot);
      return version;
    },
    isCurrent(request) {
      return Boolean(request) && request.version === version && request.snapshot === currentSnapshot;
    },
  };
}
