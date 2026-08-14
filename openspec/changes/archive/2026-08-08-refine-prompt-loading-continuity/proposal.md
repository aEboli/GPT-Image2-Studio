## Why

提示词生图预览的液体动效虽然使用 `infinite` 循环，但下坠细流在每个周期首尾同时变为不可见并回到入口位置。用户会看到一段流体突然消失、下一段又突然出现，循环边界破坏了连续的流沙感。

## What Changes

- 让提示词主预览使用两条错相的装饰细流，细流在不可见位置重置时由另一条细流承接。
- 为每个加载阶段暴露有界的半周期偏移，使错相关系随阶段时长保持稳定，不把视觉参数当作真实生成进度。
- 保留现有液体主体、液面、沉积、屏幕向下重力方向、节点复用和 `prefers-reduced-motion` 契约。

## Capabilities

### Modified Capabilities

- `creation-mode`: 优化提示词生图主预览液体细流的无缝循环，不改变其他分析模式或生成接口。

## Impact

- 前端动效结构：`public/app.js`、`public/styles.css`。
- 纯函数视觉参数：`lib/preview-loading-shell.mjs` 及同步的 `public/lib/preview-loading-shell.mjs`。
- 验证：预览加载运行时测试、工作台 CSS 契约测试、OpenSpec 严格校验和浏览器视觉复核。
