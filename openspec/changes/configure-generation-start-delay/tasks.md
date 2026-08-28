## 1. 规格与边界

- [x] 1.1 明确默认 `800ms`、允许 `0`、上限 `10000ms`，以及非法输入收敛而不使请求失败。
- [x] 1.2 明确控件位置在“生成日志”面板之上，且该间隔不改变并发上限与任务容量。

## 2. 常量与归一化

- [x] 2.1 在 `lib/studio-constants.mjs` 增加默认值与上下界常量。
- [x] 2.2 新增 `lib/generation-start-delay.mjs`，提供归一化与从请求/配置解析的函数，并同步到 `public/lib`。
- [x] 2.3 让 `runWithConcurrency` 接受可选发车间隔，未传时使用默认值。
  - 间隔为 `0` 时直接跳过发车闸门，不再经过 Promise 链排队。

## 3. 配置读写

- [x] 3.1 `lib/config-store.mjs` 持久化并在公共配置中暴露该值。
- [x] 3.2 `lib/browser-config.mjs` 在私有配置、请求负载和 FormData 中带上该值。
  - 保存时区分“字段缺失”与“显式 0”：缺失沿用已存值，`0` 正常覆盖。
- [x] 3.3 `public/app.js` 读取控件、写入请求负载、保存后回显。

## 4. 服务端扇出

- [x] 4.1 套图生成、套图补图、套图 Logo 批量、写真生成、写真补图五处 `runWithConcurrency` 使用归一化后的间隔（文章插图为串行循环，不涉及）。

## 5. 界面

- [x] 5.1 在配置表单末尾、“生成日志”面板之上新增配置卡片与数字输入，带标签、单位与默认值说明。
  - 该字段不使用原生 `min`/`max`/`step` 约束：Electron 探针实测 `step="100"` 会让 `850`、`1250` 触发 `stepMismatch`，`min="0"` 会让手输负数触发 `rangeUnderflow`，任一情况都会使整个配置表单校验失败并静默阻止保存 API Key 等其他字段。改为 `step="any"`，上下界写进 `data-min-delay-ms`/`data-max-delay-ms`，由 JS 在字段 `change` 和保存时双重收敛。
- [x] 5.2 补齐中英界面文案。

## 6. 验证与交付

- [x] 6.1 新增/更新测试：间隔归一化边界、发车间隔生效、配置往返、控件位置与顺序。
  - 新增 `test/generation-start-delay.test.mjs`（10 项）；同步更新 `test/limited-concurrency.test.mjs`、`test/config-store.test.mjs`、`test/browser-shell-modules.test.mjs` 中依赖旧默认值或精确配置形状的断言。
- [x] 6.2 运行 `node scripts/sync-public-lib.mjs --check`、`node --check public/app.js`、`node --check server.mjs`、`git diff --check` 和完整 `npm test`。
  - `sync-public-lib --check` 检查 100 个公共模块通过；语法检查与 `git diff --check` 均通过。
  - 完整 `npm test`：`1779` 项中 `1760` 通过、`19` 失败。这 19 项在本次改动前的同一工作区基线上同样失败（基线 `1769` 项中 `1750` 通过、`19` 失败），全部为提示词文案断言，与本次改动无关。
- [x] 6.3 运行 `openspec validate configure-generation-start-delay --strict --no-interactive`。
  - 通过。
- [x] 6.4 Electron 探针人工验收：控件位于生成日志之前、默认回显 `800`、`0` 与非默认值往返保存并在重载后保留、越界与负数在保存时收敛为 `10000`/`0`、该值进入生成请求的 FormData 字段。
