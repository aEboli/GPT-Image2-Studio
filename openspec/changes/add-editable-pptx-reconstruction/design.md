## Context

GPT-Image2-Studio 当前的 PPT 生成链路是：生成结构化大纲，逐页调用图像模型生成 16:9 页面图片，再用 `pptxgenjs` 将每页图片全屏嵌入 `.pptx`。这个结果视觉稳定，但 PowerPoint 中的页面内容不可拆分编辑。

用户明确接受耗时和消耗增加，目标优先级是“把生成图片重建为可编辑 PPT”。因此本 change 不尝试降低模型调用次数，而是把可编辑重建作为本地增强导出能力加入。

## Goals / Non-Goals

**Goals:**

- 保留当前整页图片导出为默认和可靠回退。
- 增加“可编辑重建”导出选项。
- 使用 Presentations skill 的 artifact-tool 工作流生成可编辑 PPTX。
- 尽量将标题、正文、列表、表格、基础图形、线条、色块和简单图表重建为可编辑对象。
- 将复杂插图、产品图、截图、低置信度文本、复杂图表和不确定区域裁切为独立图片层。
- 生成可追踪的 slide reconstruction manifest，用于调试、测试和后续迭代。
- 在本地环境明确报告 artifact-tool 不可用、重建失败、单页降级和最终导出状态。

**Non-Goals:**

- 不承诺从 PNG 100% 无损恢复原始 PPT 结构。
- 不要求 Cloudflare Pages、Cloudflare Worker 或 Vercel 部署支持 artifact-tool 重建。
- 不替换现有 `pptxgenjs` 默认导出。
- 不把 Presentations skill 文件直接复制为公开运行时依赖。
- 不在第一版实现人工逐元素编辑器。
- 不把低置信度文字强行 OCR 后写成可编辑文本。

## Decisions

1. **默认继续使用整页图片导出。**
   - Rationale: 现有导出路径稳定、可部署、测试覆盖已有基础，必须保留。
   - Alternative considered: 直接替换为 artifact-tool。该方案会让云端部署和普通用户路径变得脆弱。

2. **可编辑重建作为本地增强模式。**
   - Rationale: Presentations skill 依赖本机 Codex runtime 中的 `@oai/artifact-tool`，天然适合本地增强，不适合作为云端默认能力。
   - Alternative considered: 把 `@oai/artifact-tool` 当成项目 npm 依赖。当前没有稳定公开依赖边界，不采用。

3. **重建流程优先使用 artifact-tool slide module，manifest 作为降级产物。**
   - Rationale: 用户反馈 JSON bbox 叠层效果明显低于 Presentations skill。新版主路径让模型按每页图片直接生成受限的 artifact-tool slide module，再交给 Presentations helper 构建 PPTX，更接近 skill 自身的组件化效果。
   - Safety: module source 必须通过本地 guard，仅允许 `presentation.slides.add()` 与 `ctx.addText/addShape/addImage/addLucideIcon`，禁止 `import`、`require`、`process`、`fs`、网络和动态执行。
   - Fallback: module 生成、校验或构建失败时，退回结构化 manifest，再退回整页图片 + 可编辑标题。

4. **采用混合可编辑策略。**
   - Rationale: 真实生成图中并非所有内容都适合重建为原生对象。文本、表格、基础形状优先可编辑；复杂视觉保留为可移动图片层，可以降低错误编辑对象造成的误导。
   - Alternative considered: 强制所有元素原生化。该方案会提高 OCR 错字、表格错列、图表错义风险。

5. **记录普通 PPTX 与可编辑 PPTX 两种结果。**
   - Rationale: 用户需要可靠版本和可编辑版本同时可用。重建失败不应导致整份 PPT 生成失败。

## Architecture

### UI

PPT 表单增加 `PPTX 导出方式`：

- `整页图片`：当前默认行为。
- `可编辑重建`：先生成普通 PPTX，再启动重建流程，完成后提供第二个下载链接。

状态文案需要明确区分：

- 正在生成页面图片
- 正在导出普通 PPTX
- 正在分析第 N 页
- 正在重建第 N 页
- 正在校验可编辑 PPTX
- 可编辑重建完成
- 可编辑重建失败，普通 PPTX 仍可下载

### Backend Flow

1. `/api/ppt/generate` 接收 `exportMode`。
2. 原有流程生成 outline、slides 和普通 PPTX。
3. 若 `exportMode=editable-reconstruction`：
   - 检测本地 artifact-tool runtime 是否可用。
   - 优先为每页图片请求受限 artifact-tool slide module。
   - 校验 module 安全边界与导出函数形状。
   - 对 module 失败页创建 reconstruction manifest。
   - 对 manifest 失败页使用整页图片 + 可编辑标题降级。
   - 调用 Presentations skill helper scripts 渲染预览和导出 editable PPTX。
   - 保存 editable PPTX 路径到 deck manifest。
4. 若任一单页重建失败：
   - 该页可降级为整页图片或图片分层。
   - 记录 warning。
   - 不影响普通 PPTX 下载。

### Artifact Module Shape

主路径每页生成一个 `slide-XX.mjs`：

```js
export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  ctx.addShape(slide, { x: 0, y: 0, width: 1280, height: 720, fill: "#F8FAFC" });
  ctx.addText(slide, { x: 72, y: 56, width: 760, height: 80, text: "核心结论标题", fontSize: 42 });
  return slide;
}
```

约束：

- 画布固定为 `1280x720`。
- 只能调用 `ctx` helper。
- 每个 module 必须只新增一页。
- 复杂照片、截图、不可读文本可局部图片降级。
- module 构建失败时整份 editable PPTX 会自动重试 manifest fallback。

### Manifest Shape

manifest 是 artifact module 失败后的降级中间产物。每页 manifest 使用项目内部 JSON 结构：

```json
{
  "slideNumber": 1,
  "sourceImage": "slide-01.png",
  "canvas": { "width": 1280, "height": 720 },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "bbox": [72, 48, 760, 74],
      "text": "核心结论标题",
      "role": "title",
      "confidence": 0.94,
      "editable": "text"
    },
    {
      "id": "visual-01",
      "type": "image-region",
      "bbox": [760, 112, 420, 360],
      "editable": "image",
      "confidence": 0.78
    }
  ],
  "warnings": []
}
```

第一版元素类型：

- `text`
- `table`
- `shape`
- `line`
- `image-region`
- `background`
- `fallback-image`

### Artifact-Tool Boundary

项目不直接把 Presentations skill 当公开依赖发布。后端通过本地配置或自动探测定位已安装 skill：

- 默认探测 Codex 插件缓存中的 Presentations skill。
- 允许本地配置覆盖 `PRESENTATIONS_SKILL_DIR`。
- 调用 skill 的 helper scripts 生成 artifact-tool workspace、render preview 和导出 PPTX。
- 如果 runtime 不存在，前端显示该模式当前本机不可用。

### Quality Gate

可编辑重建版必须满足：

- PPTX 文件存在且非空。
- slide count 与 outline 一致。
- 每页至少有一个可选择对象。
- 普通 PPTX 一定仍可下载。
- 重建失败页必须有明确降级策略。
- 不把低置信度 OCR 文本作为高置信度可编辑文本写入。

## Risks / Trade-offs

- **耗时和模型消耗显著增加** -> 用户已接受。UI 必须给出分阶段进度。
- **重建与原图存在视觉偏差** -> 保留普通 PPTX，重建版定位为可编辑增强而非无损复制。
- **artifact-tool 运行时不可用** -> 本地检测并提示，不影响默认导出。
- **文本 OCR 错误** -> 只对高置信度文本原生化，低置信度区域用图片层回退。
- **表格和图表语义错误** -> 表格需要行列置信度；复杂图表第一版优先图片层或基础形状，不伪造数据。
