const ASPECT_RATIO_OPTIONS = [
  {
    value: "1:1",
    orientation: "square",
    baseSize: "1024x1024",
  },
  {
    value: "4:3",
    orientation: "landscape",
    baseSize: "1360x1024",
  },
  {
    value: "3:4",
    orientation: "portrait",
    baseSize: "1024x1360",
  },
  {
    value: "3:2",
    orientation: "landscape",
    baseSize: "1536x1024",
  },
  {
    value: "2:3",
    orientation: "portrait",
    baseSize: "1024x1536",
  },
  {
    value: "5:4",
    orientation: "landscape",
    baseSize: "1280x1024",
  },
  {
    value: "4:5",
    orientation: "portrait",
    baseSize: "1024x1280",
  },
  {
    value: "16:9",
    orientation: "landscape",
    baseSize: "1824x1024",
  },
  {
    value: "9:16",
    orientation: "portrait",
    baseSize: "1024x1824",
  },
  {
    value: "21:9",
    orientation: "landscape",
    baseSize: "2384x1024",
  },
  {
    value: "9:21",
    orientation: "portrait",
    baseSize: "1024x2384",
  },
  {
    value: "2:1",
    orientation: "landscape",
    baseSize: "2048x1024",
  },
  {
    value: "1:2",
    orientation: "portrait",
    baseSize: "1024x2048",
  },
  {
    value: "3:1",
    orientation: "landscape",
    baseSize: "3072x1024",
  },
  {
    value: "1:3",
    orientation: "portrait",
    baseSize: "1024x3072",
  },
];

const DEFAULT_RATIO = "4:5";

export function getAspectRatioOptions() {
  return ASPECT_RATIO_OPTIONS.map((option) => ({ ...option }));
}

export function resolveAspectRatioOption(value = DEFAULT_RATIO) {
  return (
    ASPECT_RATIO_OPTIONS.find((option) => option.value === value) ||
    ASPECT_RATIO_OPTIONS.find((option) => option.value === DEFAULT_RATIO)
  );
}

export function appendRatioHintToPrompt(prompt, ratioOption) {
  const normalizedPrompt = String(prompt || "");
  const ratioHint = `Aspect ratio: ${ratioOption.value}.`;
  return normalizedPrompt.includes(ratioHint) ? normalizedPrompt : `${normalizedPrompt}\n\n${ratioHint}`;
}
