# expand-prompt-template-coverage

为 Prompt Kit 的 41 个二级分类补齐至少 20 条可核验的图片与提示词配对。

## Context

当前目录有 41 条 canonical 来源记录，但多数截图分类筛选项的覆盖不足 20 条。用户要求每个二级分类都能直接浏览不少于 20 条图文配对。

## Goals

- 保留现有 41 条本地图片与完整提示词的一一对应关系。
- 让每个二级分类在未搜索状态下展示至少 20 个不同的 canonical ID。
- 允许同一 canonical 配对被多个分类标签复用，不复制资源文件、不生成无法核验的占位图。
- 保持全部视图、搜索、灯箱、应用和复制流程不变。

## Non-Goals

- 不从 YouMind 或其他网站运行时抓取素材。
- 不修改用户模板、Prompt Agent 历史或生成流程。
- 不新增未经来源核对的图片和提示词。

## Impact

- `lib/prompt-template-library.mjs` 负责每个二级分类的稳定 20 条选择。
- `public/lib/prompt-template-library.mjs` 同步浏览器模块。
- `test/prompt-template-library.test.mjs` 增加覆盖数量与 canonical 复用检查。
- `openspec/specs/image-to-prompt/spec.md` 更新分类覆盖与资源复用规范。
