## Why

当前 PPT 工作流可以生成整页图片并导出 `.pptx`，但 PowerPoint 中每页基本是一张不可编辑的整图。用户希望在保留现有视觉生成能力的基础上，额外导出一个“可编辑重建版 PPTX”，让标题、正文、表格、基础形状和部分图层尽量成为 PowerPoint 中可选择、可移动、可编辑的对象。

Presentations skill 提供了用 artifact-tool 构建可编辑演示文稿的本地工作流，适合作为本地增强导出引擎接入。但它依赖 Codex bundled runtime 中的 `@oai/artifact-tool`，不应替换当前可部署的 `pptxgenjs` 默认导出路径。

## What Changes

- 在 PPT 生成页增加导出方式选择，保留“整页图片”默认模式，并新增“可编辑重建”模式。
- 生成 PPT 页面图片后，可选启动本地可编辑重建流程。
- 对每页生成图进行版面分析，产出 slide reconstruction manifest，描述文本框、表格、图片区域、形状、背景和低置信度回退区域。
- 使用 Presentations skill 的 artifact-tool 辅助脚本生成可编辑 `.pptx`，尽量将文本、表格和基础形状还原为 PowerPoint 可编辑对象。
- 对复杂、低置信度或不可可靠识别的视觉区域，裁切为独立图片层，而不是强行伪装成可编辑文本或表格。
- PPT 记录中同时保存普通整页图片版和可编辑重建版下载信息。
- 本地运行环境支持该增强能力；Cloudflare/Vercel 部署继续使用默认整页图片导出，不承诺 artifact-tool 可用。

## Capabilities

### New Capabilities

- `editable-pptx-reconstruction`: 从已生成的 PPT 页面图片重建本地可编辑 PPTX。

### Modified Capabilities

- `ppt-generation`: 新增可选导出方式，并在本地环境下支持额外生成可编辑重建版 PPTX。
- `ppt-records`: 保存并展示普通 PPTX 与可编辑重建 PPTX 的下载入口。

## Impact

- Frontend: `public/index.html`, `public/app.js`, `public/styles.css` 增加导出方式控件、状态提示和双下载入口。
- Backend: `server.mjs` 新增导出方式参数处理、本地 artifact-tool 可用性检测、重建流程编排和 SSE 进度事件。
- Libraries: 新增 PPT 重建 manifest、artifact-tool 调用封装、元素裁切/资产管理、结果记录归一化模块。
- Storage: 在现有 PPT deck folder 中保存普通 `.pptx`、可编辑重建 `.pptx`、重建 manifest 和必要的裁切资产；历史记录只暴露最终可下载文件。
- Tests: 增加表单参数、服务端本地能力检测、manifest 归一化、PPT 记录、回退策略和现有默认导出不回归的覆盖。
