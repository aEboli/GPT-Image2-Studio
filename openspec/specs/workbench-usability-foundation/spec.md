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
