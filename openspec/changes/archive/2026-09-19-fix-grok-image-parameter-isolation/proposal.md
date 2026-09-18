# fix-grok-image-parameter-isolation

## Why

Grok Imagine 的生图接口与 GPT 图像工具不是同一套参数契约。原有生成控件和任务快照以 GPT 的全局质量、思考等级为默认来源，切换到 Grok 后可能把 `high`、`xhigh`、`max` 或 `reasoningEffort` 带入 Grok 请求、队列记录和历史元数据，造成上游报错或界面显示与实际请求不一致。

## What Changes

- 将质量选项和质量记忆按 GPT、Gemini、Grok 生图路由隔离；GPT/Gemini 只显示受支持的明确质量档，Grok 只显示并发送 `low`、`medium`。
- Grok 请求不再携带 GPT 专用 `reasoningEffort`；GPT 的思考等级仍用于 GPT 图片请求和 PPT 大纲等文本/视觉请求。
- 统一生成、编辑、套图、写真、文章插图、PPT 页面、补图、预览保存和任务快照中的路由感知归一化。
- Grok 的质量和思考等级显示、记录与请求体保持一致，历史 GPT 任务仍按原路由读取。

## Capabilities

### Modified Capabilities

- `runtime-configuration`
- `configuration-usability`

## Impact

- 代码：质量选项模块、浏览器生成控制、服务端各图片生成入口、任务/资产元数据和对应测试。
- 用户行为：切换到 Grok 时质量自动落在 Grok 支持的明确档位，旧 `auto` 值迁移为 `medium`，思考等级控件隐藏；切回 GPT 时恢复该路由自己的质量和思考等级选择，旧 GPT `auto` 值迁移为 `high`。
- 兼容性：GPT、Gemini 以及已有任务快照的行为保持不变。
