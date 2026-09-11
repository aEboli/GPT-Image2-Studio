# configuration-usability Specification

## Purpose
TBD - created by archiving change compact-config-log-panel. Update Purpose after archive.
## Requirements
### Requirement: 配置区长说明不占用表单流

调用通道字段的长说明 SHALL 以字段旁的可见说明标记提供，说明标记 SHALL 支持鼠标悬停和键盘聚焦；完整说明 SHALL 通过既有 tooltip 显示。说明标记 SHALL 保留可访问名称和 `aria-describedby` 关联，且 SHALL NOT 让长说明在未交互时占据表单垂直空间。

#### Scenario: 用户查看调用通道说明

- **WHEN** 用户将鼠标移到说明标记上，或使用键盘聚焦说明标记
- **THEN** 完整说明显示在悬浮提示中
- **AND** 调用通道卡片的输入控件位置不因提示出现而重新排版

### Requirement: 生成日志在配置抽屉中保持可见且独立滚动

配置抽屉 SHALL 将配置表单与生成日志放在两个内部区域。日志区域 SHALL 具有不小于 180px 且随视口变化的高度上限；日志标题、板块切换和未读指示 SHALL 保持在日志视口内，时间线条目 SHALL 在自身列表中垂直滚动。新增日志条目 SHALL NOT 推动日志区域离开当前抽屉视口。

#### Scenario: 生成任务持续产生日志

- **WHEN** 生成任务在配置抽屉打开时新增或更新日志条目
- **THEN** 日志区域高度保持在响应式边界内
- **AND** 用户可以在时间线列表内滚动查看条目
- **AND** 配置表单滚动位置与日志列表滚动位置彼此独立

#### Scenario: 小视口打开配置抽屉

- **WHEN** 设备为平板或手机布局
- **THEN** 日志区域仍保留最小可用高度并可独立滚动
- **AND** 保存/测试操作仍可通过表单底部操作栏访问

