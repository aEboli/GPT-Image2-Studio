## ADDED Requirements

### Requirement: Stage hue and progress depth

加载组件 SHALL 用两个维度合成水体颜色：色相 SHALL 由真实请求阶段决定，深浅 SHALL 由当前百分比决定。色相族 SHALL 取自既有 `statusStage`，SHALL NOT 引入不对应真实阶段的自造阶段名。组件 SHALL 暴露 `data-generation-loading-stage` 与 `data-generation-loading-family`，水体的液体填充、波峰、涟漪、水滴边框与外发光 SHALL 由同一个合成颜色取色。颜色 SHALL NOT 改变百分比时序、`99%` 上限或等待态语义。

#### Scenario: Hue follows the real request stage

- **WHEN** 任务的 `statusStage` 依次为 `queued`、`uploading`、`connecting`、`generating`、`saving`
- **THEN** `data-generation-loading-family` 依次为 `queued`、`uploading`、`connecting`、`generating`、`saving`
- **AND** 水体色相随之改变，且与界面上显示的阶段文字同源

#### Scenario: Fetch and retry stages share one family

- **WHEN** `statusStage` 为 `waiting_upstream`、`waiting_final`、`retrying_upstream`、`missing_final_recovery`、`fallback_final_image`、`recovering_original`、`waiting_original` 或 `recovery_unavailable`
- **THEN** `data-generation-loading-family` 为 `recovering`
- **AND** 水体使用区别于生成阶段的告知性色相

#### Scenario: Failure stages use the failure family

- **WHEN** `statusStage` 为 `error`、`failed` 或 `original_failed`
- **THEN** `data-generation-loading-family` 为 `failed`

#### Scenario: Depth deepens with the percentage

- **WHEN** 同一阶段内百分比从低位升到高位
- **THEN** 水体颜色在该色相族内变深
- **AND** 长阶段内部也能看出推进

#### Scenario: Missing stage keeps the last known stage

- **WHEN** 重渲染时调用点没有提供阶段
- **THEN** 组件保留上一次已知阶段与色相族
- **AND** 颜色不退回默认族

#### Scenario: Unknown stage does not guess a later stage

- **WHEN** 阶段取值为空或不在已知列表中
- **THEN** 等待态归入 `queued` 族，其余归入 `generating` 族
- **AND** 不显示写入或失败族的颜色

#### Scenario: Stage color changes smoothly

- **WHEN** 阶段从一段切换到下一段
- **THEN** 色相与饱和度在过渡时长内平滑插值而不是硬切
- **AND** 液位上升时序与百分比文本不受影响

#### Scenario: Families keep a comparable perceived brightness

- **WHEN** 逐个查看七个色相族在同一百分比下的水体颜色
- **THEN** 各族的感知亮度接近，没有哪个阶段明显更刺眼或更发闷
- **AND** 青与绿这类本身偏亮的色相起始亮度低于紫与红这类偏暗的色相

#### Scenario: Light theme keeps contrast

- **WHEN** 界面处于浅色主题
- **THEN** 水体整体亮度低于深色主题下的同族颜色
- **AND** 水体与浅色背景保持可辨识的对比度
- **AND** 主题以亮度偏移方式调整，各族按感知亮度做的校准在浅色主题下同样生效

#### Scenario: Reduced motion keeps stage colors

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 波峰流动、气泡与呼吸动画仍然停用
- **AND** 当前阶段色相与按百分比的深浅仍然呈现
