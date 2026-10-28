import { gloveAnalysisInput } from "./creation-glove-insights.mjs";

export function marketingPlanFixture(count = 20) {
  const input = gloveAnalysisInput({ imageCount: count, targetLanguage: "zh-CN" });
  const insights = input.productInsights;
  insights.audience_segments = [
    { id: "commute", name: "冬季骑行通勤者", context: "每天骑车通勤时操作随身设备", need: "清楚确认手套的操作结构", purchase_trigger: "准备冬季通勤装备", objection: "担心按键与手指动作受影响", priority: "primary", fact_ids: ["fingers", "control"] },
    { id: "camera", name: "户外摄影爱好者", context: "户外拍摄时调整设备", need: "看清指尖操作方式", purchase_trigger: "准备户外拍摄", objection: "担心操作不方便", priority: "secondary", fact_ids: ["fingers"] },
    { id: "daily", name: "日常户外活动者", context: "出门前检查穿戴与袖口", need: "核对手套覆盖和腕口细节", purchase_trigger: "购买日常户外装备", objection: "担心到手结构与图片不一致", priority: "secondary", fact_ids: ["appearance"] },
  ];
  insights.pain_points = [{ id: "operation", text: "穿戴后希望清楚知道设备操作方式", fact_ids: ["fingers"] }];
  insights.marketing_recommendations = [{ id: "show-detail", text: "用外观特写和真实操作展示商品结构，回应买家的使用顾虑", fact_ids: ["appearance", "fingers"] }];
  const types = ["generic-hero", "target-shopper-resonance", "detail-macro", "scene-application", "selling-point-stack", "multi-angle"];
  const payload = {
    summary: "电商视觉营销专家整套规划", product_name: "加热手套", category_hint: "手套", category_path: "服饰 > 手套",
    reference_roles: [{ index: 1, filename: "gloves.png", role: "reference-product", roleLabel: "参考主体", note: "卡其色一双手套，作为主主体", dimension_groups: [] }], sku_subjects: [],
    audience_strategy: { target_audience: "冬季通勤与户外设备操作买家", purchase_motivations: ["确认日常使用的操作方式"], purchase_objections: ["担心结构与参考不一致"], desired_outcome: "清楚比较适合自己的使用方式", evidence_basis: ["指尖操作和腕口的可见资料"], confidence: "medium", source: "analysis-suggestion" },
    product_insights: insights, risks: [],
    items: Array.from({ length: count }, (_, index) => ({
      item_id: `ai-${index + 1}`, image_type: types[index % types.length], title: `营销画面 ${index + 1}`,
      marketing_goal: `购买问题 ${index + 1}：用不同证据画面理解商品操作与细节`,
      audience_ids: [index % 2 ? "camera" : "commute"], selling_point_ids: ["finger-benefit"], pain_point_ids: ["operation"], recommendation_ids: ["show-detail"],
      fact_ids: ["appearance", "control", "fingers"], reference_indexes: [1],
      prompt: `生成第 ${index + 1} 个独立营销画面：保持参考主体卡其色手套、灰色掌心纹理和手背控制器，采用第 ${index + 1} 种斜侧取景距离，主商品清晰可见。用自然柔光和真实操作特写回应对应购买问题，按所选图型安排信息层级，画布文案用简体中文，保持实物结构与来源一致。`,
    })),
  };
  return { input, payload };
}
