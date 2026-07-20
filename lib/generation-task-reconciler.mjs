export function filterLocallyTerminatedGenerationTaskSnapshots(tasks, locallyTerminatedIds) {
  const source = Array.isArray(tasks) ? tasks : [];
  if (!(locallyTerminatedIds instanceof Set) || locallyTerminatedIds.size === 0) {
    return source;
  }

  return source.filter((task) => {
    const id = String(task?.id || "").trim();
    if (!id || !locallyTerminatedIds.has(id)) {
      return true;
    }
    if (task?.status === "completed" || task?.status === "error") {
      locallyTerminatedIds.delete(id);
      return true;
    }
    return false;
  });
}
