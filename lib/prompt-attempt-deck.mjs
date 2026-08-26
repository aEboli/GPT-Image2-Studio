// Prompt mode used to hold a single previewUrl per job, so every partial image
// overwrote the last one and a failed job took its image down with it. A deck
// keeps one card per upstream attempt instead: new attempts append, and a failed
// attempt keeps whatever preview it had reached.
//
// Decks live outside state.jobs on purpose. removeJob() has to drop failed jobs
// from state.jobs because queue concurrency, cancellation and running-slot counts
// all read that array; keeping terminated jobs there would corrupt those.

export const MAX_TERMINAL_PROMPT_DECKS = 6;

export const PROMPT_ATTEMPT_STATUS = Object.freeze({
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
});

export const PROMPT_ATTEMPT_KIND = Object.freeze({
  PARTIAL: "partial",
  FINAL: "final",
});

export function createPromptAttemptDeckStore() {
  return new Map();
}

function normalizeKey(value) {
  return String(value || "").trim();
}

function createAttempt(attemptIndex, updatedAt) {
  return {
    attemptIndex,
    previewUrl: "",
    kind: PROMPT_ATTEMPT_KIND.PARTIAL,
    status: PROMPT_ATTEMPT_STATUS.RUNNING,
    errorMessage: "",
    savedFilename: "",
    updatedAt,
  };
}

function ensureDeck(store, deckKey, updatedAt) {
  const key = normalizeKey(deckKey);
  if (!key) {
    return null;
  }

  const existing = store.get(key);
  if (existing) {
    return existing;
  }

  const deck = {
    deckKey: key,
    attempts: [createAttempt(0, updatedAt)],
    terminal: false,
    updatedAt,
  };
  store.set(key, deck);
  return deck;
}

function getCurrentAttempt(deck) {
  return deck.attempts[deck.attempts.length - 1] || null;
}

// Terminal decks are the only ones that accumulate: running decks are bounded by
// the generation queue. Evict oldest-first so a long session cannot grow without
// limit -- partial previews are multi-MB base64 data URLs.
function evictTerminalDecks(store, limit = MAX_TERMINAL_PROMPT_DECKS) {
  const terminalDecks = [...store.values()].filter((deck) => deck.terminal);
  if (terminalDecks.length <= limit) {
    return;
  }

  terminalDecks
    .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))
    .slice(0, terminalDecks.length - limit)
    .forEach((deck) => store.delete(deck.deckKey));
}

export function recordPromptAttemptImage(store, { deckKey, previewUrl, kind = PROMPT_ATTEMPT_KIND.PARTIAL, updatedAt = "" } = {}) {
  const normalizedPreviewUrl = String(previewUrl || "");
  if (!normalizedPreviewUrl) {
    return null;
  }

  const deck = ensureDeck(store, deckKey, updatedAt);
  if (!deck) {
    return null;
  }

  const attempt = getCurrentAttempt(deck);
  // One card per attempt: a sharper partial for the same attempt replaces the
  // previous image rather than adding a card.
  attempt.previewUrl = normalizedPreviewUrl;
  attempt.kind = kind === PROMPT_ATTEMPT_KIND.FINAL ? PROMPT_ATTEMPT_KIND.FINAL : PROMPT_ATTEMPT_KIND.PARTIAL;
  attempt.status = PROMPT_ATTEMPT_STATUS.RUNNING;
  attempt.updatedAt = updatedAt;
  deck.updatedAt = updatedAt;
  return deck;
}

// Called on the upstream retrying_upstream status. The image already on screen
// belongs to the attempt being abandoned, so seal it before the new attempt's
// partials start arriving.
export function startPromptAttemptRetry(store, { deckKey, errorMessage = "", updatedAt = "" } = {}) {
  const key = normalizeKey(deckKey);
  const deck = store.get(key);
  if (!deck) {
    return null;
  }

  const attempt = getCurrentAttempt(deck);
  if (attempt && attempt.status === PROMPT_ATTEMPT_STATUS.RUNNING) {
    if (attempt.previewUrl) {
      attempt.status = PROMPT_ATTEMPT_STATUS.FAILED;
      attempt.errorMessage = String(errorMessage || "");
      attempt.updatedAt = updatedAt;
    } else {
      // Nothing was ever shown for this attempt; reuse the empty card.
      attempt.updatedAt = updatedAt;
      deck.updatedAt = updatedAt;
      return deck;
    }
  }

  deck.attempts.push(createAttempt(deck.attempts.length, updatedAt));
  deck.updatedAt = updatedAt;
  return deck;
}

export function completePromptAttemptDeck(store, { deckKey, previewUrl = "", updatedAt = "" } = {}) {
  const key = normalizeKey(deckKey);
  const deck = store.get(key);
  if (!deck) {
    return null;
  }

  const attempt = getCurrentAttempt(deck);
  if (attempt) {
    if (previewUrl) {
      attempt.previewUrl = String(previewUrl);
    }
    attempt.kind = PROMPT_ATTEMPT_KIND.FINAL;
    attempt.status = PROMPT_ATTEMPT_STATUS.COMPLETED;
    attempt.errorMessage = "";
    attempt.updatedAt = updatedAt;
  }
  deck.terminal = true;
  deck.updatedAt = updatedAt;
  evictTerminalDecks(store);
  return deck;
}

// A deck with no image at all is noise, not history: drop it so the filmstrip
// never shows an empty failed card.
export function failPromptAttemptDeck(store, { deckKey, errorMessage = "", updatedAt = "" } = {}) {
  const key = normalizeKey(deckKey);
  const deck = store.get(key);
  if (!deck) {
    return null;
  }

  const attempt = getCurrentAttempt(deck);
  if (attempt && attempt.status === PROMPT_ATTEMPT_STATUS.RUNNING) {
    attempt.status = PROMPT_ATTEMPT_STATUS.FAILED;
    attempt.errorMessage = String(errorMessage || "");
    attempt.updatedAt = updatedAt;
  }

  deck.attempts = deck.attempts.filter((entry) => entry.previewUrl);
  if (deck.attempts.length === 0) {
    store.delete(key);
    return null;
  }

  deck.terminal = true;
  deck.updatedAt = updatedAt;
  evictTerminalDecks(store);
  return deck;
}

// Saving re-keys the deck from job: to file: so the gallery thumbnail keeps the
// earlier failed attempts reachable after the job leaves state.jobs.
export function rekeyPromptAttemptDeck(store, { fromKey, toKey, updatedAt = "" } = {}) {
  const from = normalizeKey(fromKey);
  const to = normalizeKey(toKey);
  if (!from || !to || from === to) {
    return store.get(to) || null;
  }

  const deck = store.get(from);
  if (!deck) {
    return null;
  }

  store.delete(from);
  deck.deckKey = to;
  if (updatedAt) {
    deck.updatedAt = updatedAt;
  }
  store.set(to, deck);
  return deck;
}

export function markPromptAttemptSaved(store, { deckKey, attemptIndex, filename = "" } = {}) {
  const deck = store.get(normalizeKey(deckKey));
  if (!deck) {
    return null;
  }

  const attempt = deck.attempts.find((entry) => entry.attemptIndex === Number(attemptIndex));
  if (!attempt) {
    return null;
  }

  attempt.savedFilename = String(filename || "");
  return deck;
}

export function getPromptAttemptDeck(store, deckKey) {
  return store.get(normalizeKey(deckKey)) || null;
}

export function getPromptAttemptCards(store, deckKey) {
  const deck = store.get(normalizeKey(deckKey));
  if (!deck) {
    return [];
  }
  return deck.attempts.filter((attempt) => attempt.previewUrl);
}

export function removePromptAttemptDeck(store, deckKey) {
  return store.delete(normalizeKey(deckKey));
}

export function getTerminalPromptAttemptDecks(store) {
  return [...store.values()]
    .filter((deck) => deck.terminal && deck.attempts.some((attempt) => attempt.previewUrl))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}
