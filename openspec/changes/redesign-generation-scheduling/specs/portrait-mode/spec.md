## ADDED Requirements

### Requirement: 写真扇出使用共享会话控制

写真生成与写真补图 SHALL 使用 `portrait` scope 的共享任务 slot 与发车闸门，且 SHALL 在每个真实上游生成调用之前取得发车许可。写真与套图使用不同 scope；写真 SHALL 保留其现有单轮失败重排语义。

#### Scenario: 写真与套图互不阻塞

- **WHEN** 同一会话同时运行写真和套图
- **THEN** 写真提交只受 `portrait` scope 的并发与间隔约束
- **AND** 套图提交只受 `creation` scope 的并发与间隔约束

#### Scenario: 写真补图使用相同配置

- **WHEN** 用户配置并发数量与提交间隔后触发写真补图
- **THEN** 写真补图使用该请求解析出的并发值和间隔
- **AND** 其真实上游调用经过共享 `portrait` 闸门
