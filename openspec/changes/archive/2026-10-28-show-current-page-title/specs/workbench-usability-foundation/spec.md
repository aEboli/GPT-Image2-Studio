## ADDED Requirements

### Requirement: Browser title identifies the current page

浏览器页签标题 SHALL 使用 Image Studio - 当前页面名称的格式，页面名称 SHALL 复用当前界面语言下的导航名称。首次进入、页面切换和界面语言切换 SHALL 同步标题。无法取得有效页面名称时 SHALL 回退为 Image Studio。

#### Scenario: Open or switch a page
- **WHEN** 用户直接打开套图记录页面，或从其他页面切换至套图记录
- **THEN** 浏览器标题显示 Image Studio - 套图记录
- **AND** 其他页面使用各自的导航名称

#### Scenario: Change interface language
- **WHEN** 用户在套图记录页面切换界面语言为英文
- **THEN** 浏览器标题显示 Image Studio - Suite Records

#### Scenario: No page label is available
- **WHEN** 当前页面没有有效导航名称
- **THEN** 浏览器标题显示 Image Studio
