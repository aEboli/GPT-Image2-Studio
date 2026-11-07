## Why

现有 SKU 生成规则提供颜色、清单和尺寸展示，缺少在纯净白底上表现产品功能效果的选项。普通 SKU 背景受视觉风格影响，不能确保此用途始终使用纯白背景。

## What Changes

- 在现有 SKU 生成规则下拉框新增“SKU 渲染效果白底图”，内部值为 white-effect-render，保留原默认规则。
- 保持匹配 SKU 的商品外观、可售单元和数量，用局部、适量的立体效果呈现资料或参考图支持的功能；没有功能依据时仅表现材质和体积。
- 背景固定为纯白 RGB 255/255/255，允许自然接触阴影；不添加生活场景、渐变背景、道具、色名标签、清单、尺寸标注或营销文案。保留商品实体原有印字。
- 新规则在预览、提交、队列、记录恢复与补图中保持一致；普通轮播和其他 SKU 规则保持现有行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- creation-mode: 新增 SKU 功能效果白底渲染规则。

## Impact

- public/index.html 与 public/app.js 的规则选项和标签识别。
- lib/creation-planner.mjs 的 SKU 规则归一化、功能依据和背景提示词。
- 针对规划、表单、冻结计划、记录和补图的回归验证。
