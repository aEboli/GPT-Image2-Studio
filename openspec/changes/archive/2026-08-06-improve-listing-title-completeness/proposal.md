## Why

Listing 标题生成目前把长度目标只交给模型遵循，并在取得可用 JSON 后直接接受短标题。因此，即使来源已经提供足够的商品事实，模型偶尔提前结束时仍会保存信息不足的标题。SKU 图的新计划虽已开始使用安全短标识，但浏览器队列与落盘链路尚未完整保留该标识。

## What Changes

- 在平台硬标题上限内，对明显短于平台建议下限的中英文标题使用同语言、已清理的 Listing 内容作确定性补全。
- 只复用响应中已经通过品牌、声明、货号和证据清理的词句；证据不足时允许保留较短标题，不填充猜测事实。
- 继续接受第一份可用模型响应，不增加模型重试、失败门禁或历史记录迁移。
- 队列 SKU 项生成与 planner 相同的安全 `filenameToken`，浏览器规范化时保留该字段，使本地和 Worker 落盘均不回退到货号来源。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-listing-agent`: 新生成或重新生成的 Listing 在有安全内容可复用时补全过短标题，同时继续排除内部货号。
- `creation-mode`: 新队列与浏览器生成链路必须保留安全 SKU 文件名短标识，避免落盘回退到 SKU 标题、ID 或参考文件名。

## Impact

- `lib/creation-listing-agent.mjs` 的标题后处理。
- `lib/creation-suite-queue.mjs`、`public/app.js` 与同步的 `public/lib` 模块。
- Listing、Creation 队列、浏览器状态与服务端文件名相关回归测试。
- 不修改公开 Listing JSON 字段，不迁移历史标题、历史计划或历史图片文件。
