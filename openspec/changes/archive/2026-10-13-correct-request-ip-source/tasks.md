# 任务

- [x] 1.1 新增通过 Studio 上游 transport 查询并校验公网出口 IP 的服务端 helper，包含超时、短时缓存和并发合并。
- [x] 1.2 将 `/api/config` 摘要与生图记录改为使用服务端出口 IP，移除入站请求 IP 解析。
- [x] 1.3 增加 IP 查询成功、失败、缓存及生图记录回归覆盖。
- [x] 1.4 运行聚焦测试、语法检查、严格 OpenSpec 校验和 `git diff --check`。

## Verification

- `node --test test/outbound-request-ip.test.mjs test/generation-background-submit.test.mjs test/studio-formatters.test.mjs test/gallery-store.test.mjs`: 37 passing.
- `node --check server.mjs`, `node --check lib/outbound-request-ip.mjs`, `npm run sync:public-lib -- --check`, strict OpenSpec validation, and `git diff --check` pass.
- Integration coverage sends a forged `X-Forwarded-For` value and confirms the config IP is not taken from it; generated Gallery records retain the config IP.
