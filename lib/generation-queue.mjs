const DEFAULT_GENERATION_JOB_MODE = "prompt";

export function isQueuedGenerationJob(job) {
  return Boolean(job && !job.started && !job.isRunning);
}

function normalizeGenerationJobMode(value) {
  const mode = String(value || "").trim();
  return mode || DEFAULT_GENERATION_JOB_MODE;
}

function normalizeGenerationJobRoute(value) {
  const route = String(value || "").trim().toLowerCase();
  if (route === "a" || route === "b" || route === "c") {
    return route;
  }
  return "";
}

export function getGenerationJobMode(job) {
  return normalizeGenerationJobMode(job?.mode || job?.generationMode);
}

export function getGenerationJobQueueKey(job) {
  const mode = getGenerationJobMode(job);
  const route = normalizeGenerationJobRoute(job?.imageRoute || job?.generationRoute);
  return route ? `${mode}:${route}` : mode;
}

export function getQueuedGenerationJobCount(jobs, mode, route) {
  const jobList = Array.isArray(jobs) ? jobs : [];
  if (mode === undefined) {
    return jobList.filter(isQueuedGenerationJob).length;
  }

  const queueMode = normalizeGenerationJobMode(mode);
  const queueRoute = normalizeGenerationJobRoute(route);
  return jobList.filter((job) => {
    if (!isQueuedGenerationJob(job) || getGenerationJobMode(job) !== queueMode) {
      return false;
    }
    return !queueRoute || normalizeGenerationJobRoute(job?.imageRoute || job?.generationRoute) === queueRoute;
  }).length;
}

export function getRunningGenerationJobCount(jobs, mode, route) {
  const jobList = Array.isArray(jobs) ? jobs : [];
  if (mode === undefined) {
    return jobList.filter((job) => job?.isRunning).length;
  }

  const queueMode = normalizeGenerationJobMode(mode);
  const queueRoute = normalizeGenerationJobRoute(route);
  return jobList.filter((job) => {
    if (!job?.isRunning || getGenerationJobMode(job) !== queueMode) {
      return false;
    }
    return !queueRoute || normalizeGenerationJobRoute(job?.imageRoute || job?.generationRoute) === queueRoute;
  }).length;
}

export function cancelQueuedGenerationJob(jobs, jobId) {
  const id = String(jobId || "").trim();
  const jobList = Array.isArray(jobs) ? jobs : [];
  const target = jobList.find((job) => String(job?.id || "") === id);

  if (!target || !isQueuedGenerationJob(target)) {
    return {
      jobs: jobList,
      canceledJob: null,
    };
  }

  return {
    jobs: jobList.filter((job) => String(job?.id || "") !== id),
    canceledJob: target,
  };
}

export function selectNextQueuedGenerationJobs(jobs, availableSlots) {
  const slotCount = Math.max(0, Math.floor(Number(availableSlots) || 0));
  if (slotCount === 0) {
    return [];
  }

  const queuedJobs = (Array.isArray(jobs) ? jobs : []).filter(isQueuedGenerationJob);
  return queuedJobs.slice(Math.max(0, queuedJobs.length - slotCount)).reverse();
}

export function selectNextQueuedGenerationJobsByMode(jobs, maxParallelPerMode) {
  const slotCount = Math.max(0, Math.floor(Number(maxParallelPerMode) || 0));
  if (slotCount === 0) {
    return [];
  }

  const jobList = Array.isArray(jobs) ? jobs : [];
  const runningCountsByMode = new Map();
  jobList.forEach((job) => {
    if (!job?.isRunning) {
      return;
    }

    const key = getGenerationJobQueueKey(job);
    runningCountsByMode.set(key, (runningCountsByMode.get(key) || 0) + 1);
  });

  const selectedCountsByMode = new Map();
  const selectedJobs = [];
  const queuedJobsOldestFirst = jobList.filter(isQueuedGenerationJob).reverse();
  queuedJobsOldestFirst.forEach((job) => {
    const key = getGenerationJobQueueKey(job);
    const runningCount = runningCountsByMode.get(key) || 0;
    const selectedCount = selectedCountsByMode.get(key) || 0;
    if (runningCount + selectedCount >= slotCount) {
      return;
    }

    selectedJobs.push(job);
    selectedCountsByMode.set(key, selectedCount + 1);
  });

  return selectedJobs;
}
