## Context

Prompt Agent 长期历史由 `/api/prompt-agent/history` 返回，Prompt Kit 通过 `image-studio-prompt-templates-v2` 从 `localStorage` 读取模板。两者的对象都已经具备 `id`、`filename` 和 `json`，可直接复用现有 `getPromptAgentReusableText` 与 `getPromptAgentDisplayName`，不需要服务端迁移。

## Goals / Non-Goals

**Goals:**

- 让 Prompt Kit 在打开时看到当前服务端历史中的可复用反推结果。
- 以 `prompt-agent-${history.id}` 作为稳定映射，保证重复加载幂等。
- 保留用户对已有模板的名称、内容和删除操作，不修改长期历史。
- 保留旧版 `prompt-agent-*` JSON 的现有归一化规则。

**Non-Goals:**

- 不改变历史 API、服务端存储或历史记录排序。
- 不重写已有模板内容，不新增模板编辑器字段或同步删除 API。
- 不把无可复用提示词的历史条目强行写入 Prompt Kit。

## Decisions

### 在 Prompt Kit 打开时复用历史加载路径

`setPromptTemplatePopoverOpen(true)` 在现有模板表单初始化后触发 `loadPromptAgentHistory()`。成功响应更新 `state.promptAgent.history`，再调用合并函数和现有渲染函数。这样 Prompt Kit 可以独立打开，而不要求用户先进入图片转提示词弹窗；网络失败只记录警告，已经存在的模板仍可用。

### 只补齐缺失 ID，不覆盖已有模板

新增 `mergePromptAgentHistoryTemplates` 纯函数。它先记录现有模板 ID，再按历史顺序生成可复用条目；空 ID、空提示词和已知 ID 直接跳过。返回值将新条目放在列表前面，现有模板对象保持原引用和字段不变。

普通分析完成时也通过该函数保存当前结果。若同一 ID 已有用户编辑过的模板，只更新选中状态和列表渲染，不写入新的服务端内容。

### 历史加载刷新与幂等

Prompt Agent 弹窗继续支持强制刷新；Prompt Kit 首次打开时使用已加载历史，避免同一会话重复请求。每次成功加载都会执行一次幂等合并，因此新历史可在后续强制刷新后补入模板，重复打开不会重复插入。

### 用本地屏蔽集合尊重模板删除

删除 `prompt-agent-*` 模板时，将其 ID 写入独立的 `image-studio-prompt-template-dismissed-history-v1` 数组。历史仍由服务端保留，但后续自动合并会跳过已屏蔽 ID；普通用户模板不写入该集合。这样模板删除不会在重新打开 Prompt Kit 后立即复活，同时不改变既有模板 JSON 结构。

## Risks / Trade-offs

- Prompt Kit 首次打开会额外请求一次历史接口；请求失败时保留当前本地模板并不阻断编辑。
- 屏蔽 ID 与模板列表分开存储，旧版本没有该键时按空集合兼容启动。

## Migration Plan

1. 增加浏览器端历史到模板的合并辅助函数和 OpenSpec 增量规格。
2. 接入 Prompt Kit 打开与普通分析完成路径，保留已有模板和旧 JSON 归一化逻辑。
3. 运行辅助函数单测、Prompt Agent 静态契约、全量测试、OpenSpec 严格校验和 `git diff --check`。
4. 归档变更；回滚只需恢复前端与测试/规格工件，不涉及服务端数据迁移。
