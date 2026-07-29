## Why

新五组结构化图片反推 JSON 不再包含 `title`，当前历史记录与自动提示词模板因此直接显示 `image-analysis.jpg` 等上传文件名。文件名既不能帮助用户辨认画面，也把无意义的图片后缀带入模板名称。

## What Changes

- 为结构化图片反推结果生成不超过 40 个字符的中文短标题，按可用情况组合时间或天气、主体动作或关键道具、主体类型和代表性环境要素。
- 名称只使用现有结构化 JSON 中可见且明确的信息，跳过缺失维度并去除重复要素。
- 历史记录、自动保存的提示词模板和模板名称输入框统一使用同一名称。
- 旧结果已有非空 `json.title` 时继续保留原标题。
- 无法生成结构化短标题时回退到去除图片扩展名的上传文件主名，最后才使用 `图片反推 JSON`。
- 已保存的 `prompt-agent-*` 自动模板若仍使用图片文件名式名称，则在读取时恢复为结构化短标题；不覆盖用户自定义的非文件名名称。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `image-to-prompt`: 增加图片反推结果与自动模板的可读命名和兼容迁移规则。

## Impact

- Frontend helper: 新增可测试的图片反推显示名称模块，并同步到 `public/lib`。
- Frontend integration: `public/app.js` 的历史记录、自动模板保存和模板读取归一化。
- Tests and specs: 新增名称生成单元测试，更新前端契约测试与 `image-to-prompt` 增量规格。
