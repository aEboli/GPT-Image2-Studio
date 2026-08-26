## 1. 规格与边界

- [x] 1.1 确认中途预览覆盖单一 `previewUrl`、失败路径经 `removeJob` 丢弃预览、服务端 `partialImages` 无调用方。
- [x] 1.2 确认 `retrying_upstream` 状态已透传到浏览器，且 `requestRetryCount` 属连接前重连不产生卡。
- [x] 1.3 补充 proposal、design 与两份增量规格，定义追加、原地展开、失败保留、会话生命周期与另存能力。

## 2. 前端卡组状态

- [x] 2.1 新增会话级卡组映射与尝试模型（`lib/prompt-attempt-deck.mjs`），键为预览键，不写入 `state.jobs`，不持久化。
- [x] 2.2 在 `partial_image`、`final_image`、`final_image_chunk` 事件中就地更新当前尝试卡，同一尝试只保留最新预览。
- [x] 2.3 在收到 `retrying_upstream` 状态时封存当前尝试为未完成并追加新尝试卡。
- [x] 2.4 统一 error、流中断未收到终止事件、异常三条收尾路径：有图则保留卡组并标记未完成，无图则完全清除。
- [x] 2.5 保存成功后把卡组键从任务预览键改写为画廊预览键，使成功图片槽位仍可展开历史尝试。
- [x] 2.6 实施内存上限：终态卡组最多 6 个并按更新时间淘汰最早项。
- [x] 2.7 失败活动记录带上最后一张预览作为缩略图。

## 3. 前端渲染与交互

- [x] 3.1 胶片条槽位在卡组两张以上时渲染卡数角标，单卡时保持现状且不显示角标。
- [x] 3.2 角标实现为按钮并维护 `aria-expanded`/`aria-controls`，展开区在槽位内原地渲染各尝试缩略图。
- [x] 3.3 选择展开区某张卡时切换主预览；未完成卡渲染可见的未完成标记。
- [x] 3.4 展开区可聚焦控件不置于 `aria-hidden="true"` 祖先之下（展开区为槽位内兄弟节点，未使用 `aria-hidden` 包裹）。
- [x] 3.5 补充卡组与展开态样式，并更新 `public/index.html` 静态资源版本参数。
- [x] 3.6 失败任务离开 `state.jobs` 后，其卡组作为独立胶片条条目继续展示。

## 4. 服务端另存能力

- [x] 4.1 新增 `POST /api/prompt-preview/save` 路由，置于 `routeRequest` 认证之后以继承本地服务安全校验。
- [x] 4.2 以独立 `maxBytes`（32 MiB）读取请求体，超限返回 413。
- [x] 4.3 服务端生成文件名，忽略客户端传入的文件名或路径；经既有图像校验后落盘并写入画廊索引与 sidecar。
- [x] 4.4 在 `normalizeStoredMetadata` 白名单与 `listGalleryItems` 投影中新增 `previewOrigin` 并标记为未完成预览另存。
- [x] 4.5 前端接入另存操作，成功后并入画廊并让该卡反映已另存，避免重复另存产生重复文件。
- [x] 4.6 经 `npm run sync:public-lib` 保持 `lib/` 与 `public/lib/` 一致。

## 5. 验证

- [x] 5.1 前端回归：重试追加不覆盖、同尝试就地更新、失败有图保留、失败无图不留空卡、单卡路径不显示角标、卡组不持久化、成功后仍可展开历史尝试、终态卡组淘汰上限（`test/prompt-attempt-deck.test.mjs`、`test/prompt-attempt-deck-integration.test.mjs`）。
- [x] 5.2 服务端回归：正常另存落盘与索引、非法图像拒绝且不落盘、缺图拒绝、超限请求体拒绝、客户端文件名不影响落盘位置、另存不产生生成任务（`test/prompt-preview-save-server.test.mjs`）。
- [x] 5.3 运行 `npm test`（1665 通过 / 0 失败）、OpenSpec 严格校验、公共库同步检查与 `git diff --check`。
- [ ] 5.4 在隔离端口人工确认角标展开、未完成标记与另存后画廊可见。未执行：需要真实 API Key 触发上游自动重试才能产生两张卡的卡组，当前环境未配置。另存与落盘路径已由 5.2 端到端覆盖。
