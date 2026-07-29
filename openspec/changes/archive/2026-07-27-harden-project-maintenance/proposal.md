## Why

项目目前在本地 Node、浏览器私有配置和 Cloudflare Worker 中维护了不同的默认 Responses 模型，导致首次启动和配置缺失时的行为不一致。非回环监听虽然为写请求提供令牌，但远程客户端仍可在没有认证的情况下读取页面、记录和输出资源。与此同时，测试、共享模块同步、OpenSpec、云端构建和发布版本一致性主要依靠人工执行，容易再次出现规格已完成但未归档、版本文档漂移或提交前检查遗漏。

## What Changes

- 将本地、浏览器和 Cloudflare 的默认 Responses/文本视觉模型统一为 `gpt-5.4-mini`，并由一个共享模块提供默认常量。
- 仅在配置缺失时使用新默认值，保留环境变量、已保存配置、浏览器私有配置和请求级覆盖。
- 保持直接图片模型 `gpt-image-2` 与模型协议通道默认值不变。
- 对来自非回环地址的本地服务请求统一要求现有访问令牌认证，覆盖页面、静态资源、API 和输出文件；回环访问保持无认证体验。
- 为远程浏览器提供 HTTP Basic 认证，同时继续支持 Bearer 和 `X-Image-Studio-Token`，便于命令行与代理使用。
- 增加 GitHub Actions CI、发布版本一致性检查、串行测试默认值和可复现的 OpenSpec 工具版本。
- 增加安全边界与贡献维护文档，记录远程访问、密钥、生成资产、OpenSpec 和发布验收要求。

## Capabilities

### New Capabilities

- `runtime-configuration`: 跨本地、浏览器和 Cloudflare 的默认模型及覆盖优先级。
- `local-server-security`: 回环与非回环请求的认证边界。
- `project-maintenance`: CI、发布一致性检查、规格闭环和维护文档要求。

### Modified Capabilities

- 无。

## Impact

- 运行时配置：`lib/model-defaults.mjs`、配置存储、浏览器配置、路由选择、Listing 和视图回退值。
- 本地服务：`server.mjs` 与新增的认证辅助模块；Cloudflare Worker 的 HTTP 认证行为不变。
- 浏览器共享模块：同步清单与 `public/lib` 镜像。
- 工程维护：`package.json`、`package-lock.json`、`.github/workflows/ci.yml`、发布检查脚本、README、安全与贡献文档。
- 验证：默认模型、远程认证、发布一致性、CI 静态契约、完整测试、Cloudflare 构建和 OpenSpec 严格校验。
