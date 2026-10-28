# 页签标题显示当前页面名称

## Why

所有页面的浏览器页签均显示 Image Studio，多个页面同时打开时无法区分。用户明确要求在应用名称后追加当前页面名称，例如 Image Studio - 套图记录。

## What Changes

- 在现有页面切换入口同步 document.title，直接复用导航中已显示的页面名称。
- 切换界面语言时同步标题；无有效名称时回退为 Image Studio。

## 范围与验证

- 修改 public/app.js，补充 workbench-usability-foundation 增量规范。
- 执行覆盖全部路由、页面切换、界面语言和回退的回归测试，以及语法、差异和 OpenSpec 严格校验。
