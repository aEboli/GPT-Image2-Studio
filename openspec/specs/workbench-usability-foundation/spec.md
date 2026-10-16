# workbench-usability-foundation Specification

## Purpose
定义 GPT-Image2-Studio 工作台的基础可访问性与维护护栏，包括交互控件的隐藏语义、全局错误公告、浮层焦点管理和浏览器共享模块同步。
## Requirements
### Requirement: Hidden UI states preserve correct interactive semantics
The system SHALL NOT place focusable or operable controls inside a subtree marked `aria-hidden="true"`. When a visible control is unavailable, the system SHALL expose its unavailable state with the native `disabled` state and `aria-disabled` where applicable.

#### Scenario: A hidden utility region contains controls
- **WHEN** desktop utility actions or a custom Gallery scroll control are visually unavailable
- **THEN** no operable descendant is hidden from assistive technology by an `aria-hidden="true"` ancestor
- **AND** any rendered unavailable control is disabled and exposes its unavailable state semantically

### Requirement: Asynchronous errors are announced globally
The system SHALL expose the global error banner as an assertive alert while it contains an error message, and SHALL clear and hide the banner when the error is dismissed.

#### Scenario: An asynchronous operation fails
- **WHEN** the application reports an asynchronous error through the global error handler
- **THEN** the error banner is visible with `role="alert"` and `aria-live="assertive"`
- **AND** the banner contains the compact user-facing error message

#### Scenario: The global error is cleared
- **WHEN** the application clears the global error
- **THEN** the error banner contains no stale error message
- **AND** the banner is hidden from the visible interface

### Requirement: Floating workbench surfaces manage focus transitions
The system SHALL capture the active trigger before opening the configuration drawer, Prompt Agent, or Lightbox, SHALL move focus to that surface's close control, and SHALL restore focus to the surviving trigger when the surface closes.

#### Scenario: A user opens a floating workbench surface
- **WHEN** the user opens the configuration drawer, Prompt Agent, or Lightbox from a focusable trigger
- **THEN** the system records the trigger before opening the surface
- **AND** focus moves to the surface's close control

#### Scenario: A user closes a floating workbench surface
- **WHEN** the user closes the configuration drawer, Prompt Agent, or Lightbox
- **THEN** focus returns to the recorded trigger when that trigger remains connected to the document

#### Scenario: Prompt Agent applies content to Studio
- **WHEN** the user applies a Prompt Agent result to the Studio prompt field
- **THEN** the Prompt Agent closes without restoring focus to its former trigger
- **AND** focus moves to the Studio prompt input

### Requirement: Browser shared-module synchronization uses one tested target registry
The system SHALL expose one exported registry of browser-served shared-module synchronization targets, and the synchronization check SHALL validate every target in that registry.

#### Scenario: Public library synchronization is checked
- **WHEN** the public-library synchronization check runs
- **THEN** it checks every module declared in the exported synchronization target registry
- **AND** it reports drift when a declared browser copy does not match its source module

### Requirement: Displayed resolution is the produced image's own pixel size

界面上单值展示的「分辨率」SHALL 是成品图文件量出来的真实像素尺寸，而不是请求档位。
该规则 SHALL 覆盖主预览元信息、胶片条标题、瀑布画廊卡片、最近输出列表，以及各模式的元信息条。
请求档位与实际尺寸经常不同——请求 2048×2048 实际出 1254×1254 是常见情况，套图模式下档位还会被平台档案改写，
所以拿请求值当分辨率显示是错的。历史条目没有实测尺寸时 SHALL 退回请求值，SHALL NOT 显示空白。

参数复盘面板不受此约束：它 SHALL 继续同时列出「请求分辨率」与「实际生成分辨率」两项，因为那里的用途正是对照两者。

#### Scenario: Requested and produced sizes differ
- **WHEN** 一张图请求 2048×2048，落盘文件实测为 1254×1254
- **THEN** 主预览、胶片条、画廊卡片与最近输出都显示 1254×1254
- **AND** 参数复盘面板分别显示「请求分辨率：2048x2048」与「实际生成分辨率：1254x1254」

#### Scenario: A legacy entry was never measured
- **WHEN** 历史条目只有请求档位、没有实测尺寸
- **THEN** 显示该请求档位，不显示空白

### Requirement: Traditional interface palettes
The configuration drawer SHALL expose an allowlisted traditional-colour palette, persist the selected palette locally, and apply it to the shared interface tokens without changing the existing dark/light theme contract. The theme section SHALL show the seven preset options in a four-column grid. Each option SHALL contain only its palette swatch and concise visible name; Chinese visible names SHALL contain two characters. The theme section SHALL NOT expose custom-colour inputs or floral-accent controls, and legacy custom-colour or floral-accent local-storage values SHALL NOT affect the interface.

#### Scenario: Select and restore a palette
- **WHEN** a user selects a named palette and reloads the workbench
- **THEN** the same palette is applied before the first stylesheet paint and its radio control is marked selected.

#### Scenario: Configuration sections keep their fields isolated
- **WHEN** the configuration drawer is opened
- **THEN** it exposes four mutually exclusive sections named `路由模式`, `直连模式`, `Gemini`, and `主题`
- **AND** selecting a route section shows only that section's connection fields and disables the other route fields
- **AND** selecting `主题` shows only the standalone palette and theme controls, with no route-specific connection fields visible

#### Scenario: Palette options stay compact inside the theme section
- **WHEN** the `主题` section is selected
- **THEN** the standalone palette card contains the palette controls in four columns per row
- **AND** every option contains a swatch and a two-character Chinese name without custom-colour or floral-accent controls

#### Scenario: A user has prior custom theme settings
- **WHEN** local storage contains values from the removed custom-colour or floral-accent features
- **THEN** the workbench applies only its selected preset and dark/light theme
- **AND** no custom colour or floral decoration is sent to the embedded Temu workbench

### Requirement: Prompt library remains scannable across device layouts

The template-library surface SHALL provide reachable category controls, view controls and apply actions on desktop, tablet and mobile layouts. Long names and prompts SHALL wrap within their parent cards, and the category/navigation regions SHALL remain scrollable without clipping the active control.

#### Scenario: User browses on a narrow viewport

- **WHEN** the template library is opened on a phone or narrow tablet
- **THEN** category controls can be reached by horizontal or vertical scrolling
- **AND** the result cards fit the viewport without horizontal page overflow
- **AND** the close, view and apply controls remain reachable with a coarse pointer

#### Scenario: User navigates the library with keyboard focus

- **WHEN** a library card or category control receives keyboard focus
- **THEN** the focused control has a visible focus treatment
- **AND** the same apply and preview actions are available without pointer hover

### Requirement: Parameter selectors use concise values

思考等级选择器 SHALL 只显示等级名称，不显示预计耗时。具体像素分辨率选择器 SHALL 只显示像素宽度与高度，不显示 `xK`、`720P` 或“最大”等档位标签。选择器 SHALL 保留现有 `value`、默认值和请求参数语义；模型协议路由的 provider scale 选项不受本要求影响。

#### Scenario: Reasoning selector has no time estimate

- **WHEN** 用户打开思考等级选择器
- **THEN** 选项显示 `Low`、`Medium`、`High`、`XHigh`
- **AND** 选项文本不包含预计耗时

#### Scenario: Concrete resolution selector has no tier prefix

- **WHEN** 用户打开具体像素分辨率选择器
- **THEN** `1024x1024` 选项显示为 `1024 x 1024`
- **AND** 最大像素值仍然可以选择，但其文本不显示“最大”
- **AND** 选择后提交的 `value` 仍为原有像素字符串

### Requirement: 图片裂变工作台停止提供
应用 MUST 移除图片裂变工作台的菜单、页面、懒加载注册、专属前端模块、样式及商品组图分析契约。当前功能文档 MUST 不再将其列为可用能力，其他创作与资产管理功能 SHALL 保持可用。

#### Scenario: 用户浏览创作菜单
- **WHEN** 用户打开创作菜单
- **THEN** 不显示图片裂变工作台入口，页面不包含该功能的控件

#### Scenario: 用户打开旧链接
- **WHEN** 用户访问 `#product-agent`
- **THEN** 应用使用现有未知视图规则显示提示词生图，且不会加载已移除的模块

#### Scenario: 维护分析模式与功能文档
- **WHEN** 维护者检查当前分析契约和功能说明
- **THEN** 不存在商品组图分析专属模式、提示词、Schema 或配置分支，当前功能列表不再列出该工作台
- **AND** 历史发布记录和用户生成资产仍保留

### Requirement: 增强模式默认提示词以保留创作意图为前提提升清晰观感

提示词生图工作台的增强模式 SHALL 提供可编辑的英文默认画质优化文本，包含一次 `8K ultra-HD look`，并描述清晰主体、准确对焦、自然边缘、符合原风格的细腻纹理、平滑渐变和清楚层次。该文本 SHALL 明确原始提示词与参考图要求优先，保留主体、身份、数量、构图、比例、文字、风格、色彩、光照和材质，并仅抑制非预期模糊、锯齿、色带、压缩伪影、过度锐化与重复细节。

默认文本 SHALL 保留有意的景深、散景、柔焦、颗粒、运动模糊、像素风和简约表现，不要求额外物体、额外细节或将画质词绘制为文字。8K SHALL 仅表示画质目标，输出尺寸 SHALL 遵循生成参数。默认文本 SHALL 在现有 500 字符输入上限内，页面初始内容与脚本默认常量 SHALL 保持一致。

#### Scenario: 开启增强模式提交提示词

- **WHEN** 用户开启增强模式并使用默认增强文本提交生成
- **THEN** 提交提示词包含完整原始提示词和默认画质优化文本
- **AND** 文本声明原始提示词与参考图要求优先，且不强制加入微距、写实摄影、颗粒或电影光照风格

#### Scenario: 原始创作要求包含有意模糊或简约风格

- **WHEN** 用户要求柔焦、散景、运动模糊、胶片颗粒、像素风或简约表现
- **THEN** 默认增强文本明确保留这些有意效果，不要求凭空增加细节

#### Scenario: 关闭增强模式或自定义增强文本

- **WHEN** 用户关闭增强模式或将增强文本清空
- **THEN** 沿用既有行为，仅提交原始提示词
- **WHEN** 用户编辑增强文本并开启增强模式
- **THEN** 沿用既有行为，附加用户当前编辑的内容
