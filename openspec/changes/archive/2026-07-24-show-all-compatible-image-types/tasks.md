## 1. Specification And Reproduction

- [x] 1.1 记录当前兼容图片类型截断路径及相关脏工作树边界。
- [x] 1.2 增加完整目录、启用生成项和平台边界的增量规格与设计。
- [x] 1.3 增加失败回归，复现通用电商选择 5 张时只保留 5 个槽位的问题。

## 2. Minimal Implementation

- [x] 2.1 修改套图数量覆盖，使其保留当前平台完整槽位并禁用数量范围外的项目。
- [x] 2.2 同步 `public/lib` 浏览器镜像，不修改无关平台策略或 UI。
- [x] 2.3 覆盖 0、5、18 张以及先取消再启用第 18 类的等量替换流程。

## 3. Verification And Archive

- [x] 3.1 运行 resolver、planner、浏览器状态和 Creation 端到端定向测试。
- [x] 3.2 运行串行完整测试、public-lib 同步检查和 Pages 构建。
- [x] 3.3 在本地界面验证通用电商选择 5 张时显示 `5 / 18` 和完整 18 项。
- [x] 3.4 运行 OpenSpec strict validation，归档本变更并再次验证主规格。
