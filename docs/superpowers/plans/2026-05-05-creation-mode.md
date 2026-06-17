# Creation Mode Plan Archive

状态：已完成并归档。

这个文件原本是套图模式的早期执行计划。当前套图模式已经扩展为 OpenSpec change `add-creation-mode` 下的完整功能集，事实来源以 `openspec/changes/add-creation-mode/` 为准。本文只保留历史摘要，不再作为待执行计划使用。

## 已落地范围

- 独立套图模式入口、路由、状态和样式。
- 4 / 6 / 8 / 10 / 12 张套图数量与 12 个电商图片角色。
- 多营销场景、场景推荐角色组合和场景内角色提示词策略。
- 套图专属参考图、用途标签、智能识别建议和显式应用步骤。
- 生成前计划预览、单张计划提示词微调和生成时复用微调内容。
- 生成、失败项补齐、未完成项补齐和单张重生成。
- 套图记录页、搜索、复用到当前套图、打开套图文件夹、复制图片路径。
- 历史参考图重传队列、手动绑定历史参考图，以及重传后继承历史用途和备注。
- 通用电商、服饰鞋包、美妆个护、食品饮料、3C 数码和家居生活行业模板。

## 当前事实来源

- `openspec/changes/add-creation-mode/tasks.md`
- `openspec/changes/add-creation-mode/specs/creation-mode/spec.md`
- `README.md`

## 当前验证入口

- `test/creation-planner.test.mjs`
- `test/creation-store.test.mjs`
- `test/creation-server-static.test.mjs`
- `test/studio-preview-layout.test.mjs`
- `cmd /c npm test`
- `cmd /c npm run build:pages`

后续如果继续做更细分行业模板、套图记录更复杂的导出能力等增强，应新建明确任务或 OpenSpec change，不应在这个归档计划里继续追加待办。
