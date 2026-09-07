## 1. 复现与回归测试

- [x] 1.1 补失败测试：`9:21`、`2:1`、`1:2`、`3:1`、`1:3` 搭配档位 `size`（`1K` 等）时，断言发送比例不是 `1:1` 且方向与请求一致（横向请求得到宽>高，纵向请求得到高>宽）。
- [x] 1.2 补测试覆盖 10 个受支持比例在档位 `size` 下原样透传。
- [x] 1.3 补测试覆盖 `size` 为可解析 `宽x高` 时优先使用 `size` 推导的比值，而非比例字符串。
- [x] 1.4 补测试覆盖比例缺失、空串和非法格式（如 `0:0`、`abc`）且 `size` 不可解析时仍回落 `1:1`。

## 2. 最小实现

- [x] 2.1 在 `getGeminiImageAspectRatio` 中，将比值来源从「仅 `size`」改为「`size` 优先，比例字符串兜底」，复用既有对数距离就近匹配逻辑。
- [x] 2.2 保留受支持比例的透传分支与 `1:1` 最终兜底；不改动 `getGeminiImageSize`、请求体结构和端点选择。
- [x] 2.3 如 `lib/responses-workflow.mjs` 在 `scripts/sync-public-lib.mjs` 清单内，同步 `public/lib/` 镜像。

## 3. 文档与验证

- [x] 3.1 更新两份 README 中 Gemini 比例段落：由「发送 `1:1`」改为「按方向就近匹配」，并列出五个比例的实际映射结果。
- [x] 3.2 运行聚焦测试与 `npm test`、`npm run sync:public-lib -- --check`、`npm run check:release`。
- [x] 3.3 运行 `npx --no-install openspec validate keep-gemini-unsupported-ratio-orientation --strict`、`git diff --check`，并复核新增中文为 UTF-8 且无乱码。
