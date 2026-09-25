## Why

Prompt Kit 当前的分类与用户给出的筛选截图不一致，而且 240 条目录项中多数使用通用合成预览，无法确保图片与提示词对应。需要以截图的使用场景、风格、主体三组分类重建目录，只保留可核验的本地配对内容。

## What Changes

- 将一级分类替换为“使用场景”“风格”“主体”，二级分类严格采用截图中的 41 个标签。
- 保留已有 40 条真实图片与提示词配对，并加入用户提供的厨房围裙图片和完整提示词。
- 为每条记录建立唯一的场景、风格、主体分类映射；跨维度筛选同一记录时不复制图片或提示词。
- 删除不对应真实提示词的通用合成预览与模板条目。
- 更新静态目录规范和配对验证，保持离线访问、搜索、列表/图片视图、应用及复制流程。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `image-to-prompt`: 替换 Prompt Kit 静态目录的分类、条目数和图文配对要求。

## Impact

- 数据和分类映射：`lib/prompt-template-library.mjs`、`lib/youmind-profile-entries.mjs` 及 `public/lib` 镜像。
- Prompt Kit 默认筛选和目录文案：`public/app.js`、`public/index.html`。
- 本地预览图片：保留已配对的 40 张来源图及新增厨房示例，删除合成预览图。
- 目录数据、图片存在性和前端浏览契约：`test/prompt-template-library.test.mjs`。
- 规范：`openspec/specs/image-to-prompt/spec.md`。
