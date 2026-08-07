## Context

项目既支持本地 Node/Electron，也通过 `server.mjs` 部署到 Vercel。Vercel 会在导入入口时截获 `http.Server.prototype.listen` 来定位服务实例，但不会执行本地监听回调；原有顶层等待会使函数初始化无法完成。Vercel 默认安装开发依赖还会让 Electron 在无桌面运行目录的环境中安装失败。

## Goals / Non-Goals

**Goals:**

- 让 Vercel 首页与现有 JSON API 在函数启动后正常响应。
- 保留本地服务的监听、输出和 Host/回环认证策略。
- 防止桌面工具链作为 Vercel 函数运行依赖安装。

**Non-Goals:**

- 不把 Vercel 临时文件系统变为持久化存储。
- 不改变 API 的业务路由、访问令牌格式或 Electron 桌面功能。
- 不以环境变量单独关闭本地认证。

## Decisions

### 1. 使用标准请求处理函数作为默认导出

路由和错误处理抽为 `handleIncomingRequest`，同时保留本地 `http.Server` 导出。Vercel 可以直接调用函数，而本地服务继续由同一个处理函数驱动。相较于只默认导出 Server，这避免预览代理无法得到可调用处理器。

### 2. 以监听截获作为 Serverless 边界信号

启动时比较监听调用前后的方法引用。只有 Vercel 已截获调用时才跳过等待本地监听回调，并为路由标记 Serverless 运行时。该信号也仅在该情形跳过本地直连的 Host/回环校验，防止 Vercel 内部回环代理被误判为 DNS 重绑定；普通 `node server.mjs` 路径不受影响。

### 3. 从部署输入中移除桌面工具链

`vercel.json` 显式执行 `npm ci --omit=dev`，`.vercelignore` 排除 `desktop/`。这样 Vercel 不会尝试安装或识别 Electron/Electron Builder，运行依赖仍由锁文件确定。

### 4. 用捕获模拟验证，而非只检查导出文本

测试替换 `Server.prototype.listen` 复现 Vercel 的截获行为，再以导出的处理函数提供请求，验证导入会完成且公网 Host 的首页响应为 `200`。

## Risks / Trade-offs

- [Vercel 运行时实现改变] -> 使用真实 Preview 的首页和 `/api/config` 冒烟检查，并保留模拟测试防止本地回归。
- [Serverless 认证范围扩大] -> 仅依据真实监听截获启用，不能由普通本地请求或单个环境变量触发；本地安全测试继续覆盖拒绝路径。
- [部署混入开发工作树] -> 从 `HEAD` 创建临时 worktree，只手工应用本次五个部署修复文件后发布。

## Migration Plan

1. 在 Preview 中验证入口和配置 API 均返回成功，检查函数日志不再含 Electron 或初始化失败。
2. 以隔离 worktree 发布生产，并复测同一入口。
3. 若生产异常，Vercel 回滚到前一部署；本地服务可继续使用原有启动方式，不需要数据迁移。

## Open Questions

- 无。Preview 已覆盖当前 Vercel 运行时的监听截获、默认导出和内部代理 Host 行为。
