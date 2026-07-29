## Why

当前 SKU 颜色规则允许在可见标签中加入部件限定词，生成结果会出现 `black strap`、`silver lenses` 等颜色之外的文字。SKU 颜色标签应只帮助买家识别颜色，不能混入部件、材质、款式、型号或商品名称。

## What Changes

- 参考图分析返回的 `sku_subjects[].color_names` 仅包含可靠的颜色名称；同一商品单位有多种颜色时仍保留为一个有序标签。
- 对模型响应、浏览器提交和历史记录中的颜色标签做纯颜色归一化，删除部件、材质、表面工艺、款式及其他非颜色文字。
- SKU 生图提示词明确禁止在颜色标签中渲染颜色以外的任何文字；无法可靠获得纯颜色名称时不显示标签且不猜测。
- 保持现有 SKU 分组、商品单位顺序、目标语言、API 字段和持久化结构不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`: 将 SKU 可见颜色标签从“颜色加可选部件限定词”收紧为“仅颜色名称”。

## Impact

- Affected modules: `lib/prompt-agent.mjs`, `lib/creation-planner.mjs`, `lib/creation-sku-subjects.mjs` 及浏览器镜像。
- Affected tests: 参考图分析契约、SKU 数据归一化和 Creation planner 提示词回归测试。
- 不新增依赖，不改变 API 字段、记录结构、界面控件、SKU 分组或图片数量。
