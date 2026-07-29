## 1. Specification And Regression

- [x] 1.1 建立 proposal、design、增量规格和任务，定义字段顺序与真实/预估边界。
- [x] 1.2 增加严格 Schema、提示、来源判定、接受边界和双语规范化失败回归。
- [x] 1.3 增加页面末尾顺序、单字段复制、整条复制和导出失败回归。

## 2. Minimal Implementation

- [x] 2.1 在共享 Listing 结构、提示、规范化、清理和验证中加入两个尺寸字段。
- [x] 2.2 将产品尺寸证据和包装尺寸证据分开传入生成来源，并要求缺失项显式预估。
- [x] 2.3 在 Listing 页面、整条复制和 JSON 导出末尾追加包装尺寸与产品尺寸。
- [x] 2.4 同步 `public/lib` 浏览器镜像。

## 3. Verification And Archive

- [x] 3.1 运行 Listing Agent、Listing 视图、运行时一致性和静态布局聚焦测试。
- [x] 3.2 运行全量测试、Pages 构建、同步检查和全库严格 OpenSpec 验证。
- [x] 3.3 检查本次中文 UTF-8、异常替换字符和差异格式。
- [x] 3.4 归档变更并确认主规格已合并。
