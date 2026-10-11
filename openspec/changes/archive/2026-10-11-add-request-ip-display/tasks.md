# 任务

- [x] 1.1 增加请求发起 IP 的解析、配置响应和标准生图记录字段。
- [x] 1.2 在 Gallery 元数据、参数详情和左侧参数摘要中显示 IP。
- [x] 1.3 增加格式化、Gallery 持久化和标准生图端到端回归测试。
- [x] 1.4 运行聚焦测试、同步检查、严格 OpenSpec 校验和 `git diff --check`。

## Verification

- `node --test test/studio-formatters.test.mjs test/gallery-store.test.mjs test/generation-background-submit.test.mjs`：33 项通过。
- `node --test test/browser-shell-modules.test.mjs test/studio-preview-layout.test.mjs`：206 项通过。
- `node --check server.mjs`、`node --check public/app.js`、`npm run sync:public-lib -- --check`、严格 OpenSpec 校验和 `git diff --check` 均通过。
