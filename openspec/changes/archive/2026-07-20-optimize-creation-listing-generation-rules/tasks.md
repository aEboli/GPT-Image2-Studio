## 1. 规格与测试

- [x] 1.1 增加新 Listing 提示词和平台适配的失败测试。
- [x] 1.2 增加证据支持收益保留、高风险声明回退的失败测试。

## 2. 实现

- [x] 2.1 用 evidence-bounded 平台 Listing 提示词替换 V1 旧模板。
- [x] 2.2 增加仅针对高风险声明的 V1 结果门禁，放行证据支持的 functional wording。
- [x] 2.3 保持旧式双语字段、无品牌净化、fallback 和 V2/legacy 兼容行为。

## 3. 验证

- [x] 3.1 运行定向 Listing 与 parity 测试。
- [x] 3.2 运行完整测试、public/lib 同步检查和 Pages 构建。
- [x] 3.3 运行 OpenSpec strict validation 并归档变更。
