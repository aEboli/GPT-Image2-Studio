## MODIFIED Requirements

### Requirement: Batch generation fills missing Listing records

The suite records view SHALL provide a batch command that generates Listing only for records without existing Listing drafts. The command SHALL use at most three concurrent workers under the shared server-side Listing request limit, skip records with existing drafts or an active Listing request, and continue after an ordinary individual failure. Account-level failures, excessive upstream cooldown, or three consecutive explicit temporary rate-limit failures SHALL stop taking new records while already-started workers settle. While the batch runs, record refresh, deletion, Temu export, and separate Listing generation SHALL be unavailable. Background completions SHALL preserve the user's selected record.

#### Scenario: Batch generation skips existing Listing
- **WHEN** the user activates batch Listing generation
- **THEN** records with one or more existing `listingDrafts` or an active Listing request are skipped
- **AND** missing records run with at most three concurrent workers rather than an unbounded request fan-out
- **AND** an ordinary failed record does not prevent later missing records from being attempted

#### Scenario: Record actions stay stable during batch generation
- **WHEN** a batch Listing operation is running
- **THEN** refreshing or deleting records, starting a Temu export, and starting another Listing generation are disabled
- **AND** background results do not change the user's selected record
- **AND** completion reports successful, failed, skipped and unstarted counts

## ADDED Requirements

### Requirement: 批量 Listing 显示实际进度并隔离普通失败

批量 Listing SHALL 使用最多三个工作者补缺并跳过已有草稿，普通单条失败后继续。系统 SHALL 显示总数、成功、失败、活动、未开始数、实际耗时以及排队、等待回答、接收、校验或限流冷却状态。单条反馈 MUST NOT 覆盖批次计数，耗时 MUST NOT 因上游未推送新文本而停留在首包时刻。系统 SHALL 保留可追溯的请求元数据与脱敏错误，MUST NOT 持久化认证内容或完整模型提示词。

#### Scenario: 上游首包后长时间思考
- **WHEN** 上游已建立连接但尚未返回 Listing 回答文本
- **THEN** 界面继续更新实际经过时间并显示等待回答状态
- **AND** 系统不把连接或首包时间当作完整请求耗时，也不显示虚构完成百分比

#### Scenario: 普通单条内容失败
- **WHEN** 一条 Listing 因普通内容或解析错误失败
- **THEN** 系统记录该套图和原因、继续后续条目，并保留已生成草稿

#### Scenario: 临时限流持续未恢复
- **WHEN** 连续 3 条 Listing 经允许的冷却和有限恢复仍因明确临时限流失败，或上游要求等待超过 60 秒
- **THEN** 系统停止继续提交并清楚列出未开始项
- **AND** 用户再次运行补缺时跳过已完成草稿

#### Scenario: 用户追查批量结果
- **WHEN** 用户查看 Listing 诊断记录
- **THEN** 可以按 batchId、setId、requestId、attempt 和阶段定位排队、执行、冷却及最终结果
- **AND** 诊断不包含完整提示词、密钥或不必要的私有请求数据
