## 1. 规格与测试

- [x] 1.1 核对当前 Creation Mode 主规格、活动变更、脏工作树和相关专项测试基线。
- [x] 1.2 定义参数规格图与到手清单/配件图的新行为、兼容边界和验证标准。
- [x] 1.3 增加失败的 planner 与 platform policy 回归测试。

## 2. 实现

- [x] 2.1 保留完整尺寸事实，并为 `spec-table` 选择最多 4 个不同属性的关键规格。
- [x] 2.2 将参数规格图改为商品主导的可视化注释构图，禁止密集纯数据表。
- [x] 2.3 将到手清单/配件图改为包装外拆包平铺，并限制无依据纸盒、纸托和容器。
- [x] 2.4 更新平台图片类型构图并同步浏览器策略副本。

## 3. 验证与归档

- [x] 3.1 运行 planner、platform policy 和 public/lib 同步专项测试。
- [x] 3.2 运行完整 `npm test`、Pages 构建、OpenSpec strict validation 和中文乱码扫描。
- [x] 3.3 将增量规格合并回 `openspec/specs/creation-mode/spec.md` 并归档本变更。
