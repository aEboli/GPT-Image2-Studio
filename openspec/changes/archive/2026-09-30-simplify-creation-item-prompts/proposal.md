## Why

套图每张图的提示词有 2200–3900 字符，由十几段规则逐句拼接：角色说明、Role job、画面形式、Composition 标签、Buyer goal、两段商品锁定、画面语言、质量收尾句、参考图说明与重复的 Reference evidence 等。多段内容互相重复，部分是内部规划标签，模型难以抓住重点。

## What Changes

- 普通套图（轮播）项提示词改为按段组织：任务（角色、画面形式、场景分配、商品与事实、创意范围）、参考图、商品保真、画面文字、风格，每段一行。
- 去掉 `Role job:` 标签、通用套图的 `Composition: …; scene: …` 机器标签（平台原生槽位保留）、`Buyer goal:`、质量收尾句。
- `SUBJECT CONTENT LOCK` 与 `SUBJECT IDENTITY LOCK` 合并为一条 `PRODUCT FIDELITY:`；生成阶段把它视为两种锁定都已存在，历史提示词仍按旧标记补齐。
- 参考图说明只列一次：删除与覆盖来源重复的 `Reference evidence`，覆盖来源的开场句与原图版式边界压缩为一句；参考图备注仍保留。
- 画面语言说明压缩，保留生成阶段替换语言所依赖的首句。
- SKU 项与信息图重构项的结构不变。

## Capabilities

### Modified Capabilities

- `creation-mode`：套图项提示词精简。

## Impact

- `lib/creation-planner.mjs`、`lib/creation-generation-parameters.mjs`。
- `test/creation-planner.test.mjs`、`test/creation-platform-planner.test.mjs`、`test/creation-platform-generation.test.mjs`。
