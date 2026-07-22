## 1. 基线与失败测试

- [x] 1.1 核对当前 Creation record 规格、活动变更、存储目录、Local/Worker 路由和脏工作树边界。
- [x] 1.2 增加 Creation store 失败测试，覆盖单套/多套删除、图片与 sidecar 目录清理、幂等未命中、ID 精确匹配和路径越界保护。
- [x] 1.3 增加 API 契约与 Local/Worker 路由失败测试，覆盖有效批量、空数组、去重和 Cloudflare 幂等响应。
- [x] 1.4 增加浏览器静态回归测试，覆盖单删、勾选批量、非空筛选批量、完整筛选集合、确认对话框和删除后状态清理。

## 2. 存储与 API

- [x] 2.1 在 `creationSetStore` 中实现与保存队列串行的精确 ID 删除，安全删除 manifest、专属图片目录和 JSON sidecar 目录。
- [x] 2.2 增加 Local `POST /api/creation/sets/delete` handler，校验并去重 `setIds`，返回删除与未命中 ID。
- [x] 2.3 增加 Cloudflare 无服务端记录的幂等删除响应，并同步 API runtime capability。

## 3. 套图记录交互

- [x] 3.1 增加每条记录独立 checkbox 与勾选状态，保持详情单选行为不变。
- [x] 3.2 增加删除当前、删除选中和删除筛选结果按钮，按生成/计划/删除状态和目标可用性同步禁用。
- [x] 3.3 增加应用内模态确认对话框，显示删除模式、目标套数、单套名称或筛选词及永久删除范围。
- [x] 3.4 实现批量请求、成功反馈、勾选/详情/currentSet 清理与服务端列表刷新。
- [x] 3.5 补齐桌面、平板和移动端列表复选框、工具栏与确认对话框样式。

## 4. 验证与归档

- [x] 4.1 运行 Creation store、API contract、Worker、server static 和记录页定向测试。
- [x] 4.2 运行完整 `npm test`、`npm run sync:public-lib -- --check` 与 `npm run build:pages`。
- [x] 4.3 运行 OpenSpec strict validation、中文 UTF-8/乱码扫描和 `git diff --check`，明确报告任何遗留警告。
- [x] 4.4 启动本地服务，通过真实浏览器验证单删取消、单删确认、勾选批量和按筛选删除的目标与响应式布局。
- [x] 4.5 将增量规格合并回 `openspec/specs/creation-mode/spec.md`，归档变更并复验主规格。
