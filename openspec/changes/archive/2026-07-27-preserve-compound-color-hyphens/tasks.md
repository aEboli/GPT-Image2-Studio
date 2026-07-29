## 1. Specification And Regression

- [x] 1.1 更新增量规格，区分复合颜色内部连字符和颜色分隔符。
- [x] 1.2 添加 `off-white` 保留、分隔连字符移除及最终提示回归。

## 2. Minimal Implementation

- [x] 2.1 共享颜色归一化器仅保留已识别颜色 token 内部的单个连字符。
- [x] 2.2 更新参考分析和 SKU 生成提示，允许内部连字符并继续禁止其他标点。
- [x] 2.3 同步 `public/lib` 浏览器镜像。

## 3. Verification And Archive

- [x] 3.1 运行聚焦测试和浏览器镜像检查。
- [x] 3.2 运行全量测试、Pages 构建及全库严格 OpenSpec 验证。
- [x] 3.3 归档变更并确认主规格合并结果。
