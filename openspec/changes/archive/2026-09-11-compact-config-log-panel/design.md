## Context

配置抽屉使用一个可滚动 body，表单和日志按文档顺序连续排列。调用通道区包含多个 API/模型字段，长提示文字会增加首卡高度；日志虽只有一个面板，但必须滚动整个抽屉才能到达。

## Decisions

### 1. 复用现有 tooltip

长说明保留在 `data-tooltip` 中，由现有 `bindAppTooltips()` 统一处理悬停、焦点、定位和无障碍 `aria-describedby`。说明标记使用可聚焦元素，避免只支持鼠标。

### 2. 两个内部滚动面

`.config-drawer-body` 继续承载抽屉内容并按两行网格布局：第一行是 `config-form`，第二行是有最小/最大高度的日志面板。表单设置 `overflow: auto`，日志面板内部的 `.timeline-list` 设置 `overflow-y: auto`。这样日志标题、板块切换和未读指示保持稳定，条目增长只影响列表滚动。

### 3. 高度边界

日志面板使用 `clamp(180px, 34svh, 360px)`，同时网格行保留 180px 最小高度。小视口仍可看到日志标题和至少一部分条目，大视口不会占满抽屉；不使用固定像素高度以适应动态浏览器 chrome。

## Risks and Mitigations

- 内部滚动可能让键盘焦点离开当前字段后不明显：保留现有 sticky 操作栏和焦点样式，并让说明标记可键盘聚焦。
- 长 tooltip 可能靠近视口边缘：复用全局 tooltip 的视口边界定位，不在配置区另写定位器。
