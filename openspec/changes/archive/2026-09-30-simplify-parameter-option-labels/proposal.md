## Why

思考等级下拉选项附带预计耗时，分辨率下拉选项附带 `1K`、`1.5K`、`2K`、`2.5K` 或“最大”等档位标签。窄面板中这些附加文字会挤压实际可操作信息，也让分辨率档位与最终像素尺寸混在一起。

## What Changes

- 思考等级选项只显示 `Low`、`Medium`、`High`、`XHigh`。
- 具体像素分辨率选项只显示 `宽 x 高`，继续使用原有像素值作为提交值。
- 套图和写真表单中的静态初始选项与运行时重绘保持相同显示规则。

## Non-Goals

- 不改变思考等级或分辨率的可选值、默认值、请求字段、平台档位或历史记录。
- 不改变 Gemini/模型协议路由使用的 `512`、`1K`、`2K`、`4K` provider scale 值。

## Impact

- `public/app.js`、`public/index.html` 和共享的 `lib/generation-size-options.mjs`（含 `public/lib` 镜像）调整界面标签。
- 相关布局断言与同步检查保持更新。
