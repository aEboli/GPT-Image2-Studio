## Why

Vercel 的 Node Runtime 会截获入口模块的 `listen()` 调用，而当前服务在模块顶层等待该监听回调；同时云端安装了仅供桌面使用的 Electron 依赖。这会使部署在导入阶段失败或永久等待，并以 `500 FUNCTION_INVOCATION_FAILED` 对外暴露。

## What Changes

- Vercel 使用仅安装生产依赖的安装命令，并排除桌面 Electron 入口目录。
- 服务导出标准 Node 请求处理函数，在 Vercel 截获监听时不等待本地监听回调。
- 仅在已确认的 Serverless 截获路径中绕过本地直连 Host/回环认证判定；常规本地 Node 服务保持现有安全策略。
- 增加模拟 Vercel 监听截获和部署配置的自动化回归测试。

## Capabilities

### New Capabilities

- `vercel-serverless-deployment`: Vercel Serverless Function 的依赖、入口和认证边界。

### Modified Capabilities

- 无。

## Impact

- 受影响代码：`vercel.json`、`.vercelignore`、`server.mjs`、`test/vercel-deployment.test.mjs`、`README.md`。
- 外部部署：Vercel Node Runtime；不改变本地桌面启动命令、公开 API 路径或持久化模型。
