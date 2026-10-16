# 设计

在现有 parameter-meta 网格中，紧接 parameterRequestIp 放置 `Url :` 标签和地址值。updateGenerationModeStatus 使用 getSelectedImageGenerationConfig 返回的 baseUrl 和 endpointPath，通过 appendApiEndpointPath 生成完整 URL，不读取 API Key。地址输入或协议后缀修改后复用该摘要刷新函数。

直连和 Grok 的图像接口根据参考图数量切换 generations/edits，参考图增删时刷新摘要。Gemini 图像模型使用 images/generations；该通道的其他模型按现有服务端规则显示 chat/completions。协议后缀的摘要监听放在现有地址归一化监听之后，以兼容完整 URL 输入模式。

验收以实际执行摘要函数的检查为准，覆盖路由、直连、Gemini、Grok，以及完整地址模式和地址切换；最后执行项目检查并归档规格。

验证结果：10 个摘要函数场景、248 项现有相关测试、浏览器页面位置与自动换行检查、JavaScript 语法检查、共享模块同步检查和发布一致性检查均通过。
