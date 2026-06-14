const ASPECT_RATIO_OPTIONS = [
  {
    value: "1:1",
    label: "电商主图、头像、社交媒体 · 方形 1:1",
    orientation: "square",
    baseSize: "1024x1024",
  },
  {
    value: "4:3",
    label: "PPT、网页配图 · 横屏 4:3",
    orientation: "landscape",
    baseSize: "1360x1024",
  },
  {
    value: "3:4",
    label: "海报、人像 · 竖屏 3:4",
    orientation: "portrait",
    baseSize: "1024x1360",
  },
  {
    value: "3:2",
    label: "摄影风格 · 横屏 3:2",
    orientation: "landscape",
    baseSize: "1536x1024",
  },
  {
    value: "2:3",
    label: "竖版摄影 · 竖屏 2:3",
    orientation: "portrait",
    baseSize: "1024x1536",
  },
  {
    value: "5:4",
    label: "商品展示 · 横屏 5:4",
    orientation: "landscape",
    baseSize: "1280x1024",
  },
  {
    value: "4:5",
    label: "Instagram帖子 · 竖屏 4:5",
    orientation: "portrait",
    baseSize: "1024x1280",
  },
  {
    value: "16:9",
    label: "横版封面、YouTube · 横屏 16:9",
    orientation: "landscape",
    baseSize: "1824x1024",
  },
  {
    value: "9:16",
    label: "短视频封面、手机壁纸 · 竖屏 9:16",
    orientation: "portrait",
    baseSize: "1024x1824",
  },
  {
    value: "21:9",
    label: "超宽横幅 · 横屏 21:9",
    orientation: "landscape",
    baseSize: "2384x1024",
  },
  {
    value: "9:21",
    label: "超长竖图 · 竖屏 9:21",
    orientation: "portrait",
    baseSize: "1024x2384",
  },
  {
    value: "2:1",
    label: "Banner横幅 · 横屏 2:1",
    orientation: "landscape",
    baseSize: "2048x1024",
  },
  {
    value: "1:2",
    label: "长海报 · 竖屏 1:2",
    orientation: "portrait",
    baseSize: "1024x2048",
  },
  {
    value: "3:1",
    label: "超宽广告图 · 横屏 3:1",
    orientation: "landscape",
    baseSize: "3072x1024",
  },
  {
    value: "1:3",
    label: "超长竖版广告 · 竖屏 1:3",
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
  return `${prompt}\n\n构图比例要求：${ratioOption.label}。请按该比例组织主体、商品、留白和背景空间。`;
}
