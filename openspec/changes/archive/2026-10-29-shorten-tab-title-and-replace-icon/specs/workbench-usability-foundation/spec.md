## MODIFIED Requirements

### Requirement: Browser title identifies the current page

浏览器页签标题 SHALL 使用 IS - 当前页面名称的格式，页面名称 SHALL 复用当前界面语言下的导航名称。首次进入、页面切换和界面语言切换 SHALL 同步标题。初始静态标题和无法取得有效页面名称时的回退标题 SHALL 为 IS。

#### Scenario: Open or switch a page
- **WHEN** 用户直接打开套图模式，或从其他页面切换至套图模式
- **THEN** 浏览器标题显示 IS - 套图模式
- **AND** 其他页面使用各自的导航名称

#### Scenario: Change interface language
- **WHEN** 用户在套图记录页面切换界面语言为英文
- **THEN** 浏览器标题显示 IS - Suite Records

#### Scenario: No page label is available
- **WHEN** 初始页面尚未完成初始化，或当前页面没有有效导航名称
- **THEN** 浏览器标题显示 IS

## ADDED Requirements

### Requirement: Browser icons share the selected artwork

浏览器 ICO、PNG、触屏图标及网页清单图标 SHALL 使用同一张用户指定的图片。PNG SHALL 保留透明度并提供 1024x1024 尺寸，ICO SHALL 包含适用于浏览器页签的 16x16 和 32x32 尺寸。更换图片时，HTML 和网页清单中的图标引用 SHALL 更新缓存版本。

#### Scenario: Replace the browser icon
- **WHEN** 浏览器加载更新后的 HTML 或网页清单
- **THEN** 图标引用使用新的缓存版本
- **AND** 各图标入口返回由用户指定图片生成的静态资源
