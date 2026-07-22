## 1. 复现与规格

- [x] 1.1 从当前 `3600`、目标 manifest 和生成图片确认标题未变化的真实原因。
- [x] 1.2 明确空手填卖点时套图 `conversionIntent` 的证据边界，并同步增量规格与设计。
- [x] 1.3 增加失败测试，固定标题证据提取、objection 排除和无冲突 prompt。

## 2. 实现

- [x] 2.1 在 Listing source 中增加有界、去重的 `titleValueEvidence`。
- [x] 2.2 调整平台 V1 prompt，使标题价值规则与非标题功能词禁令不再冲突。
- [x] 2.3 保持旧式字段、固定五点、单次请求、高风险门禁和确定性回退不变。

## 3. 验证与归档

- [x] 3.1 运行 Listing source/agent 定向测试和相关回归测试。
- [x] 3.2 运行完整测试、public lib 同步检查、Pages 构建、OpenSpec strict validation、diff/中文乱码检查。
- [x] 3.3 重启 `3600`，通过实际 Listing HTTP 路径重新生成目标记录，确认新标题持久化并在页面显示。
- [x] 3.4 将增量规格合并回主规格并归档本变更。
