import { normalizePptOutline } from "./ppt-deck-workflow.mjs";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeSlideNumber(value) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getOutlinePageCount(outline) {
  return Array.isArray(outline?.slides) ? outline.slides.length : 0;
}

export function isPptSlideComplete(slide) {
  return Boolean(
    normalizeSlideNumber(slide?.slideNumber) &&
      cleanString(slide?.relativePath) &&
      (cleanString(slide?.imageUrl) || cleanString(slide?.thumbnailUrl)),
  );
}

export function normalizePptExistingSlide(slide) {
  const slideNumber = normalizeSlideNumber(slide?.slideNumber);
  const relativePath = cleanString(slide?.relativePath);
  if (!slideNumber || !relativePath) {
    return null;
  }

  return {
    slideNumber,
    title: cleanString(slide.title),
    filename: cleanString(slide.filename),
    relativePath,
    absolutePath: cleanString(slide.absolutePath),
    imageUrl: cleanString(slide.imageUrl) || `/output/${relativePath}`,
    thumbnailUrl: cleanString(slide.thumbnailUrl) || `/output/${relativePath}`,
    prompt: cleanString(slide.prompt),
  };
}

export function getPptCompletionStats({ outline, slides = [] } = {}) {
  const total = getOutlinePageCount(outline);
  const completedNumbers = new Set(
    slides.filter(isPptSlideComplete).map((slide) => normalizeSlideNumber(slide.slideNumber)),
  );

  return {
    completed: [...completedNumbers].filter((slideNumber) => slideNumber > 0 && slideNumber <= total).length,
    total,
  };
}

export function getMissingPptSlideNumbers({ outline, slides = [] } = {}) {
  const total = getOutlinePageCount(outline);
  const completedNumbers = new Set(
    slides.filter(isPptSlideComplete).map((slide) => normalizeSlideNumber(slide.slideNumber)),
  );
  const missing = [];

  for (let slideNumber = 1; slideNumber <= total; slideNumber += 1) {
    if (!completedNumbers.has(slideNumber)) {
      missing.push(slideNumber);
    }
  }

  return missing;
}

function normalizeRequestedSlideNumbers(slideNumbers, pageCount) {
  const result = [];
  for (const value of Array.isArray(slideNumbers) ? slideNumbers : []) {
    const slideNumber = normalizeSlideNumber(value);
    if (slideNumber >= 1 && slideNumber <= pageCount && !result.includes(slideNumber)) {
      result.push(slideNumber);
    }
  }
  return result.sort((left, right) => left - right);
}

export function mergePptSlides(existingSlides = [], generatedSlides = []) {
  const slidesByNumber = new Map();

  [...existingSlides, ...generatedSlides].forEach((slide) => {
    const normalized = normalizePptExistingSlide(slide);
    if (normalized) {
      slidesByNumber.set(normalized.slideNumber, {
        ...slide,
        ...normalized,
      });
    }
  });

  return [...slidesByNumber.values()].sort((left, right) => left.slideNumber - right.slideNumber);
}

export function normalizePptCompletionRequest({
  deckId = "",
  outline,
  existingSlides = [],
  slideNumbers = [],
  theme = "",
} = {}) {
  const pageCount = getOutlinePageCount(outline);
  const normalizedOutline = normalizePptOutline(outline, pageCount);
  const normalizedExistingSlides = existingSlides
    .map(normalizePptExistingSlide)
    .filter((slide) => slide && isPptSlideComplete(slide));
  const requestedSlideNumbers = normalizeRequestedSlideNumbers(slideNumbers, normalizedOutline.slides.length);

  return {
    deckId: cleanString(deckId),
    outline: normalizedOutline,
    existingSlides: normalizedExistingSlides,
    slideNumbers:
      requestedSlideNumbers.length > 0
        ? requestedSlideNumbers
        : getMissingPptSlideNumbers({ outline: normalizedOutline, slides: normalizedExistingSlides }),
    theme: cleanString(theme),
  };
}
