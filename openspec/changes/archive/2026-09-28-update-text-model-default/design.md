# 设计

文本模型当前由 `lib/model-defaults.mjs` 集中提供默认值，`DEFAULT_DIRECT_RESPONSES_MODEL` 与 `DEFAULT_RESPONSES_MODEL` 共用同一值，浏览器端通过同步镜像读取。

只需更新共享常量及面向新配置的静态提示和文档示例。配置归一化仍将共享默认值用于缺失或空值；非空保存值、环境变量和请求值继续优先，不做迁移覆盖。
