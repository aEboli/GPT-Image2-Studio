## Context

套图记录已经形成一套经过验证的危险操作模型：详情单选与批量勾选分离、应用内确认、明确 ID 批量接口、安全删除专属目录，以及成功后在当前浏览器状态原位更新。其余资产页的数据模型不同：Gallery 以单张文件名为键，Article 与 Portrait 使用 set manifest 和 `relativeDir`，PPT 同时存在 manifest 记录与扫描到的旧式 PPTX 文件。直接复制套图删除代码会重复状态与确认逻辑，直接循环现有单文件接口则无法稳定表达批量结果和部分未命中。

工作树包含已完成但尚未提交的 Creation、Listing 与资产页改动。本次实现必须保持这些修改，并只扩展资产删除相关模块、路由、页面、测试、README 和 OpenSpec 工件。

## Goals / Non-Goals

**Goals:**

- 在 Gallery、Article、Portrait 和 PPT 记录页提供与 Creation 一致的删除当前和显式勾选批量删除。
- 使用共享的纯函数解析目标、相邻选择、请求边界和确认文案，同时保留各页面自己的状态与渲染函数。
- 按每类资产实际所有权删除文件，并对递归目录执行严格的输出根、类型标记和专属子目录验证。
- 删除成功后原位提交浏览器状态，不自动重新 GET 全部记录。
- 保持 Local 与 Cloudflare 能力矩阵和路由行为一致。

**Non-Goals:**

- 为非 Creation 页面增加删除筛选结果、删除全部、回收站、撤销、保留策略或定时清理。
- 改变 Creation 现有三类删除行为或时间筛选语义。
- 支持删除 Article、Portrait、Creation 或 PPT 记录中的单张子项。
- 自动删除已脱离任何记录且无法验证归属的任意目录。

## Decisions

### 1. 共享目标与确认规则，保留页面专属状态

新增浏览器可用的 `asset-record-delete` 纯函数模块，负责 ID 去重/上限、当前或勾选目标解析、删除后相邻选择和可配置确认文案。Gallery、Article、Portrait 和 PPT 各自保存当前键与 checked keys；批量勾选不调用现有详情选择函数。Creation 保留已经验证的专用 helper，避免在扩展期间重写稳定行为。

备选方案是把所有页面收敛到一个通用 controller。当前 `public/app.js` 各页加载、详情和 busy 状态差异较大，强行统一会扩大改动面；共享无状态规则而保留页面提交函数更符合最小变更。

### 2. 新增一个共享确认对话框但不替换 Creation 对话框

四个新增页面共用 `assetRecordDeleteDialog`，请求快照包含 `kind`、`mode`、目标 ID 和删除前可见顺序。Creation 继续使用现有 dialog 和焦点恢复逻辑。这样所有新增入口均为应用内确认，同时不改动刚完成的 Creation 删除流程与静态回归契约。

### 3. 每类记录使用一个批量请求

- Gallery 扩展 `POST /api/output/delete`，接受兼容的 `{ filename }` 或新的 `{ filenames: string[] }`。
- Article 使用 `POST /api/article-illustration/sets/delete`，提交 `{ setIds }`。
- Portrait 使用 `POST /api/portrait/sets/delete`，提交 `{ setIds }`。
- PPT 使用 `POST /api/ppt/decks/delete`，提交 `{ recordKeys }`。

所有数组均去重、拒绝空值和超限。单个批量请求能返回 deleted、not-found 与 unsafe 结果，避免浏览器循环请求后无法判断部分成功状态。Gallery 旧式单文件输入保持兼容。

### 4. Article 与 Portrait 只递归删除经过类型证明的专属目录

两个 store 在删除前读取由请求 ID 定位的 manifest，并精确比较 manifest 内的 `setId`。`relativeDir` 必须是输出根下相对路径，包含 `YYYY-MM-DD-article` 或 `YYYY-MM-DD-portrait` 标记且标记后仍有专属子目录。图片目录和 `output/json/<relativeDir>` 都必须是输出根的非根后代，真实路径检查通过后才递归删除；manifest collection 本身永远不是候选目录。

### 5. PPT 根据记录来源选择删除粒度

manifest PPT 从其保存的 PPTX/slide 相对路径推导 `YYYY-MM-DD-ppt/<deck-folder>`，验证后删除整个 deck folder、镜像 JSON folder 和精确 manifest。扫描得到的 folder-only 记录若同样位于类型标记后的专属子目录，则删除该目录；旧式 PPTX 若直接位于日期或 PPT 目录，只删除被列表确认的 `.pptx` 文件，绝不递归删除父目录。

PPT 请求只提交浏览器展示键，store 重新列出当前记录并解析真实相对路径，不接受客户端提供任意待删路径。

### 6. 成功后原位更新并按删除前顺序选择相邻项

浏览器把服务端报告为 deleted 或 already absent 的目标从本地集合移除，清理相应 checked keys、浏览器图片缓存和打开的 viewer/current result。若当前项被删，从请求快照中的完整可见顺序先找下一项，再找上一项。筛选状态和容器 scroll offset 在单次最终渲染前后保留；手动 Refresh 仍负责同步外部变化。

### 7. Cloudflare 按已有持久化能力退化

Gallery、Portrait、Creation 和 PPT 在 Worker 没有对应本地记录目录时，对通过校验的 ID 返回幂等成功，让浏览器清理会话或 IndexedDB 状态。Article 整个记录能力在 Worker 已明确为 unsupported，其删除路由沿用共享 unsupported capability 响应。API capability 表作为 Local/Worker 路由测试的共同事实。

## Risks / Trade-offs

- [批量误删] -> 只支持当前项或显式 checkbox，确认显示类型、名称或数量；非 Creation 页面不提供筛选删除。
- [目录越界或类型混淆] -> 服务端从真实 manifest/列表重新解析，精确比较 ID，并要求类型日期标记后的专属子目录。
- [PPT 历史结构不统一] -> 有专属目录才递归删除，无法证明归属时退化为精确 `.pptx` 文件删除。
- [生成中记录被重新写回] -> 对应页面在 planning/generating/deleting 状态禁用删除；store 删除仍以当前磁盘事实为准。
- [部分目标已被外部删除] -> 批量响应显式返回 not-found，浏览器按幂等成功清理已不存在的加载项。
- [跨筛选勾选不可见] -> Delete selected 显示完整勾选数量，删除目标只来自仍存在的已加载集合；筛选本身不扩张目标。

## Migration Plan

1. 增加纯函数、store、Local/Worker 路由和浏览器静态失败测试。
2. 实现路径保护与批量 API，再实现页面状态、checkbox、确认和原位更新。
3. 更新 API capability、public/lib 镜像、README 和缓存版本。
4. 运行定向测试、完整测试、Pages build、public/lib 同步、OpenSpec strict validation、乱码扫描和浏览器桌面/移动端核验。
5. 合并增量规格并归档。回滚可移除新增入口和路由；已经确认永久删除的数据只能从外部备份恢复。

## Open Questions

- 无。截图箭头指向“删除当前”和“删除选中”，因此其他资产页仅扩展这两项，不扩展“删除筛选结果”。
