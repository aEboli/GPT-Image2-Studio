## ADDED Requirements

### Requirement: Direct Images API partial images use the existing preview event path

直连 Images API 流收到中间图片时 SHALL 使用生成工作流已有的 `partial_image` 事件与预览通道，使各创作模式可按其现有订阅更新预览。

#### Scenario: Direct route emits an intermediate preview

- **WHEN** 直连 Images API 返回 partial image SSE 事件
- **THEN** 生成订阅者收到 MIME 类型与所选输出格式一致的 `partial_image` data URL
- **AND** 后续最终图像仍使用既有 `final_image` 事件保存和完成任务
