## MODIFIED Requirements

### Requirement: Prompt library list view follows preview image geometry

列表视图 SHALL 使用紧凑且稳定的行高，随列表字号提供足够文本空间；行高 SHALL NOT 由图片的纵横比决定。缩略图 SHALL 在固定媒体区域内保留原始比例并完整显示，标题 SHALL 最多换行显示两行，提示词 SHALL 最多显示三行并以多行省略号截断。图片视图 SHALL 继续独立保留每张图片的原始比例。

#### Scenario: A list prompt is longer than its paired image

- **WHEN** 用户在列表视图浏览竖向图片及较长提示词
- **THEN** 缩略图保持比例且不裁剪，整行高度不因竖图拉长
- **AND** 标题可换行，提示词在三行以内截断，完整内容仍可通过图片预览查看

#### Scenario: 用户调整字号或面板宽度

- **WHEN** 用户调整列表字号、窗口尺寸或页面缩放
- **THEN** 各行文本与操作保持在其边界内，不依赖图片重新加载计算高度
