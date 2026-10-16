# 优化增强模式的清晰度提示词

## Why

增强模式当前默认附加微距细节、写实纹理、可见颗粒和电影光照，可能干扰原始风格、光照和景别。用户希望补充 8K 等画质描述，重点提高生成图片的清晰观感，同时尽量保持原始创作要求。

## What Changes

- 将默认增强提示词改为下述英文文案，补充 8K 级超高清质感、清晰主体、自然边缘、细腻纹理、平滑渐变，以及对非预期模糊和伪影的约束。
- 明确原始提示词与参考图要求优先，保留有意虚化、颗粒、像素风和简约表现，不强制加入摄影、微距或电影风格。
- 同步页面默认内容、脚本默认常量和现有相关检查；沿用现有可编辑、默认关闭及开启后附加文本的交互。

## 拟采用的默认提示词

Quality only; original prompt and references take priority. 8K ultra-HD look, clear subject, precise focus, natural edges, style-faithful detail, smooth gradients, clean tonal separation. Reduce unintended blur, aliasing, banding, compression artifacts, oversharpening, repeated details. Preserve subject, identity, count, composition, proportions, text, style, color, lighting, materials, intentional blur/grain/pixel art/minimalism. Add no objects, details or quality labels. Size follows settings.

## Impact

- 涉及 `public/index.html`、`public/app.js` 和 `test/studio-preview-layout.test.mjs` 中增强模式默认文本及其检查。
- 更新 `workbench-usability-foundation` 规格，记录提示词优先级及风格保持要求。
- 8K 是视觉质量描述，实际像素由生成参数与上游模型能力决定；提示词不能保证每张图片的实际清晰度或完全消除风格偏移。
- 用户于 2026-10-16 确认实施，并补充要求默认增强提示词使用英文。
