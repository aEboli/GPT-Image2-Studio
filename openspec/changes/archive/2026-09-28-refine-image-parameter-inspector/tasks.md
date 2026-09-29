# Tasks

- [x] 1.1 更新 `lightbox-image-viewer` 增量规范，明确参数列布局、记录开关和路径显示边界。
- [x] 1.2 为浏览器缓存中的工具传输与流传输字段增加显式布尔归一化。
- [x] 1.3 为 Creation 生成快照记录固定的不透明背景。
- [x] 1.4 补充参数格式化、缓存归一化、Creation 快照及详情布局回归测试。
- [x] 1.5 运行聚焦测试、浏览器模块同步检查、语法检查、严格 OpenSpec 校验和 `git diff --check`。
- [x] 1.6 将增量规范合并到主规范并归档已完成的 change。

## Verification

- `node --test test/studio-formatters.test.mjs test/creation-record-lightbox.test.mjs test/gallery-metadata-recovery.test.mjs test/gallery-store.test.mjs test/browser-image-cache.test.mjs`：49 项通过。
- Lightbox 布局聚焦测试：1 项通过。
- `node --check server.mjs`、`node --check public/app.js`、`npm run sync:public-lib -- --check`、严格 OpenSpec 校验和 `git diff --check` 均通过。
