## Why

图片反推改成单一 `prompt` 后虽然消除了重复，但也丢失了用户需要的结构化可编辑能力，并且无法稳定约束景别、主体占比、裁切、透视和焦段。用户已通过两张真实图片确认新的折中结构：主体与镜头景别详细，背景和整体视觉精简，且同一信息只出现一次。

## What Changes

- **BREAKING**：普通图片反推的成功 JSON 从含 `prompt` 的旧分析对象改为固定的 `subject`、`framing`、`scene`、`visual`、`avoid` 五组结构，不再返回重复的完整 `prompt`。
- `subject` 保留主体类型、姿态或状态、表情、外观、服装和交互细节；不适用字段使用空字符串或空数组。
- `framing` 单独保留画幅、景别、主体占比、位置、留白、前景框景、相机建议、机位、裁切、透视和景深；无 EXIF 时仍选择一个明确的全画幅等效建议焦段，并与拍摄距离、光圈和对焦目标共同描述。
- `scene` 与 `visual` 使用精简字符串，`avoid` 仅列出针对当前图片的高影响复原偏差，继续禁止空泛质量词、用途建议和同义重复。
- 主结果、复制、映射到 Studio 和自动提示词模板统一使用格式化后的完整 JSON；历史旧记录和旧 `prompt-agent-*` 模板继续兼容。
- 本地服务、Cloudflare Worker 和不同上游协议使用同一严格 schema 与归一化结果。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `image-to-prompt`: 将普通反推的主结果从单一 `json.prompt` 改为不重复的中等复杂度结构化 JSON，并增加可复现景别和建议焦段要求。

## Impact

- Shared analysis: `lib/prompt-agent.mjs` 的普通反推指令、严格 schema 与结果归一化。
- Frontend: `public/index.html`、`public/app.js` 的结果展示、复制、历史映射和自动模板保存。
- API compatibility: `/api/prompt-agent/analyze` 的普通图片模式 JSON 形状变化；Creation、写真和多参考图编排模式不变。
- Tests and specs: Prompt Agent、Cloudflare、静态前端测试以及 `image-to-prompt` 增量规格。
