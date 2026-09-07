## Why

`Gemini模型`（`imageRoute` 为 `c`）通道只接受 10 个比例：`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9`。界面提供 15 个，多出的 `9:21`、`2:1`、`1:2`、`3:1`、`1:3` 不在其中。

`getGeminiImageAspectRatio(size, aspectRatio)` 在比例不受支持时会尝试从 `size` 反推宽高，再按对数距离就近匹配。但该通道的 `size` 是档位字符串（`512`、`1K`、`2K`、`4K`），`getImageSizeDimensions("1K")` 返回 `null`，于是函数直接返回 `1:1`。

结果是这五个比例在该通道上静默变成方图。已用全部 15 个比例实测确认：

```text
selected 9:21 → sent 1:1      selected 2:1 → sent 1:1
selected 1:2  → sent 1:1      selected 3:1 → sent 1:1
selected 1:3  → sent 1:1
```

同时提示词仍然携带原始比例的中文描述（`appendRatioHintToPrompt`），所以模型收到的画面要求与结构化比例参数互相矛盾：用户请求超宽横幅，得到的是方图。就近匹配所需的信息其实就在比例字符串本身，只是当前实现只肯从 `size` 里取。

## What Changes

- `getGeminiImageAspectRatio` 在请求比例不受支持且 `size` 无法解析出宽高时，改为从比例字符串自身（`W:H`）取得比值，再沿用既有的对数距离就近匹配，选出受支持比例中方向和长宽比最接近的一个。
- 只有在比例字符串也无法解析出正数宽高时（缺失、空串或非法格式），才保留返回 `1:1` 的兜底。
- `size` 能解析出宽高时的行为不变，仍优先使用 `size` 推导的比值。
- 受支持的 10 个比例继续原样透传，不受影响。

按该规则，五个此前塌缩为方图的比例将保留方向：`2:1` 与 `3:1` 映射到最接近的横向比例，`1:2`、`9:21`、`1:3` 映射到最接近的纵向比例。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `runtime-configuration`: 新增一条要求，约束 Gemini 通道在比例不受支持时的降级方向，使其保留请求的画面方向而不是无条件返回 `1:1`。

## Impact

- Code: `lib/responses-workflow.mjs` 的 `getGeminiImageAspectRatio`；同步镜像 `public/lib/responses-workflow.mjs`（若在同步清单内）。
- Existing behavior: 受支持比例、`size` 可解析宽高时的推导、档位（`imageSize`）解析、请求体结构和端点选择均不变；路由 A/B 完全不受影响。
- Docs: 两份 README 中「Gemini 生图路径只支持 10 个比例」的描述需要从「发送 `1:1`」更新为「按方向就近匹配」。
- Tests: 需覆盖五个不受支持比例在档位 `size` 下的映射结果、受支持比例的透传、`size` 可解析时优先使用 `size`，以及比例字符串非法时仍回落 `1:1`。
