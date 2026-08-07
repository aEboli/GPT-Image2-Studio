## 1. 运行时修复

- [x] 1.1 确认生产安装 Electron 导致函数初始化失败，以及 Vercel 截获 `listen()` 不调用回调的运行时边界。
- [x] 1.2 配置生产依赖安装、排除桌面入口，并实现兼容 Vercel 与本地 Node 的请求处理入口。
- [x] 1.3 仅在确认的 Serverless 截获路径保留公开路由可达性，保持本地认证策略不变。

## 2. 验证与发布

- [x] 2.1 增加并运行 Vercel 监听截获、生产依赖和部署输入回归测试。
- [x] 2.2 在受保护 Preview 中通过登录态验证首页和 `/api/config` 返回 `200`，且日志无 Electron、`FUNCTION_INVOCATION_FAILED`、`403` 或 `500`。
- [ ] 2.3 从隔离 worktree 发布生产，并复测首页和 `/api/config`。
- [ ] 2.4 运行 OpenSpec 严格验证并归档变更。
