## Why

套图记录现有批量 Listing 命令只补齐缺失草稿，无法对勾选的已有 Listing 统一重新生成。用户于 2026-11-11 明确要求在“更多”增加“生成 Listing”，无论是否已有 Listing，只要勾选都生成；本提案限定在该已确认范围内。

## What Changes

- 在套图记录“更多”菜单增加“生成 Listing”，使用已有复选框勾选范围，不回退到当前查看记录或全部记录。
- 点击时固定本批勾选记录，有草稿也重新生成；未勾选、无效、重复和正在生成的记录不提交。
- 复用原有批量执行器，保持最多三个工作者、错误隔离、限流停止、进度和操作互斥；失败保留旧草稿。
- 保留现有补缺按钮及单套生成行为，不变更服务端接口、模型配置或 Listing 内容契约。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`：新增按勾选范围生成 Listing 的独立菜单命令。

## Impact

- `public/index.html`、`public/app.js`：菜单入口及引用。
- `lib/creation-listing-view.mjs` 与对应浏览器副本：共用批量执行器和控件状态。
- 新增选中生成回归，覆盖已有草稿、缺失草稿、无勾选、范围快照、并发、失败保留及菜单接线。
