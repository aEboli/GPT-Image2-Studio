## Why

GPT-Image2-Studio 已经覆盖普通生图、风格迁移、融图分析、图片拆解、套图、写真、文章插图、PPT、画廊和多类记录。深度用户的主要瓶颈不再是入口数量，而是复杂工作台里的可访问性、错误反馈、批量资产整理和本地/云端能力一致性。

第一批变更先处理风险低、收益直接、可独立验证的基础问题：隐藏语义中的可聚焦控件、异步错误公告、弹层焦点管理的基础钩子，以及 public/lib、配置和 API 能力边界的测试护栏。

## What Changes

- 修复不应被 `aria-hidden` 包裹的可交互控件，避免键盘和读屏用户进入不可见语义区。
- 让全局错误区具备明确公告语义，保证异步失败能被辅助技术捕获。
- 为配置抽屉、Prompt Agent 和 Lightbox 增加基础焦点进入和返回机制，后续再扩展完整 focus trap。
- 为 Gallery 自定义滚动条保留可访问名称，并在不可用状态下禁用内部按钮。
- 扩大 public/lib 同步测试覆盖，降低共享模块漂移风险。

## Non-Goals

- 不重排 Creation Mode 的完整表单层级。
- 不新增 Brand Kit、质量检查器、导出包或队列管理器。
- 不更改图片生成提示词、业务输出格式或存储路径。
- 不修改用户已有生成记录或本地图片资产。

## Impact

- Frontend: `public/index.html`、`public/app.js` 需要小范围可访问性和焦点管理修复。
- Tests: `test/studio-preview-layout.test.mjs` 和 `test/public-lib-sync.test.mjs` 增加或调整护栏。
- Scripts: 如需让测试复用同步目标，`scripts/sync-public-lib.mjs` 可导出目标列表且保持 CLI 行为不变。
- Verification: 运行针对性测试、`sync:public-lib -- --check`、必要时跑完整 `npm test`。
