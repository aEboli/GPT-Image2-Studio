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

### Requirement: Selected image downloads report independent submission results

商品图采集扩展 SHALL 以有界并发将每张已选图片独立提交到浏览器下载队列。单张提交失败 SHALL NOT 阻止其他已选图片继续提交。扩展 SHALL 向采集窗返回已提交数量、失败数量及可用的首个错误信息；全部提交失败时 SHALL 显示明确错误。

#### Scenario: All selected images are accepted

- **WHEN** 用户提交多张已选商品图且浏览器接受全部下载请求
- **THEN** 每张图片均进入浏览器下载队列
- **AND** 采集窗显示已提交的图片数量和目标目录

#### Scenario: One selected image cannot be submitted

- **WHEN** 浏览器拒绝其中一张图片的下载请求
- **THEN** 扩展继续提交其他已选图片
- **AND** 采集窗显示已提交数、失败数及首个错误信息

#### Scenario: No selected image can be submitted

- **WHEN** 浏览器拒绝所有下载请求
- **THEN** 采集窗显示明确的下载错误
- **AND** 下载操作结束后按钮恢复可用

### Requirement: Download submission has visible and accessible busy feedback

当下载请求尚未全部提交完毕时，商品图采集窗 SHALL 显示忙碌文案和轻量动态反馈。状态 SHALL 通过 `role="status"` 和 `aria-live="polite"` 告知辅助技术，并在忙碌期间设置 `aria-busy="true"`。操作结束或失败后 SHALL 清除忙碌状态。系统启用减少动态效果时，动态 SHALL 停止，文案和静态状态反馈仍可见。

#### Scenario: Download submission is in progress

- **WHEN** 用户提交已选图片且后台尚未返回结果
- **THEN** 采集窗显示正在提交的图片数量
- **AND** 状态行显示忙碌动画，下载操作保持禁用

#### Scenario: Download submission ends or fails

- **WHEN** 后台完成提交或返回错误
- **THEN** 忙碌动画停止且 `aria-busy` 恢复为 `false`
- **AND** 采集窗显示结果或错误信息

#### Scenario: Reduced motion is enabled

- **WHEN** 用户启用 `prefers-reduced-motion: reduce` 且下载正在提交
- **THEN** 状态行不播放动画
- **AND** 忙碌文案和静态状态色仍然可见
