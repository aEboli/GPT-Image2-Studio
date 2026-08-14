## MODIFIED Requirements

### Requirement: 提示词模板面板避让参数区

提示词模式的 Prompt Kit 模板面板在 desktop 和 narrow-desktop 布局 SHALL 作为主预览区域内的右侧悬浮面板显示，其左边缘 SHALL 锚定到 `#previewCanvas` 渲染后水平中线，并从该边界向右展开；面板不得固定在浏览器最右缘作为唯一定位依据。面板宽度 SHALL 受该锚点到视口右侧的可用空间约束，并保留可见右侧间距；面板不得遮挡“参数设置”标题、比例选择、思考等级、分辨率或输出格式控件。模板的选择、编辑、保存、插入、删除、关闭和已存储内容 SHALL 保持既有行为。tablet、stacked 与 mobile 布局 SHALL 使用可滚动的视口内回退面板，并保持关闭控件与表单字段可达。

#### Scenario: 桌面提示词模式打开模板面板

- **WHEN** 用户在 desktop 或 narrow-desktop 提示词模式点击提示词模板入口
- **THEN** Prompt Kit 面板左边缘位于主预览画布水平中线附近，并向右悬浮展开
- **AND** 左侧参数设置标题、比例选择和高级参数控件不被面板遮挡
- **AND** 用户可以继续选择、编辑、保存或插入模板

#### Scenario: 受限视口打开模板面板

- **WHEN** 用户在 tablet、stacked 或 mobile 布局打开提示词模板面板
- **THEN** 面板位于当前可视视口以内并可在内部滚动
- **AND** 模板列表与编辑表单以适合窄宽度的单列方式可达
- **AND** 用户可以使用现有关闭控件或既有关闭行为退出面板
