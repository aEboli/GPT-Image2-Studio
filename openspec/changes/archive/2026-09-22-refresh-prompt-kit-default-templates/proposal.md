## Why

Prompt Kit 当前的内置模板集中在清晨通勤、家庭早餐等泛化日常场景，不能直接覆盖用户更常见的证件照、职业头像、电商商品图和宣传物料需求。用户希望默认入口打开后就能选择可直接复用的实用模板，并明确要求旧默认模板不再保留。

仅替换 `public/app.js` 中的默认常量还不够：已有用户会从 `image-studio-prompt-templates-v2` 读取旧模板。若不迁移，升级后的 Prompt Kit 仍会显示旧内置模板。因此本变更同时定义内置模板 ID 的版本化和浏览器本地存储迁移边界。

## What Changes

- 将 Prompt Kit 的十个内置模板替换为证件照、商务个人头像、电商白底主图、电商生活方式图、自然人像写真、时尚穿搭图、美食摄影、室内家居效果图、旅行城市纪实和社媒营销海报。
- 为新内置模板使用 `default-template-v2-*` ID，保留现有 `image-studio-prompt-templates-v2` 存储键，避免清空用户自定义模板和 Prompt Agent 历史。
- 读取现有模板时，发现一个或多个旧 `default-template-*` 内置 ID 就移除整套旧内置，并写入当前十个 v2 内置模板；其他自定义模板和 `prompt-agent-*` 模板沿用既有归一化结果与相对顺序。
- 对缺少存储键的首次使用继续加载新默认；显式保存的空数组继续表示用户清空了模板，不自动补回默认；迁移写入失败时仍使用已迁移的内存列表完成当前会话。
- 不改变模板编辑器、Prompt Agent 历史、生成 API、Creation Mode 状态隔离或模板存储键之外的数据格式。

## Non-Goals

- 不新增模板管理能力、模板搜索、远程同步或服务端默认模板。
- 不保留旧内置模板的用户编辑版本；旧内置 ID 属于本次明确替换范围，用户自定义模板仍然保留。
- 不替换用户已经保存的自定义提示词内容，也不改变图片反推模板的兼容归一化规则。

## Capabilities

### Modified Capabilities

- `image-to-prompt`: 更新 Prompt Kit 默认模板集合，并为旧内置模板提供浏览器本地存储迁移规则。

## Impact

- 前端默认模板和读取迁移：`public/app.js`。
- 默认模板静态契约与迁移边界测试：`test/studio-preview-layout.test.mjs`。
- 增量规范和设计记录：本 change 的 `specs/image-to-prompt/`、`design.md` 与 `tasks.md`。
- 不涉及 `lib/` 浏览器镜像，因此不新增 `public/lib` 同步产物。
