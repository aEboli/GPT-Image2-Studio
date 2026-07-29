## Why

Creation Mode 结果卡片已经在鼠标悬停时显示橙色边框，但鼠标长时间停留后该反馈保持静态，不能周期性提醒用户当前指针定位的卡片。

## What Changes

- 鼠标停留在当前或历史 Creation 结果卡片且连续 30 秒未移动时，橙色外框向外扩散一圈并淡出。
- 鼠标继续不动时，每隔 30 秒重复一次；任意指针移动都会立即取消本轮动效并重新完整计时。
- 涟漪只使用绝对定位的伪元素，不改变卡片尺寸、网格位置或相邻布局。
- 系统启用“减少动态效果”时不显示涟漪动画。

## Capabilities

### Modified Capabilities

- `creation-mode`: 在现有橙色悬停反馈上增加空闲涟漪提醒。

## Impact

- Affected frontend: `public/app.js`、`public/styles.css` 和新增的空闲计时控制器。
- Affected tests: 新增控制器计时测试与样式/接线契约测试。
- 不修改接口、生成逻辑、持久化结构或卡片内容。
