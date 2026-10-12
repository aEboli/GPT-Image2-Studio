## Why

图片反推虽已记录原图风格，但风格锚点和清晰度目标不够突出，后续生图容易弱化原图辨识度，并出现主体发糊、细节涂抹或无关杂物。用户确认通过提示词加入“4K/8K级”高清观感；该词组表示生成视觉目标，不代表实际输出像素承诺。

## What Changes

- 在 `visual` 中优先强化原图最有辨识度的风格词汇，再加入 4K/8K 级清晰成像意图、主体焦点、真实纹理、自然锐利边缘和清晰层次。
- 在 `avoid` 中按源图适用情况约束意外虚焦、运动拖影、噪点/压缩伪影、重复或畸变细节及无关杂物。
- 保留原图有意的浅景深、背景散景、柔焦、胶片颗粒和运动表现，避免把“清晰”解释成全画面强行锐化。
- 更新 Prompt Agent JSON schema 说明和图片转提示词上传区文案。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `image-to-prompt`: 反推结果保留源图风格的同时，加入高解析观感、主体清晰度、纹理和画面整洁约束。

## Impact

- 普通图片反推模型指令与严格 JSON schema 描述：`lib/prompt-agent.mjs`。
- 图片转提示词入口说明：`public/index.html`。
- `image-to-prompt` OpenSpec 规格。
