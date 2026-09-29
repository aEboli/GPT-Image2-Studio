# 任务

- [x] 1.1 更新套图结果详情的增量规范。
- [x] 1.2 让标准套图结果预览显示实际提示词和严格读取的参数快照。
- [x] 1.3 添加工作区预览回归断言并运行聚焦验证。

## 验证

- `node --test test/creation-queue-lightbox.test.mjs test/creation-record-lightbox.test.mjs test/creation-record-legacy-export-isolation.test.mjs`：6 项通过。
- `node --test --test-name-pattern='creation result card images open the lightbox from the thumbnail|creation record cards open gallery-style lightbox details' test/studio-preview-layout.test.mjs`：2 项通过。
- `node --check public/app.js`、`npm run sync:public-lib -- --check`、OpenSpec 严格校验和 `git diff --check` 通过。
