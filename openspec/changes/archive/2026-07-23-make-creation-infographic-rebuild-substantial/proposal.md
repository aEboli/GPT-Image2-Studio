## Why

套图模式的信息图重构已经做到每项只输入对应原图一张，但当前提示词同时锁死布局、层级、颜色、背景和相对位置，导致输出只是近似复刻或轻微润色，不符合“重构”的实际含义。现在需要在继续阻断其他套图信息影响的前提下，让模型明显重做信息架构和视觉表达。

## What Changes

- 保持每个 `infographic-rebuild` 请求只附加对应原始信息图一张，不附加主体图、其他信息图、Logo 或套图上下文。
- 将 canonical prompt 从“保留所有视觉属性不变”改为“保留可验证内容事实，但明显重做版式、信息层级、构图、背景和视觉组件”。
- 明确禁止仅做清晰化、微调间距、轻微换色或近似复刻；结果必须在第一眼即可看出是重新设计的版本。
- 保留原图中的商品身份、完整可读文字及其语言、数字、单位、参数、步骤、清单、声明和逻辑关系，不得翻译、改写、遗漏、增加或臆造。
- 保持冻结的模型、比例、尺寸、质量、格式和推理参数传递方式不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-infographic-rebuild`: 将信息图重构从视觉近似复刻改为内容事实保真且视觉结构显著变化的单图重设计。

## Impact

- Affected prompt module: `lib/creation-generation-parameters.mjs`。
- Affected tests: Creation planner、runtime generation、Local/Worker/repair 端到端提示词断言。
- Affected specification: `openspec/specs/creation-infographic-rebuild/spec.md`。
- 不新增依赖，不修改接口字段、参考图筛选、持久化结构或生成参数协议。
