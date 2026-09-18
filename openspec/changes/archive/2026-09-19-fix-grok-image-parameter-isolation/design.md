## Context

xAI Grok Imagine 文档的当前契约只接受 `low`、`medium` 质量档，不使用 GPT Responses 的 `reasoningEffort`。工作台原本只有一份质量选择和一份通用思考等级来源；全局默认质量为 `high`，因此旧 `auto` 或空质量请求在 Grok 路由上会继承不受支持的值。

## Decisions

### 1. 路由感知的质量归一化

质量归一化统一接收 `imageRoute` 和 `imageModel`。路由 D 只允许 `low`、`medium`，空值、旧 `auto` 和 GPT 专属档位 `high`、`xhigh`、`max` 都映射为 Grok 的 `medium`；路由 A/B/C 只允许明确 GPT 质量档，空值、旧 `auto` 和非法值按既有默认 `high` 收敛。

浏览器在切换路由前保存当前各模式控件值，并按路由恢复；服务端仍对每个请求重新归一化，不能依赖浏览器传入值的可信性。

### 2. 图片请求与文本请求分离

图片请求通过统一 helper 归一化 `quality` 和 `reasoningEffort`。Grok 图片请求的思考等级固定为空，并且在保存图片元数据、预览元数据、队列快照和套图快照时省略该字段。PPT 大纲、文章规划等文本/视觉请求继续使用 GPT 的思考等级；只有 PPT 图片页按所选图片路由隔离。

### 3. 共享模块保持同步

质量选项模块仍由 `lib/` 作为源文件，并同步到 `public/lib/`。浏览器控制只依赖该共享模块导出的路由感知函数，避免客户端与服务端对 Grok 选项产生分歧。

### 4. 验证边界

定向测试覆盖 Grok 选项集合、路由切换记忆、请求字段隔离、PPT 与补图入口；全量测试验证 GPT、Gemini 和历史快照没有回归。
