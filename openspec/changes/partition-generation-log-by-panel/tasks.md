## 1. Log Store Model

- [x] 1.1 新增 `lib/generation-log-store.mjs`：channel 归一化（未知归入 `prompt`）、顶层条目与分组条目 upsert、每 channel 保留 12 条顶层行、每组保留 24 条子条目。
- [x] 1.2 实现批次汇总推导：总数与完成/失败/进行中计数，组行状态按“有进行中→进行中，全部完成→完成，有失败且无进行中→失败”。
- [x] 1.3 实现中转 URL 字段：入队时解析写入，后续更新沿用，结果自带地址时覆盖；无地址时不产出 URL 行。
- [x] 1.4 实现持久化序列化与 v1 单数组迁移（归入 `prompt`），损坏内容按空日志起步不抛错。
- [x] 1.5 为 1.1–1.4 增加单测。

## 2. Shared Log Panel Component

- [x] 2.1 新增 `lib/generation-log-panel.mjs`：渲染平铺条目、组行、子条目、折叠控件与空态。
- [x] 2.2 支持 `channel` 为具体板块（不显示板块标签）与 `all`（每行显示板块标签）两种模式。
- [x] 2.3 组行默认折叠，展开状态由调用方传入的内存集合控制，不持久化。
- [x] 2.4 增加面板渲染与折叠交互的单测。
- [x] 2.5 增加日志面板样式：板块切换标签、组行汇总、子条目缩进、URL 行、空态。

## 3. Single-Image Panel Wiring

- [x] 3.1 `recordActivity` 与 `handleActivity*` 带上 channel，并在入队时解析中转 URL。
- [x] 3.2 让失败、取消、排队、进行中条目都携带并显示 URL 行。
- [x] 3.3 配置抽屉日志面板切换到新 store 的 `all` 模式，保留未读指示与滚动锚定。
- [x] 3.4 配置区日志面板加板块切换：默认跟随当前板块，显式选择后以选择为准，另有“全部板块”视图。

## 4. Batch Panel Wiring

- [x] 4.1 为套图新增日志记录函数，接到 `set_started`、`item_started`、`item_status`、`item_saved`、`item_failed` 与批次收尾事件。
- [x] 4.2 为写真、文章插图、PPT 接入同样的按批次分组记录。
- [x] 4.3 确认这四个板块的条目在日志面板切到对应板块时可见。
- [x] 4.4 确认补齐与单图重试写入原批次组行，不新开顶层行。

## 5. Loading Shell Log Line

- [x] 5.1 `lib/generation-loading.mjs` 增加 `.generation-loading-log` 节点与 `logText`、`showLog` 参数，空文本不占位。
- [x] 5.2 `lib/creation-card-loading.mjs` 透传日志文本到套图卡片。
- [x] 5.3 主预览与套图、写真、文章插图、PPT 卡片开启日志行；胶片条与缩略图不开启。
- [x] 5.4 增加进度文本样式：换行完整显示、不截断、空文本不占位。
- [x] 5.5 增加加载组件日志行的单测。

## 6. Verification

- [x] 6.1 同步 `lib` 到 `public/lib` 并跑 `npm run sync:public-lib -- --check`。
- [x] 6.2 跑全量 `npm test`，修正受影响的静态与布局断言。（剩余 19 项失败全部来自 `lib/creation-planner.mjs` / `lib/creation-generation-parameters.mjs` 的既有未提交改写，与本变更无关。）
- [x] 6.3 `openspec validate partition-generation-log-by-panel --strict`。
- [ ] 6.4 浏览器/桌面冒烟：单图板块日志、套图组行折叠展开、失败条目 URL、加载动画日志行。
