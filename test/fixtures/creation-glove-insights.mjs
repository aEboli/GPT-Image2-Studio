export function gloveAnalysisInput(overrides = {}) {
  const fact = (id, text, kind, reference_indexes = [1]) => ({ id, text, kind, source: "reference", reference_indexes });
  const scene = (id, title, environment, action, action_group, fact_ids = ["fingers"]) => ({
    id, title, environment, action, action_group, fact_ids, framing: "手部操作近景", people: "hands", pain_point_ids: [],
  });
  return {
    platform: "universal", imageCount: 18, productName: "加热手套", productDescription: "卡其色一双手套",
    dimensionSpecs: "宽度10cm，高度20cm", skuGenerationEnabled: false,
    referenceImageRoles: [{ index: 1, filename: "gloves.png", role: "reference-product", note: "卡其色主主体" }],
    productInsights: {
      appearance_locks: [{ text: "卡其色一双，掌心灰色纹理，手背控制器", reference_indexes: [1] }],
      confirmed_facts: [
        fact("appearance", "掌心灰色纹理补片，腕口缝线清晰", "appearance"),
        fact("control", "手背可见控制器显示窗和按键", "appearance"),
        fact("heat", "资料标注内置加热芯片", "function"),
        fact("battery", "资料标注3000mAh内置电池", "function"),
        fact("runtime", "资料标注45°C使用6小时", "function"),
        fact("fingers", "资料展示可露出指尖进行操作", "function"),
        fact("size", "宽度10cm，高度20cm", "spec"),
        fact("fit", "Universal Size", "spec"),
        fact("package", "包装内是一双手套", "package"),
      ],
      selling_points: [
        { id: "heat-benefit", text: "内置加热芯片和电池", fact_ids: ["heat", "battery"] },
        { id: "finger-benefit", text: "露出指尖操作", fact_ids: ["fingers"] },
        { id: "detail-benefit", text: "可见的掌心纹理与控制器", fact_ids: ["appearance", "control"] },
        { id: "size-benefit", text: "明确的宽高", fact_ids: ["size", "fit"] },
      ], pain_points: [],
      usage_scenarios: [
        scene("phone-1", "查看消息", "通勤路边", "戴手套操作手机查看消息", "phone-operation"),
        scene("phone-2", "手机拍摄", "户外拍摄点", "点按手机相机屏幕", "phone-operation"),
        scene("control-scene", "控制器检查", "出门准备区", "检查手背控制器", "control-inspection", ["control"]),
        scene("size-scene", "尺寸核对", "装备整理桌", "把手套平放核对尺寸", "size-check", ["size"]),
        scene("phone-3", "手机地图", "通勤途中", "手持手机查看地图", "phone-operation"),
        scene("sleeve-scene", "整理袖口", "室内门口", "整理手套与袖口覆盖关系", "cuff-fit", ["appearance"]),
      ], unknowns: [], conflicts: [],
    }, ...overrides,
  };
}
