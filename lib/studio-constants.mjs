export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_REASONING_EFFORT = "xhigh";
export const MAX_PARALLEL_TASKS_PER_SESSION = 15;
export const MAX_PROMPT_PARALLEL_TASKS = 10;
export const MAX_CREATION_PARALLEL_TASKS = 20;
export const CREATION_STATUS_HEARTBEAT_MS = 15_000;
export const CREATION_UPSTREAM_TIMEOUT_MS = 1_200_000;
export const MAX_PROMPT_QUEUE_SIZE = 15;
// Interval between two task submissions inside one bounded-concurrency fan-out.
// Zero submits as fast as the concurrency limit allows; larger values spread the
// burst so a rate-limited upstream is not hit by the whole wave at once.
export const DEFAULT_GENERATION_START_DELAY_MS = 800;
export const MIN_GENERATION_START_DELAY_MS = 0;
export const MAX_GENERATION_START_DELAY_MS = 10_000;
// How many generation requests one bounded-concurrency fan-out keeps in flight.
// The default matches each path's own historical limit, so leaving it alone
// changes nothing. A value above a path's default genuinely raises it: the
// session task slot limiter accepts a per-request override, so the extra
// workers get slots instead of spinning in the wait loop.
export const DEFAULT_GENERATION_CONCURRENCY = 20;
export const MIN_GENERATION_CONCURRENCY = 1;
export const MAX_GENERATION_CONCURRENCY = 60;
export const MAX_REFERENCE_IMAGES = 15;
export const MAX_CREATION_REFERENCE_IMAGES = 15;
export const MAX_PORTRAIT_PERSON_REFERENCE_IMAGES = 3;
export const MAX_PORTRAIT_ACTION_REFERENCE_IMAGES = 3;
export const MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES = 9;
export const REASONING_EFFORT_OPTIONS = ["low", "medium", "high", "xhigh"];
