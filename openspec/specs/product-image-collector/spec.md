# product-image-collector Specification

## Purpose
约束商品图采集扩展的跨上下文调用、页面来源校验与控制器版本校验，确保后台把函数序列化注入商品详情页后仍能稳定执行，并在页面切换或扩展更新时安全失败。
## Requirements
### Requirement: Injected collector entrypoints receive explicit version inputs

商品图采集扩展 SHALL 将当前版本通过 `chrome.scripting.executeScript` 的 `args` 传入采集与面板入口。注入函数 SHALL 独立于后台闭包执行，同时校验页面 URL 和控制器版本。

#### Scenario: Current page controller receives a serialized invocation
- **WHEN** 后台向当前商品页注入采集或打开面板函数
- **THEN** 页面入口成功访问版本参数并调用对应控制器
- **AND** 不引用后台作用域变量

#### Scenario: Page or controller is stale
- **WHEN** 页面 URL 或控制器版本与请求不符
- **THEN** 入口返回明确失败且不调用控制器
