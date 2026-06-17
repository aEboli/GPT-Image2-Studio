export const PPT_STYLE_PRESETS = [
  { value: "business", label: "商务汇报", description: "克制高级，清晰数据表达，适合会议投屏" },
  { value: "education", label: "教育培训", description: "层级清楚，重点醒目，适合课程讲解" },
  { value: "product", label: "产品发布", description: "科技感，强主视觉，适合新品发布会" },
  { value: "marketing", label: "营销提案", description: "视觉冲击强，强调卖点与行动号召" },
  { value: "tech", label: "科技发布", description: "深色科技界面，霓虹线条，适合 AI 和软件产品" },
  { value: "finance", label: "金融数据", description: "稳重专业，图表清晰，适合经营分析和投融资" },
  { value: "startup", label: "创业路演", description: "现代简洁，叙事强，适合 pitch deck" },
  { value: "academic", label: "学术研究", description: "严谨留白，结构清晰，适合课题和论文汇报" },
  { value: "medical", label: "医疗健康", description: "清洁可信，蓝绿辅助色，适合健康与医学主题" },
  { value: "minimal", label: "极简留白", description: "大面积留白，少量重点信息，高级简约" },
  { value: "bold", label: "大胆海报", description: "大标题，高对比色块，适合创意提案" },
  { value: "chinese", label: "东方雅致", description: "现代中式，克制纹理，适合文化与品牌叙事" },
  { value: "luxury", label: "高端品牌", description: "深色质感，金属点缀，适合品牌发布和奢华产品" },
  { value: "sales", label: "销售战报", description: "结果导向，数字突出，适合业绩和增长展示" },
];

export function normalizePptStylePreset(value) {
  const normalized = String(value || "").trim();
  return PPT_STYLE_PRESETS.find((preset) => preset.value === normalized) || PPT_STYLE_PRESETS[0];
}

export function getPptStyleDescription(value) {
  const preset = normalizePptStylePreset(value);
  return `${preset.label}，${preset.description}`;
}
