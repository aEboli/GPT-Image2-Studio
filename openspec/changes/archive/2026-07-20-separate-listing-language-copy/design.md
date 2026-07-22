## Context

Creation Listing 页面现在将字段值显示为英文正文加中文参考，并把字段标题配置为一个中英双语复制按钮。事件委托已经支持任意带 `data-creation-listing-copy-text` 的目标，因此本变更只需细化渲染目标与复制载荷，并同步 `lib` 到 `public/lib`。全量 Listing 复制和 JSON 导出由独立控制器负责，不应改变。

## Goals / Non-Goals

**Goals:**

- 让每个可见英文值和中文参考都有独立、可访问的按钮复制目标。
- 复制目标的文本只来自其自身语言，且列表项按单条信息点复制。
- 保留字段标题的英文整字段复制、全量 Listing 双语复制和现有反馈状态。
- 保持现有数据模型、事件委托、浏览器同步机制和导出契约不变。

**Non-Goals:**

- 不修改 Listing 生成提示词、归一化、持久化、API 或导出格式。
- 不删除中文参考展示，也不改变字符统计或字段顺序。
- 不新增第三方依赖或重写复制基础设施。

## Decisions

### 1. 在渲染层创建语言独立复制目标

`createCreationListingField` 为每个英文行创建 `creation-listing-value-copy` 按钮，为存在的中文行创建 `creation-listing-localized` 按钮，并分别写入独立的复制数据。选择渲染层拆分，而不是在点击时解析一段双语字符串，是因为值与对应语言在渲染时已有结构化映射，能避免标点、换行或同文内容导致的歧义。

### 2. 保留字段标题和全量复制的既有边界

字段标题继续复制该字段的全部英文，顶部标题只复制其可见英文；“复制 Listing”继续调用既有双语文本构建器。这样既满足点选具体信息点的语言一致性，也不破坏批量复制工作流。将全量复制改为单语言或移除字段标题复制属于超出需求的行为变化。

### 3. 复用现有事件委托和反馈状态

新按钮继续使用 `data-creation-listing-copy-text`，由既有容器级 click handler 调用 `copyCreationListingFieldButton`。仅扩展样式选择器与按钮标签，不增加新的监听器或剪贴板 API 调用，保证 inline 与记录视图行为一致。

### 4. 保持浏览器副本同步

修改 `lib/creation-listing-view.mjs` 后运行 `npm run sync:public-lib`，使 `public/lib/creation-listing-view.mjs` 与源模块字节一致；验证阶段使用 `--check` 固定该约束。

## Risks / Trade-offs

- [按钮数量增加导致布局拥挤] → 复用现有行内文本布局，按钮只保留文本样式，并让焦点/已复制状态继承原有颜色体系。
- [中英文数组长度不一致] → 中文按钮仅在对应中文值存在时创建，英文行始终按现有格式化结果渲染；不凭位置拼接双语剪贴板文本。
- [旧测试依赖双语字段复制] → 更新渲染断言以区分字段标题、英文行和中文行，同时保留全量复制的双语断言。

## Migration Plan

1. 先增加语言独立复制的渲染回归断言并确认旧实现失败。
2. 修改 Listing 视图渲染和样式，运行 `npm run sync:public-lib`。
3. 运行定向 Listing 测试、完整测试、同步检查、页面构建和 OpenSpec 验证。
4. 若需回滚，只需恢复视图模块与样式；数据和已导出文件无需迁移。

## Open Questions

- 无。
