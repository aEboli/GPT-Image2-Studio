## ADDED Requirements

### Requirement: PPT manifest writes remain inside the manifest directory

PPT 存储 SHALL 拒绝包含路径分隔符、目录穿越或非法文件名字符的 deck ID，并在写入前确认目标属于清单目录。

#### Scenario: Completion request supplies a traversal deck ID
- **WHEN** PPT 补图请求的 deck ID 包含 `../` 或 Windows 路径分隔符
- **THEN** 清单保存失败
- **AND** 清单目录之外的 JSON 文件不被创建或覆盖
