## 1. 声明表与回归测试

- [x] 1.1 新增 `scripts/version-facts.mjs`，声明按文件划分的派生版本事实模板，并提供渲染、漂移检测和替换函数。
- [x] 1.2 补测试：锚定事实正确但徽章落后时，`check:release` 必须失败并报出文件、行号与期望文本。
- [x] 1.3 补测试：文件不含某模板时该模板不施加约束。
- [x] 1.4 补测试：替换不得波及以当前版本为前缀的更长版本号（`v1.2.30`）、tag 示例与历史散文。
- [x] 1.5 补测试：`release:patch` 同时更新锚定事实与派生事实，且更新后的树能通过 `check:release`。

## 2. 接入两个命令

- [x] 2.1 `check-release-readiness.mjs` 在既有锚定校验之后执行派生事实校验，缺失文件按既有语义跳过。
- [x] 2.2 `release-patch.mjs` 在锚定替换之后按同一张表改写派生事实，并在写入前复验无残留旧版本。
- [x] 2.3 保持既有事务、回滚、清理语义与扩展独立版本线不变。

## 3. 验证

- [x] 3.1 运行 `test/version-facts.test.mjs`、`test/project-maintenance.test.mjs`、`test/app-version.test.mjs`、`test/release-patch-transaction.test.mjs`。
- [x] 3.2 用真实仓库文件验证：把 README 徽章临时改回上一版本，确认 `check:release` 失败并准确定位，随后恢复。
- [x] 3.3 运行 `npm test`、`npm run sync:public-lib -- --check`、`npm run check:release`、`npx --no-install openspec validate --all --strict`、`git diff --check`。
