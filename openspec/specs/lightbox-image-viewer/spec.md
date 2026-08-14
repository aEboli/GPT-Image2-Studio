# lightbox-image-viewer Specification

## Purpose
TBD - created by archiving change enhance-lightbox-image-viewer. Update Purpose after archive.
## Requirements
### Requirement: Lightbox opens in fitted viewer mode
The system SHALL open every image detail lightbox with the image fitted inside the available media stage and with viewer state reset for the current image. The media stage SHALL remain the dominant visual area. On desktop, the inspector SHALL use a compact bounded column no wider than 340px by default; on tablet and mobile, the image SHALL remain the first and largest region and inspector content SHALL scroll independently when needed.

#### Scenario: User opens an image detail lightbox
- **WHEN** the user opens a gallery, generated, creation-record, or article-record image in the lightbox
- **THEN** the image is visible within the media stage without requiring scrollbars
- **AND** the inspector does not consume more than the compact desktop column budget
- **AND** the zoom percentage reflects the fitted image scale
- **AND** prior zoom scale and pan offset from another image are not applied

#### Scenario: User views a long parameter payload
- **WHEN** the parameter text or file path is longer than the compact inspector height or width
- **THEN** the inspector scrolls its content without shrinking the image stage below its minimum viewing area
- **AND** prompt and parameter values remain selectable and readable

#### Scenario: User opens the lightbox on a narrow viewport
- **WHEN** the UI is in tablet or mobile layout
- **THEN** the image region is rendered before the inspector region and remains visually larger
- **AND** the dialog has no horizontal overflow
- **AND** viewer, tab, and return controls retain touch-sized targets

#### Scenario: User closes and reopens the same image
- **WHEN** the user closes the lightbox after zooming or panning
- **AND** the user opens the same image again
- **THEN** the lightbox returns to fitted viewer mode
- **AND** the pan offset is reset to the centered fitted image position

### Requirement: Lightbox exposes viewer controls
The system SHALL expose lightbox viewer controls for zooming out, zooming in, fitting the image, switching to 100%, and reading the current zoom percentage.

#### Scenario: User uses viewer toolbar controls
- **WHEN** the lightbox displays an image
- **THEN** the viewer controls include zoom out, zoom percentage, zoom in, fit, and 100% controls
- **AND** activating zoom in increases the viewer scale within the allowed maximum
- **AND** activating zoom out decreases the viewer scale within the allowed minimum
- **AND** activating fit returns the image to the fitted scale and centered position
- **AND** activating 100% shows the image at its natural pixel scale when image dimensions are available

#### Scenario: Image is unavailable
- **WHEN** the lightbox has no valid image URL or the image dimensions are not ready
- **THEN** controls that require image dimensions are disabled or left inert
- **AND** existing back, download, delete, copy path, and copy prompt behavior remains stable

### Requirement: Lightbox supports pointer-centered wheel zoom
The system SHALL zoom the lightbox image with the mouse wheel around the pointer position while the pointer is over the viewer area.

#### Scenario: User wheel-zooms over a detail
- **WHEN** the user places the pointer over a visible detail in the lightbox image
- **AND** the user scrolls the mouse wheel upward or downward
- **THEN** the image zooms in or out within the configured scale limits
- **AND** the image point under the pointer remains under or near the pointer after the zoom
- **AND** the surrounding page or dialog does not scroll because of that wheel action

#### Scenario: User reaches scale limits
- **WHEN** wheel or toolbar zoom would set the scale below 25% or above 800%
- **THEN** the system clamps the scale to the nearest allowed limit
- **AND** the zoom percentage displays the clamped scale

### Requirement: Lightbox supports drag panning when zoomed
The system SHALL allow the user to drag-pan the lightbox image when the current view is larger than the available media stage.

#### Scenario: User drags a zoomed image
- **WHEN** the image is zoomed beyond the fitted view or is otherwise larger than the media stage
- **AND** the user presses and drags inside the viewer area
- **THEN** the image pans in the drag direction
- **AND** the cursor communicates the draggable and dragging states
- **AND** browser-native image dragging and text selection are suppressed during the pan

#### Scenario: User releases a drag
- **WHEN** the user releases the pointer after dragging a zoomed image
- **THEN** the viewer exits the dragging state
- **AND** the image remains at the final pan offset
- **AND** normal click, double-click, and toolbar interactions remain available

### Requirement: Lightbox supports fast fit and inspection toggles
The system SHALL provide fast viewer toggles for returning to fitted view and inspecting at natural size.

#### Scenario: User double-clicks the fitted image
- **WHEN** the lightbox image is at or near fitted scale
- **AND** the user double-clicks the image or viewer stage
- **THEN** the viewer zooms to 100% or the last inspection scale above fitted scale
- **AND** the double-click position is used as the zoom anchor when possible

#### Scenario: User double-clicks a zoomed image
- **WHEN** the lightbox image is zoomed beyond fitted scale
- **AND** the user double-clicks the image or viewer stage
- **THEN** the viewer returns to fitted scale
- **AND** the image is centered in the media stage

### Requirement: Lightbox preserves existing detail actions
The system SHALL expose a visible Back command beside the lightbox title instead of a right-aligned X control, and SHALL preserve the remaining lightbox detail actions while adding viewer interactions.

#### Scenario: User returns from an enlarged image
- **WHEN** the user opens an image in the lightbox
- **THEN** the title area shows a left-arrow Back command
- **AND** the right action area does not show a separate X close control
- **AND** activating Back closes the lightbox and restores focus to the originating image

#### Scenario: User uses existing lightbox actions after zooming
- **WHEN** the user has zoomed or panned a lightbox image
- **THEN** download, delete, copy prompt, copy relative path, copy full path, backdrop close, Back, and Esc close continue to perform their existing actions
- **AND** viewer pointer interactions do not trigger delete, download, copy, or unintended close actions

#### Scenario: User presses Escape while viewer is zoomed
- **WHEN** the lightbox is open and the image is zoomed or being inspected
- **AND** the user presses Escape
- **THEN** the lightbox closes
- **AND** focus restoration behavior remains consistent with the existing overlay focus management

### Requirement: 图片详情参数面板展示文件信息

图片详情 SHALL 保留“提示词”和“参数”两个信息页签；参数页签 SHALL 在生成参数内容下方展示当前图片的文件名和相对路径，且不再提供独立“文件”页签。

#### Scenario: 用户查看图片参数

- **WHEN** 用户打开图片详情并选择“参数”
- **THEN** 页面显示生成参数
- **AND** 生成参数下方显示文件名和相对路径
- **AND** 文件信息不会要求用户切换到另一个页签

#### Scenario: 文件字段缺失

- **WHEN** 当前图片没有文件名或相对路径
- **THEN** 对应字段显示现有占位符 `--`
- **AND** 参数文本仍可正常查看

### Requirement: 图片详情媒体区保持稳定桌面外框

图片详情 SHALL 在桌面布局保持图一对应的稳定外框尺寸，不得因当前图片的自然宽高比改变弹窗高度。桌面弹窗高度 SHALL 为 `min(92dvh, 940px)`，顶栏与媒体区 SHALL 使用固定的双行布局；图片 SHALL 在左侧媒体区内完整适配显示，右侧检查器 SHALL 保持紧凑列宽并独立滚动。tablet、stacked 和 mobile 的既有响应式覆盖继续生效。

#### Scenario: 桌面打开不同宽高比的图片详情

- **WHEN** 用户在桌面布局依次打开横向、方形或纵向图片
- **THEN** 图片详情弹窗保持相同的桌面外框高度和双栏结构
- **AND** 每张图片都在左侧媒体区内完整适配显示
- **AND** 图片自然宽高比不会写入或改变弹窗的动态高度变量

#### Scenario: 图片或窗口尺寸发生变化

- **WHEN** 图片完成加载或用户调整窗口尺寸
- **THEN** 媒体区在固定外框内重新计算适配缩放
- **AND** 图片完整性、缩放状态和检查器独立滚动保持正确

#### Scenario: 受限布局打开图片详情

- **WHEN** 用户在 tablet、stacked 或 mobile 布局打开图片详情
- **THEN** 既有堆叠高度、内部滚动和触控尺寸规则继续生效
- **AND** 页面不产生水平溢出

### Requirement: 结构化提示词按共同分节聚合

图片详情的结构化提示词 SHALL 将数组值渲染为其共同父字段下的一个检查器字段，并按换行显示各个值；渲染字段 SHALL 不暴露数组的数字索引。原始提示词文本 SHALL 保持不变，以便复制和其他复用行为继续使用原文。

#### Scenario: 分节包含多个数组值

- **WHEN** 结构化提示词包含 `subject.appearance` 等数组字段
- **THEN** 检查器显示一个 `subject.appearance` 字段
- **AND** 该字段包含数组中的所有值
- **AND** 检查器中不显示 `subject.appearance.1`、`.2` 或 `.3` 等索引字段

#### Scenario: 数组包含嵌套对象

- **WHEN** 结构化提示词数组中的元素包含对象字段
- **THEN** 元素内容仍聚合在共同父字段下
- **AND** 嵌套键和值以可读的换行文本保留

#### Scenario: 复制结构化提示词

- **WHEN** 用户点击图片详情中的“复制”
- **THEN** 复制内容仍是图片记录保存的原始提示词文本
- **AND** 检查器的聚合展示不会改变复制结果
