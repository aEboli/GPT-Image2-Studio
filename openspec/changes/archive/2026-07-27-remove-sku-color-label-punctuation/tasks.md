## 1. Specification And Regression

- [x] 1.1 更新 Creation Mode 增量规格，明确颜色标签只允许颜色词与空格。
- [x] 1.2 添加多颜色、连字符颜色、分组顺序、重复标签和最终提示无标点回归。

## 2. Minimal Implementation

- [x] 2.1 共享颜色归一化器以空格连接颜色并清除颜色片段中的标点。
- [x] 2.2 SKU 载荷和规划器派生字段不再使用标点连接颜色。
- [x] 2.3 参考分析及最终生成提示明确禁止颜色标签标点，并移除准确标签周围的引号和列表标点。
- [x] 2.4 同步 `public/lib` 浏览器镜像。

## 3. Verification And Archive

- [x] 3.1 运行聚焦 SKU、规划器、提示代理测试及浏览器镜像检查。
- [x] 3.2 运行串行全量测试、Pages 构建和严格 OpenSpec 验证，并复查中文编码和最终差异。
- [x] 3.3 归档变更并确认增量规格已合并到主 `creation-mode` 规格。
