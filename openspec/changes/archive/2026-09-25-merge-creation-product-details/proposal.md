# 合并套图商品信息输入

## Why

创建套图时，商品描述、核心卖点和尺寸规格占用了三个连续输入框。合并后可减少左侧表单高度，同时仍保留商品事实和可识别尺寸信息。

## What Changes

- 将三个输入框合并为一个“商品描述”多行输入框，并沿用原商品描述输入框的高度和占位文案。
- 将旧记录中的商品描述、卖点和尺寸规格合并展示，复用记录时不丢失已有内容。
- 从合并后的文本中继续提取可识别的尺寸数据，供尺寸和规格图片使用。

## Impact

- Affected spec: `creation-mode`
- Affected code: Creation Mode form, browser form submission and queued-set construction.
- No persisted manifest schema or API contract changes.
