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
  const types = ["generic-hero", "comparison-proof", "detail-macro", "scene-application", "selling-point-stack", "multi-angle"];
  const tasks = [
    ["整体身份与购买理由", "完整商品展示", "商品整体", "product-photograph", "minimal"],
    ["主动加热的温暖收益", "加热作用可视化", "已确认加热功能", "functional-render", "minimal"],
    ["掌心纹理的可见做工", "近距离观察补片", "掌心灰色纹理", "macro-evidence", "none"],
    ["指尖操作的结构关系", "手指操作随身设备", "可露出指尖结构", "use-scene", "minimal"],
    ["不同已知特点的选择理由", "按证据整理购买信息", "功能与外观的关系", "information-layout", "structured"],
    ["参考支持的外观视角", "检查已知侧面轮廓", "商品可见外形", "product-photograph", "none"],
    ["显示窗和控制器位置", "定位手背控制器", "控制器与手背归属", "macro-evidence", "minimal"],
    ["腕口与袖口的覆盖关系", "整理穿戴袖口", "腕口缝线", "use-scene", "none"],
    ["宽度标注的适配依据", "核对横向宽度", "已知宽度", "information-layout", "structured"],
    ["续航值对应的使用条件", "对照使用条件与时长", "45°C使用6小时的限定", "information-layout", "structured"],
    ["一双手套的到手数量", "清点完整一双手套", "实际包装数量", "contents-layout", "minimal"],
    ["外部接缝的连续细节", "沿腕口观察缝线", "腕口外观证据", "macro-evidence", "none"],
    ["手掌与手背的部件区别", "翻看参考支持的外表面", "掌背部件归属", "product-photograph", "minimal"],
    ["指尖开口的位置", "特写观察指尖开口", "开口外形", "macro-evidence", "none"],
    ["高度标注的比例依据", "比对纵向高度", "已知高度", "information-layout", "structured"],
    ["露指结构与设备按键", "指尖点按设备按键", "操作接触关系", "use-scene", "minimal"],
    ["穿戴时的整体比例", "展示佩戴后的完整手部", "商品与手部比例", "use-scene", "none"],
    ["内置电池的信息来源", "展示已有电池资料条件", "已标注3000mAh资料", "information-layout", "structured"],
    ["收纳前的物品识别", "把已知一双手套并排整理", "一双商品的完整性", "contents-layout", "none"],
    ["下单前的已知信息核对", "汇总已确认内容与未知边界", "实物和资料的一致性", "information-layout", "structured"],
  ];
  const payload = {
    summary: "电商视觉营销专家整套规划", product_name: "加热手套", category_hint: "手套", category_path: "服饰 > 手套",
    reference_roles: [{ index: 1, filename: "gloves.png", role: "reference-product", roleLabel: "参考主体", note: "卡其色一双手套，作为主主体", dimension_groups: [] }], sku_subjects: [],
    audience_strategy: { target_audience: "冬季通勤与户外设备操作买家", purchase_motivations: ["确认日常使用的操作方式"], purchase_objections: ["担心结构与参考不一致"], desired_outcome: "清楚比较适合自己的使用方式", evidence_basis: ["指尖操作和腕口的可见资料"], confidence: "medium", source: "analysis-suggestion" },
    product_insights: insights, risks: [],
    suite_strategy: { core_buying_reason: "有依据的加热功能回应温暖需求", primary_fact_ids: ["heat"], functional_proofs: [{ fact_ids: ["heat", "battery", "runtime"], buyer_benefit: "主动加热带来温暖", visual_evidence: "完整手套外表周围使用半透明暖色热流示意，保留真实布料与结构，不作为热成像实测" }] },
    items: Array.from({ length: count }, (_, index) => ({
      item_id: `ai-${index + 1}`, image_type: types[index % types.length], title: `营销画面 ${index + 1}`,
      marketing_goal: tasks[index][0],
      audience_ids: [index % 2 ? "camera" : "commute"], selling_point_ids: ["finger-benefit"], pain_point_ids: ["operation"], recommendation_ids: ["show-detail"],
      fact_ids: ["appearance", "control", "fingers", ...((index === 1 || count === 1) ? ["heat", "battery", "runtime"] : [])], reference_indexes: [1],
      creative_brief: { purpose: tasks[index][0], scene: "与本商品真实用途相符的环境", action: tasks[index][1], framing: `${tasks[index][2]}的独立取景`, evidence_focus: tasks[index][2],
        visual_form: count === 1 ? "functional-render" : tasks[index][3], text_density: tasks[index][4], new_information: tasks[index][0],
        effect_visual: index === 1 || count === 1 ? "完整手套外表周围使用半透明暖色热流示意，保留真实布料与结构，不作为热成像实测" : "" },
      prompt: `生成第 ${index + 1} 个独立营销画面：保持参考主体卡其色手套、灰色掌心纹理和手背控制器。${tasks[index][1]}，${tasks[index][2]}的独立取景，主商品清晰可见。${index === 1 || count === 1 ? "完整手套外表周围使用半透明暖色热流示意，保留真实布料与结构，不作为热成像实测。" : ""}用自然柔光回应对应购买问题，按所选图型安排信息层级，画布文案用简体中文，保持实物结构与来源一致。`,
    })),
  };
  return { input, payload };
}
