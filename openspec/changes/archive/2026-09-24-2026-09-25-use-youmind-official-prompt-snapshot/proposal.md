# use-youmind-official-prompt-snapshot

将 Prompt Kit 的静态目录完整替换为 YouMind 官方 GPT Image 2 提示词快照。

## Why

旧目录只有少量本地记录，并通过轮转复用填充分类；其中还包含用户单独提供的厨房素材。这不能证明每个分类中的图片和提示词都来自用户指定的 YouMind 网站。

## What Changes

使用官方仓库自动生成的中文 README 建立 126 条离线图片-提示词配对，并按截图中的 41 个二级分类提供每类 20 条记录。

## Context

分类构建继续允许同一官网记录跨维度复用，但每个显示项都引用同一条 canonical 记录的图片、完整提示词和来源归属。

## Goals

- 使用 YouMind 官方 `awesome-gpt-image-2` 仓库自动生成的中文 README 作为可复现快照来源。
- 保留每条记录的官网完整提示词、CMS 首图、详情页链接和 CC BY 4.0 归属。
- 每个截图二级分类展示 20 条不同的官网 canonical ID。
- 通过本地图片文件支持离线浏览，不在运行时抓取网站。
- 删除旧的自定义厨房图和旧头像目录，避免未映射素材继续进入发布包。

## Non-Goals

- 不修改用户个人模板、Prompt Agent 历史或图像生成流程。
- 不在运行时调用 YouMind 或 CMS API。
- 不伪造官网条目或生成占位图。

## Impact

- `scripts/import-youmind-prompt-library.mjs` 负责从官方 README 生成配对清单和本地预览。
- `lib/youmind-profile-entries.mjs` 保存 126 条官方来源记录；`public/lib` 保持同步。
- `lib/prompt-template-library.mjs` 按官网场景前缀和提示词内容进行三维分类，保持每个小分类 20 条。
- `public/assets/prompt-templates/youmind-gpt-image-2/` 保存每条记录的本地首图。
- Prompt Kit 测试验证来源、配对、覆盖数量和本地文件。
