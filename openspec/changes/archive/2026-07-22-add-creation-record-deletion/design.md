## Context

套图记录由 Local 的 `creationSetStore` 读取 `output/json/creation-sets/*.json` manifest，并通过 manifest 的 `relativeDir` 指向专属图片目录；图片 sidecar 位于 `output/json/<relativeDir>/`。浏览器把 `/api/creation/sets` 结果保存在 `state.creation.sets`，搜索只在客户端执行，左侧列表为性能最多渲染 60 条，但详情选择与完整筛选集合基于全部记录。

当前记录页没有删除状态或接口。直接复用图库的单文件删除会遗漏 manifest、整套其余图片和 sidecar；循环调用单删也无法稳定表达“按当前筛选结果”这一批目标。删除属于不可撤销操作，需要明确目标集合、路径边界与确认步骤。

## Goals / Non-Goals

**Goals:**

- 支持删除当前选中套图、勾选多套批量删除、删除当前非空搜索命中的全部套图。
- 三种入口在提交前展示目标数量和删除范围，确认后只向服务端发送确定的去重 `setIds`。
- 删除 manifest、该 manifest 专属生成目录和对应 JSON sidecar 目录，不影响其他套图或输出根目录。
- 删除后同步服务端列表、详情选择、批量勾选和当前结果状态。
- Local 与 Cloudflare 路由契约一致；Cloudflare 没有服务端套图存储时返回幂等成功。

**Non-Goals:**

- 增加回收站、撤销、定时清理或保留策略。
- 删除套图中的单张图片，或为写真、文章插图和 PPT 记录增加同类能力。
- 让空搜索条件等价于“删除全部记录”。
- 改变套图生成、修复、Listing、导出或图库单文件删除逻辑。

## Decisions

### 1. 一个批量接口承载三种 UI 操作

浏览器统一向 `POST /api/creation/sets/delete` 提交 `{ setIds: string[] }`。单删只是数组长度为 1；勾选批量和筛选批量在提交前分别解析出明确 ID 数组。服务端对 ID 去重并设定合理上限，拒绝空数组或非法类型。

选择一个批量接口而不是让浏览器循环单删，可以让目标集合、返回计数和错误处理保持一致，也避免部分网络请求失败后界面无法判断真实结果。

### 2. 永久删除套图记录及其专属资产

每个 set 删除以下目标：

- `output/json/creation-sets/<setId>.json` manifest；
- manifest `relativeDir` 解析出的 `output/<relativeDir>/` 图片目录；
- `output/json/<relativeDir>/` sidecar 目录。

存储层先读取真实 manifest，并要求其中的 `setId` 与请求 ID 完全一致，避免经过文件名清洗后的 ID 碰撞删除错误记录。所有目录都通过 `resolve`/`relative` 证明是输出根下的非根后代；空路径、根路径、越界路径或符号链接目标不作为递归删除目标。不存在的 set 视为幂等未命中并在结果中报告，不影响其他目标。

### 3. 批量勾选与详情单选相互独立

每条列表记录使用外层行容器、独立 checkbox 和原有记录选择 button。点击 checkbox 只改变 `recordSelectedSetIds`，点击记录主体才改变 `recordSetId` 和详情。过滤后可保留仍存在记录的跨筛选勾选，工具栏显示当前已勾选数量。

### 4. 按筛选删除要求非空查询

“删除筛选结果”仅在 `recordQuery.trim()` 非空且 `filterCreationRecordSets()` 有结果时启用。删除目标来自完整的 `filterCreationRecordSets()`，不使用 `.slice(0, 60)` 后的可见列表，确保计数和实际删除一致。

### 5. 使用应用内确认对话框

删除入口只准备不可变目标快照并打开模态对话框。对话框标题、说明和确认按钮展示套数；单删额外展示商品名，筛选删除展示当前搜索词。取消、Escape 或关闭不会发送请求。请求期间禁用确认和记录页删除控件，避免重复提交。

### 6. 删除后以服务端列表为事实

接口成功后先从浏览器状态移除已删除 ID，清理批量勾选；若 `currentSet` 与已删除 ID 相同则清空当前结果，避免继续展示已删除图片。随后重新调用 `loadCreationSets()`，由服务端列表修正详情默认选择和计数。生成或计划正在运行时禁用删除入口，避免同一 set 在后续保存中被重新创建。

## Risks / Trade-offs

- [误删大量记录] -> 筛选删除要求非空查询，确认对话框展示目标数量与不可恢复范围。
- [路径穿越或清洗碰撞] -> 读取 manifest 后精确比对 set ID，并验证删除目录是输出根下的非根后代。
- [删除中的 set 被生成保存复活] -> 浏览器在套图生成、计划或删除请求期间禁用入口；存储删除与同 set 保存共用串行队列。
- [部分资产不存在] -> 目录删除使用幂等 `force`，只要 manifest 可识别就完成逻辑删除。
- [筛选列表只显示前 60 条] -> 目标和计数基于完整筛选数组，渲染上限只影响展示。
- [Cloudflare 没有服务端记录] -> Worker 返回对所提交 ID 的幂等成功，浏览器仍可清理当前会话状态。

## Migration Plan

1. 增加失败测试，固定存储安全、批量 API、三种目标集合和确认对话框契约。
2. 在 Creation store 增加串行批量删除，并接入 Local/Worker 与 API capability 表。
3. 增加记录页复选框、三种按钮、确认对话框、请求状态和删除后刷新逻辑。
4. 运行聚焦与完整测试、public-lib 同步检查、Pages 构建、OpenSpec strict validation 和中文乱码扫描。
5. 回滚时移除新路由和 UI；已经删除的文件无法由应用自动恢复，需要用户从外部备份恢复。

## Open Questions

- 无。首版按永久删除记录及其专属生成资产实现，不增加回收站。
