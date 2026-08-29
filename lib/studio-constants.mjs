export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_REASONING_EFFORT = "xhigh";
export const MAX_PARALLEL_TASKS_PER_SESSION = 15;
export const MAX_PROMPT_PARALLEL_TASKS = 10;
export const MAX_CREATION_PARALLEL_TASKS = 20;
export const CREATION_STATUS_HEARTBEAT_MS = 15_000;
export const CREATION_UPSTREAM_TIMEOUT_MS = 1_200_000;
export const MAX_PROMPT_QUEUE_SIZE = 15;
// Interval between two task submissions, enforced by a gate shared per client
// session and request scope. The floor is deliberately NOT zero: turning the
// throttle off lets the whole concurrency window hit the upstream in one burst,
// which is the failure mode this control exists to prevent.
export const DEFAULT_GENERATION_START_DELAY_MS = 1_000;
export const MIN_GENERATION_START_DELAY_MS = 200;
export const MAX_GENERATION_START_DELAY_MS = 5_000;
// How many generation requests one bounded-concurrency fan-out keeps in flight.
// This bounds the RATE, never the total: see MAX_ITEM_UPSTREAM_ATTEMPTS for the
// only ceiling on total upstream calls.
export const DEFAULT_GENERATION_CONCURRENCY = 20;
export const MIN_GENERATION_CONCURRENCY = 1;
export const MAX_GENERATION_CONCURRENCY = 50;
// Hard ceiling on upstream generation attempts per item for one run: the original
// attempt plus at most one retry. Counted across the generate pass AND the
// auto-repair pass, so a repair cannot hand an exhausted item a fresh allowance.
// Deliberately not configurable — configurable would mean it can be set back to
// effectively unbounded, and it is the only thing bounding total upstream volume.
export const MAX_ITEM_UPSTREAM_ATTEMPTS = 2;
export const MAX_REFERENCE_IMAGES = 15;
export const MAX_CREATION_REFERENCE_IMAGES = 15;
export const MAX_PORTRAIT_PERSON_REFERENCE_IMAGES = 3;
export const MAX_PORTRAIT_ACTION_REFERENCE_IMAGES = 3;
export const MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES = 9;
export const REASONING_EFFORT_OPTIONS = ["low", "medium", "high", "xhigh"];
