## MODIFIED Requirements

### Requirement: Stable shell reuse by generation key

同一生图任务在重复渲染时 SHALL 复用现有加载 DOM、当前百分比和初始随机图标。任务仅因用户切换界面、预览项或队列而暂时没有挂载壳时，系统 SHALL 按其稳定 `loadingKey` 保留逻辑进度源；重新挂载同一仍在运行的 key 时 SHALL 恢复百分比、进度时序和当前心跳图标。切到不同任务时，新任务 SHALL 从 `0%` 开始，且 SHALL NOT 继承旧任务的进度。任务完成、失败、取消或被真正替换时 SHALL 清理其进度源；同 key 的下一次独立任务 SHALL 从 `0%` 开始。

#### Scenario: Re-render the same task

- **WHEN** 同一 `loadingKey` 的状态因轮询或 SSE 更新而重新渲染
- **THEN** `.generation-loading-shell` 节点与其当前图标引用保持不变
- **AND** 百分比不会因为重渲染回到 0

#### Scenario: Return to a temporarily unfocused running task

- **WHEN** 正在运行的队列 A 在显示到某个百分比后，用户切换到界面或队列 B，随后返回 A
- **THEN** A 的新加载壳恢复离开前的百分比和当前心跳图标
- **AND** A 在未显示期间按既定时序继续推进，直到 99%
- **AND** B 从 0% 开始且不继承 A 的状态

#### Scenario: Switch to another task

- **WHEN** loading 状态切换到不同的 `loadingKey`
- **THEN** 新任务从 0% 创建或更新，并随机选择自己的初始图标
- **AND** 旧任务仅在仍运行且只是暂时失焦时保留其逻辑进度源

#### Scenario: Task reaches a terminal state

- **WHEN** 任务完成、失败、取消或被真正替换
- **THEN** 该任务的 timer 和共享进度源被清理
- **AND** 之后以同一 `loadingKey` 创建的独立任务从 0% 开始
