## 1. 回归测试

- [x] 1.1 增加普通反推指令测试，覆盖具体视觉信息、空泛修饰词、近义堆叠、用途建议和同义复述边界。
- [x] 1.2 增加本地与 Cloudflare 路由测试，证明普通反推不注入套图上下文，专用套图分析仍保留上下文。
- [x] 1.3 增加前端结果、复制、自动模板和旧 JSON 模板兼容测试。

## 2. 实现

- [x] 2.1 收紧 `lib/prompt-agent.mjs` 的普通反推指令和 schema 描述，保持其他分析模式不变。
- [x] 2.2 修正 `server.mjs` 与 `cloudflare-pages-worker.mjs` 的通用 Prompt Agent 上下文边界。
- [x] 2.3 将前端主结果、复制和自动模板改为单一提示词，并保留显式 JSON 复制与旧模板兼容。
- [x] 2.4 复查新增和修改的中文内容，确认无乱码或异常字符。

## 3. 验证与归档

- [x] 3.1 运行针对性测试和 `npm run sync:public-lib -- --check`。
- [x] 3.2 运行 `npm test` 与 `openspec validate --all --strict --no-interactive`，明确报告任何非本次引入的失败。
- [x] 3.3 归档 `refine-image-to-prompt-output`，确认增量规格合并至主规格并保留变更历史。
