## Why

统一后的生图加载水滴在整个过程中只用一种强调色，用户只能靠百分比数字判断进展。水体颜色既不体现当前请求真正处于哪个阶段（准备请求 / 连接服务 / 生成画面 / 取回重试 / 写入本地），也不体现推进程度，扫一眼时「刚连上」和「快写盘」看起来完全一样。

## What Changes

- 水体颜色由两个维度合成：**色相表达真实请求阶段**，**深浅表达百分比推进**。
- 色相族直接取自既有 `statusStage`，与界面上已显示的状态文字同源，不另造一套阶段名：
  - `queued` → 灰蓝；`uploading` → 青；`connecting` → 蓝；`generating` → 紫；
  - 取回与重试一组（`waiting_upstream`、`waiting_final`、`retrying_upstream`、`missing_final_recovery`、`fallback_final_image`、`recovering_original`、`waiting_original`、`recovery_unavailable`）→ 琥珀；
  - `saving` → 绿；`error`、`failed`、`original_failed` → 红。
- 百分比越高液体越深，所以在 `generating` 这种长阶段内部也能看出推进。
- 加载组件新增可选 `stage` 入参，并在 DOM 暴露 `data-generation-loading-stage` 与 `data-generation-loading-family`；调用点缺省时保留上一次已知阶段，未知阶段按生成族显示、等待态按排队族显示，不猜测更靠后的阶段。
- 阶段切换时色相与饱和度平滑插值而不是硬切；浅色主题整体压低亮度以保证与白底的对比度。
- 等待态不再自带一套灰色取色，改由排队色相族统一负责，避免两套取色互相覆盖。
- 不改变百分比时序、`99%` 上限、等待态语义、共享 key 复用、计时器清理和减少动态效果的降级行为。

## Capabilities

### Modified Capabilities

- `generation-loading`: 在既有统一加载组件上，按真实请求阶段区分水体色相，并按百分比区分深浅。

## 验收边界

- 色相族必须来自既有 `statusStage` 取值，不得引入不对应任何真实阶段的自造阶段名。
- 颜色只表达阶段与推进程度，不改变百分比含义，也不冒充真实 API 进度。
- 调用点未提供阶段时不得把颜色退回默认族，避免重渲染时颜色跳变。
- 百分比推进间隔、`99%` 封顶、等待态不显示百分比这些既有行为保持不变。
- 深浅两种主题下水体与背景保持可辨识的对比度。

## Impact

- 共享模块：`lib/generation-loading.mjs`、`lib/creation-card-loading.mjs` 及同步的 `public/lib`。
- 调用点：`public/app.js` 的胶片条、提示词预览、套图卡片、文章插图入口透传 `statusStage`。
- 样式：`public/styles.css` 的生图加载组件配色。
- 测试：阶段到色相族映射、缺省与未知阶段回退、DOM 阶段属性、CSS 双维度取色契约。
- 不改变生成 API、队列调度、任务持久化或图片结果数据。
