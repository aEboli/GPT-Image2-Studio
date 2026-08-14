## Why

“长期保留”记录来自服务端 Prompt Agent 历史，而 Prompt Kit 只读取浏览器本地模板存储。历史加载完成后没有跨存储补齐，因此旧的可复用提示词只显示在图片转提示词面板，无法在提示词模板面板中继续使用。

## What Changes

- 打开 Prompt Kit 时加载图片转提示词历史，并把有可复用内容的历史记录补齐为 `prompt-agent-*` 自动模板。
- 使用历史记录 ID 生成稳定模板 ID，重复加载或重复记录不会产生重复模板。
- 已存在的模板原样保留，不覆盖用户修改过的名称或内容；删除模板只删除浏览器模板，不删除服务端长期历史。
- 对用户删除的自动模板记录本地屏蔽 ID，后续历史刷新不会把它重新补回。
- 保留普通图片分析完成后的即时自动保存，并让该保存路径使用同一套去重与不覆盖规则。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `image-to-prompt`: 长期保留历史与 Prompt Kit 自动模板之间增加浏览器端补齐语义。

## Impact

影响 `public/app.js`、同步到 `public/lib` 的模板合并辅助模块、相关单测和 OpenSpec 工件。服务端历史文件、API 响应结构、用户自定义模板格式和已有旧版 JSON 归一化行为不变。
