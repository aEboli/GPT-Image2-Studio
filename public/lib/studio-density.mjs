const ALL_VARIABLE_NAMES = [
  "--ui-root-font-size",
  "--app-shell-max-width",
  "--app-shell-padding-top",
  "--app-shell-padding-bottom",
  "--topbar-gap",
  "--topbar-padding",
  "--view-root-offset",
  "--brand-mark-size",
  "--view-tab-min-width",
  "--view-tab-height",
  "--header-control-height",
  "--header-control-padding-x",
  "--studio-grid-left",
  "--studio-grid-right",
  "--studio-grid-gap",
  "--panel-padding",
  "--field-gap",
  "--input-padding-y",
  "--input-padding-x",
  "--textarea-min-height",
  "--ratio-chip-height",
  "--reference-dropzone-min-height",
  "--generate-button-height",
  "--preview-stage-padding",
  "--preview-canvas-padding",
  "--timeline-item-padding-y",
  "--recent-item-padding",
  "--recent-thumb-size",
];

const UI_GLOBAL_SCALE = 0.87984;

const REGULAR_VARIABLES = {
  "--ui-root-font-size": "16px",
  "--app-shell-max-width": "1680px",
  "--app-shell-padding-top": "8px",
  "--app-shell-padding-bottom": "10px",
  "--topbar-gap": "18px",
  "--topbar-padding": "6px 10px 14px",
  "--view-root-offset": "12px",
  "--brand-mark-size": "40px",
  "--view-tab-min-width": "116px",
  "--view-tab-height": "40px",
  "--header-control-height": "38px",
  "--header-control-padding-x": "16px",
  "--studio-grid-left": "392px",
  "--studio-grid-right": "328px",
  "--studio-grid-gap": "14px",
  "--panel-padding": "12px",
  "--field-gap": "6px",
  "--input-padding-y": "10px",
  "--input-padding-x": "12px",
  "--textarea-min-height": "96px",
  "--ratio-chip-height": "48px",
  "--reference-dropzone-min-height": "140px",
  "--generate-button-height": "42px",
  "--preview-stage-padding": "10px",
  "--preview-canvas-padding": "12px",
  "--timeline-item-padding-y": "8px",
  "--recent-item-padding": "8px",
  "--recent-thumb-size": "60px",
};

const COMPACT_VARIABLES = {
  "--ui-root-font-size": "15px",
  "--app-shell-max-width": "1600px",
  "--app-shell-padding-top": "6px",
  "--app-shell-padding-bottom": "8px",
  "--topbar-gap": "14px",
  "--topbar-padding": "4px 8px 10px",
  "--view-root-offset": "10px",
  "--brand-mark-size": "36px",
  "--view-tab-min-width": "104px",
  "--view-tab-height": "36px",
  "--header-control-height": "34px",
  "--header-control-padding-x": "14px",
  "--studio-grid-left": "360px",
  "--studio-grid-right": "300px",
  "--studio-grid-gap": "12px",
  "--panel-padding": "10px",
  "--field-gap": "5px",
  "--input-padding-y": "9px",
  "--input-padding-x": "11px",
  "--textarea-min-height": "88px",
  "--ratio-chip-height": "44px",
  "--reference-dropzone-min-height": "120px",
  "--generate-button-height": "38px",
  "--preview-stage-padding": "8px",
  "--preview-canvas-padding": "10px",
  "--timeline-item-padding-y": "6px",
  "--recent-item-padding": "6px",
  "--recent-thumb-size": "54px",
};

const WIDE_VARIABLES = {
  "--ui-root-font-size": "16px",
  "--app-shell-max-width": "2200px",
  "--app-shell-padding-top": "8px",
  "--app-shell-padding-bottom": "10px",
  "--topbar-gap": "20px",
  "--topbar-padding": "6px 12px 14px",
  "--view-root-offset": "12px",
  "--brand-mark-size": "40px",
  "--view-tab-min-width": "120px",
  "--view-tab-height": "40px",
  "--header-control-height": "38px",
  "--header-control-padding-x": "16px",
  "--studio-grid-left": "392px",
  "--studio-grid-right": "328px",
  "--studio-grid-gap": "16px",
  "--panel-padding": "12px",
  "--field-gap": "6px",
  "--input-padding-y": "10px",
  "--input-padding-x": "12px",
  "--textarea-min-height": "100px",
  "--ratio-chip-height": "48px",
  "--reference-dropzone-min-height": "140px",
  "--generate-button-height": "42px",
  "--preview-stage-padding": "10px",
  "--preview-canvas-padding": "14px",
  "--timeline-item-padding-y": "8px",
  "--recent-item-padding": "8px",
  "--recent-thumb-size": "58px",
};

function isCompactDesktopViewport({ width = 0, height = 0 } = {}) {
  if (width < 1280 || height <= 0) {
    return false;
  }

  const aspectRatio = width / height;
  const isSixteenByTenLaptopClass = width >= 1600 && aspectRatio >= 1.55 && aspectRatio <= 1.7;
  const isShortDesktop = height <= 1100;

  return isSixteenByTenLaptopClass || isShortDesktop;
}

function isWideDesktopViewport({ width = 0, height = 0 } = {}) {
  if (width < 1800 || height <= 0) {
    return false;
  }

  const aspectRatio = width / height;
  const isUltraWideShortDesktop = aspectRatio >= 1.8 && height <= 1440;
  const isQhdWideDesktop = width >= 2200 && height <= 1400;

  return isUltraWideShortDesktop || isQhdWideDesktop;
}

function normalizeDensityViewport({ width = 0, height = 0, devicePixelRatio = 1 } = {}) {
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function normalizePositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function resolvePhysicalTouchScale({
  width = 0,
  height = 0,
  devicePixelRatio = 1,
  coarsePointer = false,
} = {}) {
  const viewportWidth = normalizePositiveNumber(width);
  const viewportHeight = normalizePositiveNumber(height);

  if (!viewportWidth || !viewportHeight) {
    return 0;
  }

  const shorterSide = Math.min(viewportWidth, viewportHeight);
  const longerSide = Math.max(viewportWidth, viewportHeight);
  const aspectRatio = longerSide / shorterSide;
  const explicitScale = normalizePositiveNumber(devicePixelRatio);

  const isPhonePhysicalSize =
    coarsePointer &&
    aspectRatio >= 1.65 &&
    shorterSide >= 720 &&
    shorterSide <= 1600 &&
    longerSide >= 1300 &&
    longerSide <= 3600;
  if (isPhonePhysicalSize) {
    return explicitScale >= 1.5 ? explicitScale : shorterSide >= 1080 ? 3 : 2;
  }

  const isTabletPhysicalSize =
    coarsePointer &&
    aspectRatio >= 1.2 &&
    aspectRatio < 1.65 &&
    shorterSide >= 1200 &&
    shorterSide <= 2200 &&
    longerSide >= 1600 &&
    longerSide <= 3000;
  if (isTabletPhysicalSize) {
    return explicitScale >= 1.5 ? explicitScale : 2;
  }

  return 0;
}

function resolvePhysicalTouchLayoutWidth(viewport = {}) {
  const scale = resolvePhysicalTouchScale(viewport);
  const viewportWidth = normalizePositiveNumber(viewport.width);

  if (!scale || !viewportWidth) {
    return 0;
  }

  const cssWidth = Math.round(viewportWidth / scale);
  return cssWidth >= 320 && cssWidth <= 1480 ? cssWidth : 0;
}

function resolveLayoutViewportWidth(viewport = {}) {
  const { width = 0, outerWidth = 0, devicePixelRatio = 1 } = viewport;
  const physicalTouchWidth = resolvePhysicalTouchLayoutWidth(viewport);
  if (physicalTouchWidth) {
    return physicalTouchWidth;
  }

  if (Number.isFinite(width) && width > 0 && width <= 1024) {
    return width;
  }

  if (Number.isFinite(outerWidth) && outerWidth > width) {
    return outerWidth;
  }

  if (Number.isFinite(outerWidth) && outerWidth > 0 && Number.isFinite(devicePixelRatio) && devicePixelRatio < 1) {
    return outerWidth;
  }

  return width;
}

function resolveZoomOutCompensation(viewport = {}) {
  const { width = 0, visualScale = 1 } = viewport;
  const layoutWidth = resolveLayoutViewportWidth(viewport);
  if (width <= 0 || layoutWidth <= 0) {
    return 1;
  }

  const ratioCompensation = width / layoutWidth;

  if (Number.isFinite(visualScale) && visualScale > 0 && visualScale < 0.98) {
    const scaleCompensation = 1 / visualScale;
    const blended = ratioCompensation * 0.4 + scaleCompensation * 0.6;
    return Math.max(1, Math.min(2.4, Math.round(blended * 100) / 100));
  }

  return Math.max(1, Math.min(2.4, Math.round(ratioCompensation * 100) / 100));
}

function formatScaledPixelValue(value) {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function scalePixelValueString(value, factor) {
  if (factor === 1) {
    return value;
  }

  return String(value).replace(/(-?\d*\.?\d+)px/g, (_match, numericPart) => {
    const numericValue = Number(numericPart);
    return `${formatScaledPixelValue(numericValue * factor)}px`;
  });
}

function scalePixelVariables(variables, factor) {
  if (factor === 1) {
    return { ...variables };
  }

  return Object.fromEntries(
    Object.entries(variables).map(([name, value]) => [name, scalePixelValueString(value, factor)]),
  );
}

export function getStudioLayoutMode(viewport = {}) {
  const layoutWidth = resolveLayoutViewportWidth(viewport);

  if (layoutWidth <= 640) {
    return "mobile";
  }

  if (layoutWidth <= 1024) {
    return "tablet";
  }

  if (layoutWidth <= 1260) {
    return "stacked";
  }

  if (layoutWidth <= 1480) {
    return "narrow-desktop";
  }

  return "desktop";
}

export function getStudioDensitySettings(viewport) {
  const normalizedViewport = normalizeDensityViewport(viewport);
  const mode = isWideDesktopViewport(normalizedViewport)
    ? "wide"
    : isCompactDesktopViewport(normalizedViewport)
      ? "compact"
      : "regular";
  const visualScale = Number.isFinite(viewport?.visualScale) && viewport.visualScale > 0
    ? viewport.visualScale
    : 1;
  const zoomOutCompensation = resolveZoomOutCompensation({ ...viewport, visualScale });

  const variables =
    mode === "compact"
      ? COMPACT_VARIABLES
      : mode === "wide"
        ? WIDE_VARIABLES
        : REGULAR_VARIABLES;

  return {
    layoutMode: getStudioLayoutMode(viewport),
    mode,
    variables: scalePixelVariables(variables, zoomOutCompensation * UI_GLOBAL_SCALE),
    zoomOutCompensation,
  };
}

export { ALL_VARIABLE_NAMES };
