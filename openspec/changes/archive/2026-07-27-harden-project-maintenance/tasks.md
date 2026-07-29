## 1. 规格与失败测试

- [x] 1.1 完成 proposal、增量 specs、design 和 tasks 的一致性检查并通过 OpenSpec strict validation。
- [x] 1.2 增加默认模型测试，证明本地、浏览器、Cloudflare、直接文本视觉与 Listing 缺省值统一为 `gpt-5.4-mini`，显式配置保持不变。
- [x] 1.3 增加认证测试，覆盖回环访问、非回环 Basic/Bearer/Header 认证、错误令牌、同源绕过和认证挑战。
- [x] 1.4 增加维护契约测试，覆盖 CI 必需步骤、发布版本一致性和共享模块注册。

## 2. 运行时维护加固

- [x] 2.1 新增共享模型默认值模块，并保持现有导出兼容。
- [x] 2.2 将本地配置、浏览器配置、Cloudflare Worker、Listing、格式化和相关视图的缺省 Responses 模型统一为 `gpt-5.4-mini`。
- [x] 2.3 保留环境变量、持久配置、浏览器私有配置、请求覆盖、`gpt-image-2` 和模型协议通道行为。
- [x] 2.4 抽取本地服务认证模块，使所有非回环请求要求现有令牌，并保持回环交互不变。
- [x] 2.5 更新启动日志、README 和 `.env.example`，说明默认模型与远程浏览器认证方式。

## 3. 工程与发布门禁

- [x] 3.1 将 OpenSpec 1.6.0 固定为开发依赖，并将完整测试默认改为串行执行。
- [x] 3.2 增加发布一致性检查脚本及普通/严格 npm 命令。
- [x] 3.3 增加 GitHub Actions CI，执行测试、同步、发布检查、Cloudflare 构建、OpenSpec、diff 和工作树检查。
- [x] 3.4 增加 `SECURITY.md` 与 `CONTRIBUTING.md`，记录安全边界、规格闭环和发布验收。
- [x] 3.5 修复当前 `git diff --check` 失败，不改动无关历史内容。

## 4. 验证与归档

- [x] 4.1 运行默认模型、认证、维护脚本和 Local/Worker 相关定向测试。
- [x] 4.2 运行完整 `npm test`、`npm run sync:public-lib -- --check`、`npm run check:release` 和 `npm run build:pages`。
- [x] 4.3 运行 OpenSpec strict validation、`git diff --check`、中文 UTF-8/乱码扫描和最终工作树复核。
- [x] 4.4 归档 `harden-project-maintenance`，确认增量规格合并回主规格且无活动变更遗留。
