# Design: Listing 重量字段

## Context

规格图和分析备注中的重量可能与长度混在同一组 `dimensionSpecs` 文本中。Listing 的尺寸字段已经有独立的产品/包装证据边界，重量需要复用同一边界但不能把 `g` 或 `oz` 误当作长度。

## Decisions

### Decision 1: 使用独立字段

增加 `packageWeight`、`productWeight`，并在 `zhDisplay` 下增加同名字段。页面、复制文本和导出在产品尺寸之后展示包装重量和产品重量，避免扩大尺寸字符串。

### Decision 2: 证据优先、估计显式

重量来源优先级为显式字段、带包装/毛重或产品/净重标签的规格文本、其他可追溯规格备注。包装重量不得从产品重量冒充；产品重量不得从包装重量倒推。对应证据缺失时使用固定的保守数值，并强制加 `Estimated:` / `预估：` 前缀。

### Decision 3: 读取边界补全

服务端继续在 `GET /api/creation/sets` 的响应边界补全历史稿。生成结果和显式 mock 也在保存前补全，确保页面、复制和导出获得同一组字段。补全不触发模型请求，也不持久化历史稿。

### Decision 4: 单位模式一致

重量沿用 `dimensionUnitMode`：`metric` 只显示 g/kg，`imperial` 只显示 oz/lb，`both` 保留一组公制与英制值。原始证据的数值意义不得改变。
