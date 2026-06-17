function sizeOption(scale, value) {
  const [width, height] = value.split("x");
  return { value, label: `${scale} ${width} x ${height}` };
}

const AUTO_SIZE_OPTION = { value: "auto", label: "自动适配" };

const SIZE_OPTIONS_BY_RATIO = {
  "1:1": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x1024"),
    sizeOption("1.5K", "1536x1536"),
    sizeOption("2K", "2048x2048"),
    sizeOption("2.5K", "2560x2560"),
    sizeOption("最大", "2880x2880"),
  ],
  "4:3": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1360x1024"),
    sizeOption("1.5K", "2048x1536"),
    sizeOption("2K", "2720x2048"),
    sizeOption("最大", "3312x2480"),
  ],
  "3:4": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x1360"),
    sizeOption("1.5K", "1536x2048"),
    sizeOption("2K", "2048x2720"),
    sizeOption("最大", "2480x3312"),
  ],
  "3:2": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1536x1024"),
    sizeOption("1.5K", "2304x1536"),
    sizeOption("2K", "3072x2048"),
    sizeOption("最大", "3520x2352"),
  ],
  "2:3": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x1536"),
    sizeOption("1.5K", "1536x2304"),
    sizeOption("2K", "2048x3072"),
    sizeOption("最大", "2352x3520"),
  ],
  "5:4": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1280x1024"),
    sizeOption("1.5K", "1920x1536"),
    sizeOption("2K", "2560x2048"),
    sizeOption("最大", "3200x2560"),
  ],
  "4:5": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x1280"),
    sizeOption("1.5K", "1536x1920"),
    sizeOption("2K", "2048x2560"),
    sizeOption("最大", "2560x3200"),
  ],
  "16:9": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1824x1024"),
    sizeOption("1.5K", "2736x1536"),
    sizeOption("2K", "3648x2048"),
    sizeOption("最大", "3840x2160"),
  ],
  "9:16": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x1824"),
    sizeOption("1.5K", "1536x2736"),
    sizeOption("2K", "2048x3648"),
    sizeOption("最大", "2160x3840"),
  ],
  "21:9": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "2384x1024"),
    sizeOption("720P", "1680x720"),
    sizeOption("1.5K", "3584x1536"),
    sizeOption("最大", "3840x1648"),
  ],
  "9:21": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x2384"),
    sizeOption("720P", "720x1680"),
    sizeOption("1.5K", "1536x3584"),
    sizeOption("最大", "1648x3840"),
  ],
  "2:1": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "2048x1024"),
    sizeOption("1.5K", "3072x1536"),
    sizeOption("最大", "3840x1920"),
  ],
  "1:2": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x2048"),
    sizeOption("1.5K", "1536x3072"),
    sizeOption("最大", "1920x3840"),
  ],
  "3:1": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "3072x1024"),
    sizeOption("最大", "3840x1280"),
  ],
  "1:3": [
    AUTO_SIZE_OPTION,
    sizeOption("1K", "1024x3072"),
    sizeOption("最大", "1280x3840"),
  ],
};

const DEFAULT_RATIO = "4:5";
const MODEL_PROTOCOL_IMAGE_SIZE_OPTIONS = [
  { value: "auto", label: "自动适配" },
  { value: "512", label: "512" },
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];
const MODEL_PROTOCOL_IMAGE_SIZE_VALUES = new Set(MODEL_PROTOCOL_IMAGE_SIZE_OPTIONS.map((option) => option.value));
const MODEL_PROTOCOL_IMAGE_SIZE_CASE_MAP = new Map(
  MODEL_PROTOCOL_IMAGE_SIZE_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]),
);
const DEFAULT_SIZE_BY_RATIO = Object.fromEntries(
  Object.entries(SIZE_OPTIONS_BY_RATIO).map(([ratio, options]) => [ratio, options[1].value]),
);

export function getGenerationSizeOptions(ratio = DEFAULT_RATIO) {
  return (SIZE_OPTIONS_BY_RATIO[ratio] || SIZE_OPTIONS_BY_RATIO[DEFAULT_RATIO]).map((option) => ({ ...option }));
}

export function getModelProtocolImageSizeOptions() {
  return MODEL_PROTOCOL_IMAGE_SIZE_OPTIONS.map((option) => ({ ...option }));
}

export function getDefaultGenerationSize(ratio = DEFAULT_RATIO) {
  return DEFAULT_SIZE_BY_RATIO[ratio] || DEFAULT_SIZE_BY_RATIO[DEFAULT_RATIO];
}

export function getDefaultModelProtocolImageSize() {
  return "1K";
}

export function isGenerationSizeCompatible(ratio = DEFAULT_RATIO, size = "auto") {
  const normalized = String(size || "auto").trim().toLowerCase();
  return getGenerationSizeOptions(ratio).some((option) => option.value === normalized);
}

export function normalizeGenerationSize(ratio = DEFAULT_RATIO, size = "auto") {
  const normalized = String(size || "auto").trim().toLowerCase();
  return isGenerationSizeCompatible(ratio, normalized) ? normalized : "auto";
}

export function isModelProtocolImageSizeCompatible(size = "auto") {
  const normalized = String(size || "auto").trim();
  return MODEL_PROTOCOL_IMAGE_SIZE_VALUES.has(normalized) || MODEL_PROTOCOL_IMAGE_SIZE_CASE_MAP.has(normalized.toLowerCase());
}

export function normalizeModelProtocolImageSize(size = "auto") {
  const normalized = String(size || "auto").trim();
  return MODEL_PROTOCOL_IMAGE_SIZE_CASE_MAP.get(normalized.toLowerCase()) || "auto";
}
