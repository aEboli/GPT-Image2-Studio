# Change: 在 Listing 尺寸区补充重量

## Why

Listing 当前底部只展示包装尺寸和产品尺寸。Creation 的规格来源同时支持 `g`、`kg`、`oz` 和 `lb` 等重量值，但重量没有独立的展示、复制和导出字段，买家无法在 Listing 底部核对重量。

## What Changes

- 在 Listing 底部增加 `packageWeight`、`productWeight` 及其 Simplified Chinese 对照字段。
- 优先读取明确标注的包装/毛重和产品/净重；没有对应证据时提供带 `Estimated:` / `预估：` 的保守数值。
- 历史完成稿读取时非持久化补全重量，不改写磁盘中的旧稿。
- 复制、完整文案和结构化导出包含重量字段；标题继续禁止重量值。

## Capabilities

### Modified Capabilities

- `creation-listing-agent`: Listing 双语契约、重量证据和历史稿回读。

## Impact

- 受影响代码：Listing 来源重量提取、生成结果补全、历史记录 GET、Listing 视图与导出。
- 保持现有包装尺寸、产品尺寸字段和部件尺寸回读行为不变。
