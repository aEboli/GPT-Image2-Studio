## Why

当前图片反推提示词请求会误带套图平台与商品用途上下文，导致普通画面分析混入主图、详情页、SKU、直播等无关营销内容；结果又把完整 `prompt` 与逐字段视觉分析同时作为模板内容展示和应用，造成修饰词堆叠与明显重复。

## What Changes

- 将套图平台、类目和用途上下文严格限制在套图参考分析模式，普通图片反推不再接收这些内容。
- 收紧普通反推指令：只保留会改变可见画面的描述，禁止空泛质量词、近义形容词堆叠、用途建议和同义复述。
- 将反推工具的主结果、复制动作和自动提示词模板统一为单一 `prompt` 文本；结构化 JSON 继续保留用于历史兼容和辅助复制。
- 读取旧版反推 JSON 模板时提取其中的 `prompt`，避免旧模板继续把同一组视觉信息应用两遍。
- 保持本地服务与 Cloudflare Worker 的请求行为一致。

## Capabilities

### New Capabilities

- `image-to-prompt`: 定义图片反推提示词的上下文隔离、精炼输出、主结果展示、模板应用和历史兼容行为。

### Modified Capabilities

- 无。

## Impact

- Shared analysis: `lib/prompt-agent.mjs` 的普通反推指令与结构化输出说明。
- API routes: `server.mjs` 与 `cloudflare-pages-worker.mjs` 的 `/api/prompt-agent/analyze` 上下文组装。
- Frontend: `public/index.html`、`public/app.js` 的结果展示、复制和模板归一化。
- Tests: `test/prompt-agent.test.mjs`、`test/cloudflare-pages-worker.test.mjs`、`test/creation-server-static.test.mjs`、`test/studio-preview-layout.test.mjs`。
- Compatibility: 不改历史记录存储结构和 API 返回 JSON；旧提示词模板在读取时兼容转换。
