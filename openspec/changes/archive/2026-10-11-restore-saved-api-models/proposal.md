## Why

API 历史仅记录地址、协议后缀和 Key。用户为不同 API 保存不同模型后，切换 API 仍保留上一个 API 的模型，容易把不受支持的模型发给新上游。用户已明确要求切换时恢复该 API 最后保存的模型。

## What Changes

- 在各通道的本地 API 历史条目中记录最后保存的模型，路由通道同时记录 Responses 模型和生图工具模型。
- 选择已保存 API 时回填所属通道的模型，并刷新模型列表选中态、生成模型信息和质量选项。
- 模型变更在保存配置时记入历史；仅选择 API 或修改未保存模型不覆盖历史中的模型。
- 兼容没有模型字段的旧历史条目：保留当前模型；加载已有私有配置时为当前 API 补上已保存模型。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `configuration-usability`: 按通道恢复 API 最后保存的模型，保持历史条目与其他通道隔离。

## Impact

- 修改 `lib/api-endpoint-book.mjs`、`lib/api-endpoint-book-picker.mjs`、`public/app.js` 及对应 `public/lib` 镜像。
- 补充 `test/api-endpoint-book.test.mjs` 的存储与切换回归用例。
- 沿用本地历史的存储键和地址 + Key 身份规则，无新增依赖和服务端配置字段。
