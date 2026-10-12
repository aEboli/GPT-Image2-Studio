## Why

点击“下载所选”后，采集窗在后台完成提交前没有运行状态；下载按顺序提交，单张提交失败会中止整批，用户也无法确认哪些图片已加入浏览器下载队列。

## What Changes

- 为批量图片下载增加有界并发，每张图片独立提交并统计成功数、失败数和首个错误。
- 下载期间在采集窗状态行显示忙碌文案和轻量动态反馈，并在操作结束后恢复状态。
- 将商品图采集插件版本更新为 `1.1.34`。

## Non-Goals

- 不改变商品图来源、选择规则、下载目录和文件命名。
- 不追踪浏览器下载队列中的传输完成状态；成功表示已提交到浏览器下载队列。

## Impact

- `extensions/product-image-collector/service-worker.mjs`
- `extensions/product-image-collector/floating-panel.js`
- 商品图采集扩展版本链和打包产物
- `product-image-collector` 规范
