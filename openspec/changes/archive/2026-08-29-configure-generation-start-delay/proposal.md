## Why

批量生成时，服务端 `runWithConcurrency` 会给每一次任务领取加一道串行发车闸门，间隔目前是写死在 `lib/limited-concurrency.mjs` 里的常量。这个间隔直接决定套图这类多张任务的整体提交节奏：间隔越小，瞬时打给上游的请求越集中，越容易触发上游限流；间隔越大，最后一张的起跑时间越晚。不同上游的限流宽严差别很大，写死的常量无法让用户按自己的上游情况调整，只能改代码。

## What Changes

- 把批量生成的任务提交间隔变成可配置项，默认 `800ms`，允许 `0`（不排队、尽可能同时提交），上限 `10000ms`。
- 在配置抽屉内新增一个配置卡片，位置在“生成日志”面板之上、连接配置表单的末尾，供用户填写该间隔。该字段不使用原生 `min`/`max`/`step` 约束，否则常见取值会让整个配置表单校验失败并静默阻止保存其他字段；上下界由 JS 收敛。
- 该值随浏览器私有配置持久化，并随生成请求提交给本地服务；服务端对取值做归一化和边界收敛，非法值回落到默认值。
- 服务端把该间隔应用到所有按并发扇出的生成路径：套图生成、套图补图、套图 Logo 批量、写真生成、写真补图。文章插图按串行循环生成，不经过发车闸门，不在本次范围内。
- `runWithConcurrency` 接受可选的发车间隔参数；未传时沿用默认值，既有调用方行为不变。

## Capabilities

### Modified Capabilities

- `runtime-configuration`: 增加“批量生成任务提交间隔”的可配置契约、默认值、边界收敛和跨路径一致性要求。

## Impact

- 常量与归一化：`lib/studio-constants.mjs`、`lib/generation-start-delay.mjs`（新增）及其 `public/lib` 镜像。
- 并发发车闸门：`lib/limited-concurrency.mjs`。
- 配置读写与请求负载：`lib/config-store.mjs`、`lib/browser-config.mjs`、`public/app.js`。
- 配置卡片标记与文案：`public/index.html`、`public/styles.css`、`public/app.js` 的界面语言词典。
- 服务端扇出调用点：`server.mjs`。
- 测试覆盖间隔归一化、发车间隔生效、配置往返和配置卡片位置；不改变并发上限本身和任何模式的任务容量。
