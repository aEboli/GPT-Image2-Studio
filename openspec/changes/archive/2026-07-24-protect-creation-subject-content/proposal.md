## Why

普通套图把“输出语言”宽泛地应用到所有可见文字，导致模型同时翻译或重绘商品、包装等主体表面的既有图案和文字，破坏了商品身份与原包装语言。需要明确区分主体外新增营销文案与主体自身内容，并让规划、生成和修复都遵守同一边界。

## What Changes

- 输出语言只控制普通套图和 SKU 图中主体外新增的营销文案、标题、标注与说明。
- 商品或包装主体表面的图案、插画、符号、Logo、品牌标记、印刷或雕刻文字、字符、拼写、书写系统及原始语言必须按参考主体保留，不得翻译、本地化、音译、改写、纠错、重绘、替换、删除或遮挡。
- 当前计划与历史冻结计划在 Local、Worker 和修复生成时都获得相同的主体内容保护约束。
- `infographic-rebuild` 保持其专用 source-only 契约，仍按所选目标语言完整翻译可翻译的来源图文字。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`: 收紧普通套图与 SKU 图的目标语言作用域，并保护参考主体表面的既有视觉与语言内容。

## Impact

- Affected modules: `lib/creation-planner.mjs`, `lib/creation-generation-parameters.mjs`。
- Affected flows: 普通 Creation 计划、Local/Worker 生成、本地修复及历史冻结计划重试。
- Affected tests: Creation planner 与逐项运行时 prompt 回归测试。
- 不新增依赖，不修改 API 字段、持久化结构、界面控件或信息图重建行为。
