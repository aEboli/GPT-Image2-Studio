## Why

信息图重构已经只发送对应原图一张，并且比例、分辨率和输出格式已经进入图像 API 参数；但专用提示词仍明确要求忽略目标语言并保留原语言，导致用户选择的目标语言一定不会生效。需要用最小改动修正这条冲突，并用测试锁定四项输出控制。

## What Changes

- 信息图重构运行时提示词采用所选目标语言，完整翻译可翻译文字，同时保持品牌名、型号、数字、单位、参数和事实不变。
- 运行时提示词显式记录所选比例、请求/实际分辨率和输出格式，继续由现有结构化 API 字段执行这些技术参数。
- Local、Worker 和本地修复继续只发送当前项对应的原始信息图一张。
- 不引入商品信息、Logo、平台、受众、营销策略或其他套图上下文。

## Capabilities

### Modified Capabilities

- `creation-infographic-rebuild`: 信息图重构除单图内容事实外，仅采用目标语言、输出格式、分辨率和比例四项用户输出控制。

## Impact

- Affected module: `lib/creation-generation-parameters.mjs`。
- Affected call sites: Local、Worker 与本地修复的 Creation 生成循环。
- Affected tests: 信息图重构 prompt、Worker 请求和本地生成/修复回归测试。
- 不新增依赖，不修改接口字段、参考图筛选或持久化结构。
