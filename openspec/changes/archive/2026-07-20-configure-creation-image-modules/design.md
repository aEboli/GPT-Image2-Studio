## Context

Creation Mode 的轮播项、追加 SKU 项和信息图重构项会经过浏览器表单、计划解析、队列快照、服务端提交及修复路径。当前 SKU 没有独立开关，而信息图重构在 HTML 与若干缺省布尔值归一化中都默认开启。工作区正在进行平台计划相关改动，因此本次实现必须复用现有状态和计划结构，只增加最小字段并保持源文件与 `public/lib` 镜像一致。

## Goals / Non-Goals

**Goals:**

- 为 SKU 追加项提供默认开启的独立模块开关。
- 将信息图重构的新建默认值统一改为关闭。
- 让预览、计数、队列、提交、持久化和修复都遵循同一显式开关值。
- 保留已保存 set 或 draft 中存在的显式布尔值。

**Non-Goals:**

- 不改变 SKU 组合件数、SKU 生成规则或参考图识别逻辑。
- 不改变平台轮播项、Listing Agent 或信息图重构提示词。
- 不迁移或重写历史 manifest；缺少新 SKU 字段的历史记录继续按兼容默认开启处理。

## Decisions

1. 使用与现有模块开关相同的 checkbox 标签结构。这样可以直接复用现有样式和键盘可访问行为，不引入新的控件组件。
2. 新字段命名为 `skuGenerationEnabled`，与 `infographicRebuildEnabled` 的语义一致，并在表单、计划、队列和 manifest 中透传。相比从 SKU 数量或参考图数量推断，显式字段能稳定区分“没有 SKU”与“用户关闭 SKU”。
3. 新建表单由 HTML 默认值建立 SKU 开、信息图关；归一化函数对缺失的 `skuGenerationEnabled` 使用 `true` 作为历史兼容默认，对缺失的 `infographicRebuildEnabled` 使用 `false` 作为新流程默认。已保存对象只要包含字段，就严格保留其值。用户选择 0 张轮播时进入现有专用重构模式，信息图重构仍被强制开启；追加 SKU 项继续由独立 SKU 开关决定。
4. 关闭 SKU 时在计划构建前清空 SKU 追加输入，使 `skuImageCount` 为 0、SKU 项为空且总计同步变化。轮播中的 SKU 选择/变体比较图属于平台轮播项，不受追加 SKU 开关影响。

## Risks / Trade-offs

- [旧 manifest 没有 SKU 开关字段] → 缺失值继续按开启处理，避免历史记录在修复时意外丢失 SKU 项。
- [浏览器、Node 和 Cloudflare 路径默认值漂移] → 增加共享计划/队列测试及服务端与 Cloudflare 参数断言，并运行 `sync:public-lib` 检查。
- [现有未提交平台计划改动发生冲突] → 只在相关函数和测试中追加字段，不重排或格式化邻近代码。
