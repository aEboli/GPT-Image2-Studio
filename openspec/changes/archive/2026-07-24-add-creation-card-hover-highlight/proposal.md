## Why

Creation Mode 的当前结果卡片和历史结果卡片只有静态边框。卡片排列密集时，鼠标指针所在卡片缺少明确的视觉定位反馈，容易与相邻结果混淆。

## What Changes

- 鼠标移入 Creation 结果卡片时，卡片四周显示橙色描边和柔和光晕。
- 鼠标移出后恢复原有静态边框，并使用短时过渡避免突变。
- 卡片内部获得键盘焦点时复用同一高亮，且高亮不改变卡片尺寸或网格布局。

## Capabilities

### Modified Capabilities

- `creation-mode`: 为当前结果与历史结果卡片增加一致的橙色悬停反馈。

## Impact

- Affected stylesheet: `public/styles.css`。
- Affected tests: `test/studio-preview-layout.test.mjs`。
- 不修改 DOM、数据、接口、生成逻辑或持久化结构。
