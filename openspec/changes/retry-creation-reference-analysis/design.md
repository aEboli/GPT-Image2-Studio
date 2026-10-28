## Context

`analyzeCreationReferenceImages` 当前只发送一次 `POST /api/creation/reference/analyze`。服务端成功返回 HTTP 200 并不代表识别有效；空的 `recommendations` 或 `reference_roles` 仍会被直接应用。

## Decisions

### 客户端控制重试

在套图识别按钮对应的客户端流程中保留一个请求 token、参考图快照和 `AbortController`。每次尝试都重新构建 `FormData`，从而使用当前上传文件的完整数据。初次请求失败后执行最多 3 次重试，总尝试次数为 4 次。

一次响应只有在 HTTP 成功且 `analysis.recommendations` 或 `analysis.reference_roles` 为非空数组时才算有效。有效结果立即跳出循环并进入现有应用流程；失败结果更新识别反馈，显示当前重试次数。

### 取消与旧结果保护

每次循环开始前检查请求 token 和参考图快照。AbortError 继续交给现有 finally 清理；参考图被修改或发起新请求后，旧流程直接结束，不应用旧结果。重试不会改变服务端接口或历史记录。

## Verification Strategy

- 静态契约测试确认最大自动重试次数为 3、循环包含初次尝试、空结果进入失败分支，以及重试反馈包含当前次数。
- 运行 `node --test --test-concurrency=1 ./test/studio-preview-layout.test.mjs`。
- 运行 `git diff --check`。
- 运行 `npx openspec validate retry-creation-reference-analysis --strict`。
