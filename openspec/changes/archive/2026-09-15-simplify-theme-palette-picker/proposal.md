## Why

主题区当前把七套预设排成横向滚动条，并混入自定义颜色和花卉点缀设置；用户难以一眼比较预设，也无法快速找到所需主题。主题选择应收敛为稳定、直接的预设网格。

## What Changes

- 将主题预设改为每行四项的网格，每项只显示色块和简短名称。
- 将中文预设名称统一为两个字，保留既有预设 ID 和所选预设的本地持久化。
- **BREAKING** 删除自定义颜色、花卉点缀及其 Studio 到 Temu 工作台的同步；旧本地存储值不再影响界面。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `workbench-usability-foundation`: 更新主题预设的布局和显示契约，并移除可选花卉点缀契约。

## Impact

- 影响 Studio 主题卡片、首次渲染状态、样式覆盖、Temu 工作台主题消息和对应回归测试。
- 不改变主题预设的颜色值、预设 ID、深浅主题设置或调用通道配置。
