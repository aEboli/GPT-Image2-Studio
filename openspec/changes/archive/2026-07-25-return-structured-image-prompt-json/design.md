## Context

普通图片反推当前使用严格 JSON 请求模型，但 schema 同时包含完整 `prompt` 与多个分析字段；上一项变更为消除重复，将前端主结果和模板压缩为 `json.prompt`。用户实际需要的是可编辑 JSON，同时要求景别和主体尺度足以复原构图，因此需要用一份不含重复总提示词的中等复杂度结构替代旧契约。

共享 `lib/prompt-agent.mjs` 同时服务普通反推、多参考图编排、Creation 参考分析和写真分析。新结构必须只作用于普通模式，并继续兼容历史记录、旧模板以及不支持 structured output 的上游回退。

## Goals / Non-Goals

**Goals:**

- 普通反推返回固定五组 JSON，主体和景别详细，背景与整体表现精简。
- 用结构化的景别、占比、位置、裁切、机位、焦段建议和景深提高构图复原稳定性。
- 同一视觉事实只进入一个最合适的字段，不再增加汇总 `prompt`。
- 主结果、复制、历史映射和自动模板使用同一份格式化 JSON。
- 保持其他分析模式、历史存储文件和旧模板可用。

**Non-Goals:**

- 不宣称建议焦段、距离或光圈是原图真实 EXIF。
- 不为所有图片增加摄影专业参数；不适用字段允许为空。
- 不改变 Creation、写真或多参考图编排的 schema。
- 不批量迁移或重写已有历史记录与浏览器模板。

## Decisions

### 1. 普通反推使用固定五组顶层结构

严格 schema 只包含 `subject`、`framing`、`scene`、`visual`、`avoid`。`subject` 包含 `type`、`pose`、`expression`、`appearance`、`clothing`、`interaction`；`framing` 包含 `aspect_ratio`、`shot_size`、`subject_scale`、`placement`、`negative_space`、`foreground_frame`、`camera`、`angle`、`crop`、`perspective`、`depth_of_field`。

所有 schema 属性均为 required，以满足严格 structured output；图片不适用的标量返回空字符串，列表返回空数组。替代方案是继续保留 `prompt` 作为汇总字段，但它会重新引入用户明确反对的重复。

### 2. 焦段作为复原建议而非证据字段

`framing.camera` 必须选择一个明确的全画幅等效建议焦段，并结合建议拍摄距离、光圈和对焦目标描述。可读取可靠 EXIF 时允许据实使用；否则根据透视和景别选择单一建议值，提示词不得声称其为原始元数据。

仅给焦段不足以锁定景别，因此 `shot_size`、`subject_scale`、`placement`、`crop`、`perspective` 和 `depth_of_field` 同时保留。替代方案是焦段范围或“广角/长焦”等模糊描述，但可控性较低。

### 3. 结构识别后使用专用归一化

共享响应解析器先识别五组新结构并返回规范化的同形对象；不符合新结构时沿用现有旧格式归一化，以免影响其他模式和历史测试。新结构不会被补入旧 `title`、`prompt`、`style_tags` 等空字段。

### 4. 一份格式化 JSON 贯穿前端复用路径

前端以 `JSON.stringify(item.json, null, 2)` 作为普通反推的结果、复制内容、历史详情、映射到 Studio 内容和自动模板内容。界面只保留一个“复制 JSON”动作。新记录没有 `title` 时，历史标题和模板名回退到文件名或“图片反推 JSON”。

旧 `prompt-agent-*` 模板若仍是含非空 `prompt` 的旧分析 JSON，继续提取该字符串；新的五组 JSON 没有 `prompt`，因此按原文保留。替代方案是数据迁移，但会改写用户本地内容并降低回滚能力。

## Risks / Trade-offs

- [模型为不适用字段编造内容] -> 指令要求使用空值，并禁止编造不可见身份、文字或对象。
- [建议焦段被误解为 EXIF] -> 在指令和 `camera` schema 描述中明确标记为生成建议。
- [JSON 作为生图输入可能比自然段更长] -> 限制顶层分组并压缩 `scene`、`visual`，禁止同义重复与空泛质量词。
- [旧上游返回旧 schema] -> 保留旧格式归一化，但新严格 schema 与重试指令优先要求五组结构。
- [历史 UI 标题缺失] -> 使用文件名和固定中文回退标题。

## Migration Plan

1. 增加新 schema、指令、归一化和前端复用路径的失败测试。
2. 更新共享 Prompt Agent 与前端，不修改专用分析模式。
3. 运行本地、Worker、前端、完整项目测试和 OpenSpec 严格验证。
4. 用用户指定图片通过真实接口生成一次结果，检查字段、重复和构图参数。
5. 归档变更并将增量规格合并回 `image-to-prompt` 主规格。

回滚时恢复 schema、指令和前端复用逻辑即可；历史记录按原始 JSON 保存，不需要反向迁移。

## Open Questions

- 无。最终字段与焦段策略已由用户通过两张图片样例确认。
