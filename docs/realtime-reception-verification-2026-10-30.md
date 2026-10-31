# 分析师与营销实时接收修复验证

日期：2026-10-30。

## 本次修复

- 营销详情和工具栏在等待期间持续显示相同时间基准；终态停止计时。
- 同阶段接收量和状态文案独立更新，不因摘要未变化而漏刷新，不重复替换逐图卡片。
- 相同草稿不再因计时刷新而重新解析和写入文本节点，保留阅读位置。
- 分析师在参考图准备期间立即显示真实状态，并持续计时；图片准备完成后再请求模型。过期或取消的准备不会继续发送图片请求，计时资源随请求释放。
- 显示实际回答里的商品名称、参考图说明、目标买家、购买动机和顾虑，以及营销策略和功能摘要；JSON 字符串未闭合时仍可查看安全草稿。

这些是既有实时输出契约内的修复，未改变用户选择的思考等级、模型调用策略或最终计划校验。

## 验证结果

先添加失败复现，再实现修复。最终相关回归共 251 项通过，0 项失败，包含等待计时、同阶段字符量、文本节点复用、取消准备、分析结果应用、陈旧请求隔离、跨块中文、流式协议及布局契约。

```powershell
node --test test/creation-product-name-autofill.test.mjs test/creation-marketing-diversity.test.mjs test/creation-marketing-missing-card.test.mjs test/creation-reference-analysis-race.test.mjs test/creation-reference-analysis-view.test.mjs test/creation-marketing-progress.test.mjs test/text-model-stream.test.mjs test/studio-preview-layout.test.mjs
```

套图端到端模拟还验证了单次规划、20 图生成及不重新规划的补图路径；与当时其它相关测试合计 27 项通过。该结果为模拟上游验证。

浏览器在隔离回放页使用实际 `public/lib` 模块和项目 CSS，确认：准备阶段立即显示；完整 JSON 到达前展示参考图观察与受众草稿；营销详情持续计时；字符量在同阶段从 250 更新到 500；面板内文字可读、可滚动。回放使用模拟数据，没有调用真实模型，也没有刷新用户正在运行的应用页面。

截图：`../.local/realtime-reception-preview/analyst-stream.jpg`。

模块同步检查通过（131 个模块）；语法、UTF-8 与异常替换字符检查通过；发布一致性检查通过（v0.2.086）；OpenSpec 全部严格校验通过（69 项）。

## 全量回归边界

一次完整 `npm test` 共 2847 项，2838 项通过、9 项失败。其中一处是本次更新进度回调后不再适用的静态断言，已修改并纳入最终 251 项通过结果，未再次运行全部测试。

其余失败涉及图片生成、原请求回查与运行时断言，相关后端实现不在本次修改范围。对这些失败单独复跑共 14 项，9 项通过、5 项失败（包含失败父测试）；仍失败的断言与额外的 `GET /` 健康请求相关，不能将当前工作区宣称为全绿。日志位于：

- `.local/realtime-reception-tests-20261030.log`
- `.local/realtime-reception-focused-20261030.log`
- `.local/realtime-reception-unrelated-20261030.log`

当前 `package.json` 未定义 `build:pages`，不能完成此构建项；本次不涉及 Electron 构建或安装包。

## 提速结论与待确认范围

用户截图的两次请求输出约 2 万／3 万 token，总耗时约 2／3 分钟；没有对应逻辑请求 ID，不能把其中任何一次归因到分析、初稿或修复。20 图测试夹具的 117 帧本地解析回放约 28 毫秒，不能解释截图的分钟级耗时，也不能替代实际模型基准。

减少重复分析、策划元数据与修复上下文，并区分资料准备、上游首包、回答和校验，是下一步建议。提案位于 `openspec/changes/reduce-creation-analysis-planning-latency/`，已严格校验，依照用户 AGENTS.md 尚待确认后实施；不将待确认工作归档为完成。

本次没有真实模型的前后耗时实测，不承诺总耗时已下降。官方 OpenAI 延迟文档检索未获得可用正文，直接读取分别被 403 与 Cloudflare 拦截；本报告的诊断依据为项目代码、截图与本地验证。

## 后续实施状态

用户于 2026-10-30 确认提速方案后，已完成阶段耗时、真实 HTTP 流式转发修复和重复请求内容精简。固定 20 图夹具的初稿请求体减少 9.94%、修复请求体减少 34.11%，完整最终提示词哈希相同；没有真实模型总耗时对比。最终验证和范围边界见 `openspec/changes/archive/2026-10-30-reduce-creation-analysis-planning-latency/verification.md`。服务端改动需要在当前任务结束后重启本地服务，再刷新页面。
