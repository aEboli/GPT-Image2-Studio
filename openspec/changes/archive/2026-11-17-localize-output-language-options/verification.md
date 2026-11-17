# 语言选择中文显示与欧洲语言扩展验证

日期：2026-11-17。

- 修改前复现：新增的 13 项回归全部失败，确认原页面仍显示外文名称，新增代码被套图回落为英语、被拆解识别为自定义语言，且翻译请求缺少完整语言名称。
- 针对性回归：`node --test --test-reporter=spec test/output-language-options.test.mjs test/creation-planner.test.mjs test/reference-analysis-language.test.mjs test/image-decomposition-prompt.test.mjs test/creation-prompt-translation.test.mjs test/creation-canvas-language-boundary.test.mjs`，197/197 通过。
- 全量首次回归：`npm test` 执行 3341 项，3338 项通过。两项页面断言仍要求旧的外文选项名称，已按中文显示要求更新；另一项既有 Electron 输出格式布局测试未产出预期结果标记，单独原样重跑 1/1 通过，未改动其实现或断言。
- 最终相关回归：在首轮六个相关测试文件基础上加入 `test/studio-preview-layout.test.mjs`、`test/prompt-output-format-layout.test.mjs`，以 `--test-concurrency=1 --test-reporter=spec` 运行，390/390 通过，0 失败、跳过或取消；覆盖首轮所有失败项。未重复运行整套全量测试。
- 真实浏览器验证：运行当前完整页面和临时隔离的本地后端，在 1280、390 像素宽度分别检查融图分析、图片拆解、套图模式和快捷套图，共 8 组页面检查通过。所有预设名称为中文，四种新增语言可选，默认值及拆解自定义入口保留，快捷套图重新加载后保留所选波兰语；选择框未超出视口，无浏览器脚本错误。
- 真实规划接口验证：隔离后端的 `/api/creation/plan` 对 `it`、`pt`、`nl`、`pl` 均返回正确代码、中文标签及对应的提示词语言名称。
- 浏览器截图与结构化结果保存在本地忽略目录 `.codex/output-language-visual/`；检查脚本为 `.codex/output-language-qa.mjs`。
- 公共模块同步检查：`node scripts/sync-public-lib.mjs --check`，142 个模块通过。
- 发布事实检查：`npm run check:release` 通过；未创建新版本。
- 归档前严格规范检查：`openspec validate --all --strict --no-interactive`，73/73 通过。
- 已同步主规范并归档为 `2026-11-17-localize-output-language-options`；归档后全量严格规范检查 74/74 通过（工作区同时存在其他进行中的变更）。
- 修改过的脚本语法、UTF-8 编码、异常替换字符和 `git diff --check` 检查通过。

生成参数与翻译使用本地单元测试及模拟响应验证，浏览器外部请求被阻断；未调用真实付费生图或翻译接口。临时后端的数据、输出和配置与用户工作区及历史记录隔离，并在验证后清理。

## 运行中后台补充验证（2026-11-17）

- 用户反馈选择后跳回英语。对原 `localhost:3600` 后台复现：法语仍返回旧标签 `Français`，意大利语、葡萄牙语、荷兰语、波兰语均被回落为 `en`。同一份当前源码启动的隔离后台和临时 3601 后台可正确保留这些语言，确认原后台进程尚未加载更新后的模块。
- 保留原页面的参考图、表单和任务队列，等待六套图片及自动 Listing 全部结束后才重启原 3600 后台；未中断生成或排队任务，也未刷新原页面。本次故障无需额外修改业务源码。
- 重启后的真实 `/api/creation/plan` 接口逐项验证 11 种语言：请求代码、返回代码及语言覆盖值一致，全部返回中文标签。
- 在原 3600 地址的独立浏览器测试页逐项选择这 11 种语言，等待真实规划响应显示对应语言后检查选择框，全部保留所选值；未调用付费生图或文本模型。原页面仍保留商品名称“电加热触屏手套”和六套已完成结果。
- 接口结果、浏览器结果及截图保存在忽略目录 `.codex/creation-language-reset/`，分别为 `production-3600.json`、`production-browser.json`、`production-language-options.jpg`。测试页已关闭，临时 3601 后台已停止，原 3600 服务正常返回 HTTP 200。
