## ADDED Requirements

### Requirement: Per-panel generation log partitions

生成日志 SHALL 按生图板块分区保存，分区标识 SHALL 取自板块 id：`prompt`、`style-transfer`、`image-edit`、`quick-blend`、`image-decomposition`、`reference-analysis`、`creation`、`portrait`、`article-illustration`、`ppt`。每个分区 SHALL 独立保留最多 12 条顶层行并独立裁剪，一个分区的写入 SHALL NOT 挤掉其它分区的条目。

#### Scenario: One panel fills its own partition

- **WHEN** 提示词生图连续产生 15 条日志
- **THEN** `prompt` 分区只保留最新 12 条顶层行
- **AND** 其它分区已有的条目数量与内容不变

#### Scenario: Two panels generate at the same time

- **WHEN** 图片编辑与快速溶图同时各有任务在生成
- **THEN** 两个板块的条目分别写入 `image-edit` 与 `quick-blend` 分区
- **AND** 任一板块的条目不出现在另一板块的分区里

#### Scenario: Unknown panel falls back to the prompt partition

- **WHEN** 写入日志时没有提供板块标识或标识不在已知列表中
- **THEN** 条目归入 `prompt` 分区
- **AND** 不新建未知分区

### Requirement: The generation log exists only in the settings log panel

生成日志 SHALL 只在配置区的生成日志面板里呈现。生图板块的产物区 SHALL NOT 内嵌日志面板，也 SHALL NOT 在板块界面内另起一处日志列表。整个界面 SHALL 只存在一个生成日志列表。

#### Scenario: Prompt generation panel shows no log of its own

- **WHEN** 用户在提示词生图板块提交生成
- **THEN** 该板块的产物区不出现生成日志面板
- **AND** 日志条目只写进配置区的生成日志面板

#### Scenario: Only one log list exists

- **WHEN** 查看整个界面
- **THEN** 只有配置区的生成日志面板含有日志列表

### Requirement: Board switching keeps panels independent inside the one log panel

配置区的生成日志面板 SHALL 提供板块切换，使各板块的日志彼此独立可见。面板 SHALL 默认显示用户当前所在板块的分区；用户显式选择某个板块后 SHALL 以该选择为准，SHALL NOT 因为切换板块而覆盖它。切换项 SHALL 包含一个跨板块的“全部板块”视图，该视图 SHALL 在每一行标注所属板块，而单板块视图 SHALL NOT 逐行重复板块标签。面板 SHALL 保留既有的新条目未读指示与滚动位置保持行为。

#### Scenario: Log follows the board the user is on

- **WHEN** 用户打开图片编辑板块并查看配置区日志面板
- **THEN** 面板默认显示 `image-edit` 分区的条目
- **AND** 不显示其它板块的条目

#### Scenario: Explicit pick survives board changes

- **WHEN** 用户在日志面板显式选择“套图模式”，随后切到图片编辑板块
- **THEN** 面板仍显示套图分区的条目

#### Scenario: All-panels view labels each row

- **WHEN** 用户选择“全部板块”
- **THEN** 面板列出各分区的条目
- **AND** 每行显示所属板块标签

#### Scenario: Scoped board without history shows an empty state

- **WHEN** 当前板块的分区没有任何条目
- **THEN** 面板显示空态文案
- **AND** 不用其它板块的条目或当前预览来填充

#### Scenario: Log panel keeps the unread indicator

- **WHEN** 用户已向下滚动日志且有新条目写入
- **THEN** 滚动位置保持在原条目上
- **AND** 新条目数量显示在未读指示上

### Requirement: Batch generation logs group by batch

套图、写真、文章插图与 PPT 的生成 SHALL 写入各自板块的分区，并 SHALL 按批次聚合为一条组行，SHALL NOT 在顶层逐张平铺。组行 SHALL 显示批次汇总，汇总 SHALL 包含该批次的总张数以及完成、失败、进行中的数量，并 SHALL 与单图条目一样显示中转 URL。组行 SHALL 默认折叠，展开后 SHALL 列出该批次每张图的明细条目。每个组行 SHALL 最多保留 24 条子条目。

#### Scenario: A creation batch stays one row

- **WHEN** 一个 8 张的套图批次正在生成
- **THEN** `creation` 分区只增加一条组行
- **AND** 组行显示总数 8 与完成、失败、进行中的数量
- **AND** 组行默认折叠，不展开就看不到单张明细

#### Scenario: User expands a batch group

- **WHEN** 用户展开该套图批次的组行
- **THEN** 面板列出该批次每张图的明细条目
- **AND** 每条明细显示该张图的状态文案

#### Scenario: Group summary reflects child outcomes

- **WHEN** 一个 8 张批次里 5 张完成、1 张失败、2 张仍在生成
- **THEN** 组行汇总显示完成 5、失败 1、进行中 2
- **AND** 组行状态为进行中

#### Scenario: Group turns failed when children settle with failures

- **WHEN** 该批次不再有进行中的图且至少 1 张失败
- **THEN** 组行状态为失败
- **AND** 用户不展开也能看到失败数量

#### Scenario: Batch keeps only the latest children

- **WHEN** 同一批次的子条目超过 24 条
- **THEN** 组行保留最新 24 条子条目
- **AND** 组行仍然是一条顶层行

### Requirement: Single-image panels stay flat

提示词生图、风格迁移、图片编辑、快速溶图、图片拆解与融图分析的条目 SHALL 按任务逐条平铺显示，SHALL NOT 引入批次分组层级或折叠控件。

#### Scenario: Prompt tasks stay flat

- **WHEN** 提示词生图连续提交 3 个任务
- **THEN** `prompt` 分区出现 3 条平铺行
- **AND** 这些行没有展开或折叠控件

### Requirement: Every log entry carries the relay URL

日志条目 SHALL 在排队、进行中、成功、失败与取消状态下都显示中转地址，文案 SHALL 统一为 `URL：<baseUrl>`。中转地址 SHALL 在任务入队时按该板块当前的路由配置解析并存入条目，后续状态更新 SHALL 沿用该值，仅当拿到更精确的结果地址时 SHALL 覆盖它。批次组行 SHALL 显示该批次的中转地址。

#### Scenario: Failed entry shows the same URL as a successful one

- **WHEN** 一个任务失败，且该板块的中转地址为 `https://api.agicto.cn/v1`
- **THEN** 失败条目显示 `URL：https://api.agicto.cn/v1`
- **AND** 文案与成功条目的 URL 行格式一致

#### Scenario: Queued and running entries show the URL

- **WHEN** 任务处于排队中或生成中
- **THEN** 条目显示该板块的 `URL：<baseUrl>`

#### Scenario: Canceled entry keeps the URL

- **WHEN** 用户取消一个排队中的任务
- **THEN** 取消条目仍显示该板块的 `URL：<baseUrl>`

#### Scenario: Result address refines the queued value
- **WHEN** 生成成功且结果条目自带的中转地址与入队时解析的不同
- **THEN** 条目显示结果自带的地址

#### Scenario: Missing relay configuration omits the line

- **WHEN** 该板块没有可解析的中转地址
- **THEN** 条目不显示 URL 行
- **AND** 不显示 `URL：` 空值文案

### Requirement: Persisted log migrates from the single-feed format

生成日志 SHALL 以分区结构持久化到 localStorage。读到旧的单一数组格式时，系统 SHALL 把这些条目归入 `prompt` 分区；读到损坏或无法解析的内容时，系统 SHALL 以空日志起步且 SHALL NOT 抛错。

#### Scenario: Legacy entries move into the prompt partition

- **WHEN** 本地存有旧格式的单一日志数组
- **THEN** 这些条目出现在 `prompt` 分区
- **AND** 条目的状态、时间与文案不变

#### Scenario: Corrupted storage starts empty

- **WHEN** 本地存储的日志内容无法解析
- **THEN** 各分区以空日志起步
- **AND** 页面照常渲染
