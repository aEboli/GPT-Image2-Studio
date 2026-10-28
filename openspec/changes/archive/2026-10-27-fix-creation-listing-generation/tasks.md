## 1. Listing 请求修复

- [x] 1.1 增加 Chat Completions 请求体回归测试，断言发送 `messages` 和 `response_format`。
- [x] 1.2 实现按 `endpointPath` 选择请求协议。

## 2. 套图记录批量生成

- [x] 2.1 增加“批量生成 Listing”按钮和状态绑定。
- [x] 2.2 实现缺 Listing 筛选、顺序生成、失败继续和完成反馈。
- [x] 2.3 增加控制器回归测试，证明已有 Listing 被跳过和失败继续。

## 3. 验证

- [x] 3.1 运行 Listing Agent、Listing View 和浏览器静态契约测试。
- [x] 3.2 运行 `git diff --check` 和 OpenSpec 严格校验。
