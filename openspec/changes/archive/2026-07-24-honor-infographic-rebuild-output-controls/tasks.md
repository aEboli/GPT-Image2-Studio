## 1. Specification And Regression

- [x] 1.1 更新增量规格，定义目标语言、输出格式、分辨率和比例四项允许的输出控制。
- [x] 1.2 更新聚焦测试，复现目标语言被固定提示词忽略的问题，并锁定四项请求参数。

## 2. Minimal Implementation

- [x] 2.1 让信息图重构运行时提示词接收解析后的四项输出控制。
- [x] 2.2 保持 Local、Worker 和 repair 的单张对应原图筛选与结构化参数链不变。

## 3. Verification And Deployment

- [x] 3.1 运行聚焦测试和串行全量测试。
- [x] 3.2 运行公共模块同步、Pages 构建、编码检查、diff 检查和 OpenSpec 严格验证。
- [x] 3.3 重启并验证 `3600` 服务使用新提示词。
