## Why

官方在 API 里上线了 GPT Image 2.5，`image_generation` 工具的 `model` 字段现在接受六个模型 ID，其中当代可用的是三个：`gpt-image-2`、`gpt-image-2.5-sunburst`（精修更准、出图更慢）、`gpt-image-2.5-flare`（速度更快）。注意没有裸的 `gpt-image-2.5`，2.5 只有 sunburst 和 flare 两个变体。

但路由模式（`imageRoute` 为 `a`）的生图工具模型在代码里是硬编码的，用户在界面上完全改不了：

```text
lib/image-route-config.mjs  getSelectedImageGenerationConfig()
  路由 A 分支固定返回 imageModel: DEFAULT_DIRECT_IMAGE_MODEL   // "gpt-image-2"
public/index.html           参数区固定渲染 <strong>gpt-image-2</strong>
```

管道其实已经通了：`createResponsesRequestBody` 会把传入的 `imageModel` 写进 `tools[].model`，只是路由 A 永远只喂给它同一个常量。所以缺的只是一处配置项，而不是一条新链路。

直接调用模式（路由 B）的「生图模型」是自由文本框，因为那条路要对接各家中继，模型名不可枚举。路由 A 走的是官方 `image_generation` 工具，取值集合是官方文档给定的固定集合，因此这一项应当只提供下拉选项、不允许自定义，避免把上游必然拒绝的模型名送出去。

## What Changes

- `lib/model-defaults.mjs` 新增 `IMAGE_TOOL_MODEL_OPTIONS`（`gpt-image-2`、`gpt-image-2.5-sunburst`、`gpt-image-2.5-flare`，顺序与官方模型目录一致）、`DEFAULT_IMAGE_TOOL_MODEL`（`gpt-image-2`）和 `normalizeImageToolModel()`。该数组既是下拉选项来源，也是白名单校验依据。
- 新增配置项 `imageToolModel`，贯通本地配置（含 `IMAGE_TOOL_MODEL` / `IMAGE_STUDIO_IMAGE_TOOL_MODEL` 环境变量）、浏览器私有配置、请求字段和公开配置投影。
- `getSelectedImageGenerationConfig()` 的路由 A 分支改为返回归一化后的 `imageToolModel`，替换原来的常量。
- 配置区「Responses 模型」下方新增「生图工具模型」下拉框（`<select>`，三个选项），提示词页参数区的「工具模型」改为跟随所选模型即时显示。
- 任何非白名单值——旧配置、环境变量、被改过的 DOM、伪造的请求字段——都在归一化时收敛为 `gpt-image-2`，不会透传给上游。
- 路由 B 的「生图模型」自由文本框和路由 C 的图像模型输入保持原样，不受影响。
- 清掉沿途写死 `gpt-image-2` 的记录点，避免它们谎报一个没实际使用的模型：`public/app.js` 四处乐观展示记录、`lib/views/quick-blend-view.mjs`、`lib/views/image-edit-view.mjs`，以及 `server.mjs` 的 PPT 清单（幻灯片本身是用 `getSelectedImageGenerationConfig` 生成的）。
- `formatImageModelLabel` 补上两个 2.5 模型的标签，否则 `gpt-image-2` 显示为「GPT Image 2.0」而 2.5 回落成裸 ID，灯箱与画廊里风格不一致。

图片编辑（含局部蒙版的 merge 与 sequential 两条策略）复用 `sharedGenerationOptions.imageModel`，因此随该配置一起改变，无需额外改动——但既有规范把编辑请求的 `model` 写成固定的 `gpt-image-2`，需要同步修订。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `runtime-configuration`: 新增三条要求，分别约束路由模式生图工具模型的可选集合/默认值/下拉专用录入方式与非法值收敛、出图质量档的可选集合与按模型能力的收敛行为，以及生成记录必须反映实际使用的模型；同时修订既有的「其他生成通道解析默认值」场景，使其不再断言路由 A 固定为 `gpt-image-2`。
- `image-edit-mode`: 修订「Image Edit calls the GPT Image 2 edits endpoint」，把请求的 `model` 从固定 `gpt-image-2` 改为已配置的生图工具模型，未配置时仍为 `gpt-image-2`。
- `local-mask-image-edit`: 修订「Merge strategy performs one local edit request」，同上。

## 质量档（GPT Image 2.5 的第二个能力缺口）

2.5 把质量上限从 `high` 提到 `xhigh` 和 `max`，但仓库里质量既没有界面控件也没有归一化：9 处服务端和 6 处客户端各自写 `config.defaults?.quality || "high"`，用户无处可改。

- 新增 `lib/image-quality-options.mjs`：`IMAGE_QUALITY_OPTIONS`（`auto`/`low`/`medium`/`high`/`xhigh`/`max`）、`DEFAULT_IMAGE_QUALITY`（保持 `high`，不改既有出图行为）、按模型过滤选项的 `getImageQualityOptions()` 和按模型收敛的 `normalizeImageQuality()`。
- `lib/model-defaults.mjs` 新增 `supportsExtendedImageQuality()`，只有两个 2.5 变体返回 true。
- 参数区把写死的 `质量 High` 换成 `qualityInput` 下拉，选项集合随工具模型变化；切换模型时重建选项。
- 质量随 `formData` 逐请求提交（此前 `buildGenerationFormData` 根本没发这个字段，服务端只能读配置默认值）。
- 服务端 9 处质量解析点全部改为 `normalizeImageQuality(formData.get("quality") || config.defaults?.quality, { imageModel })`；PPT 单页与补图条目各按自己的模型收敛（补图条目自带上游目标，模型可能与本次运行不同）。
- `mergeConfig` 在拿到归一化后的工具模型之后再收敛 `defaults.quality`，所以「只切模型、不动质量」也会把已保存的 `max` 降为 `high`。
- 新增 `IMAGE_QUALITY` / `IMAGE_STUDIO_IMAGE_QUALITY` 环境变量。

关于「任意分辨率」：查证后不做。自定义 `WIDTHxHEIGHT` 在 `gpt-image-2` 上本来就支持，不是 2.5 的新能力；而且现有 15 个比例的档位逐个验算都已满足官方约束（16 的倍数、比例 1:3~3:1、单边 ≤3840、总像素 655,360~8,294,400，其中 `2880x2880` 正好等于上限）。真要加自由输入框，是一个独立的 UX 变更，且要绕开「比例决定尺寸档位」这套贯穿套图/写真/PPT 的现有结构，不属于本次范围。

## Impact

- Code: 新增 `lib/image-quality-options.mjs`；改动 `lib/model-defaults.mjs`、`lib/image-route-config.mjs`、`lib/config-store.mjs`、`lib/browser-config.mjs`、`lib/request-private-config.mjs`、`lib/studio-formatters.mjs`、`lib/views/quick-blend-view.mjs`、`lib/views/image-edit-view.mjs`、`server.mjs`（`handleConfigPost`、PPT 清单与 9 处质量解析点）、`public/index.html`、`public/app.js`、`scripts/sync-public-lib.mjs`（新模块必须进清单，否则浏览器 import 404），以及同步镜像 `public/lib/`。
- Existing behavior: 工具模型默认仍是 `gpt-image-2`，质量默认仍是 `high`，未改配置的用户请求体与记录均不变。路由 B、路由 C、模型列表获取、连接测试与尺寸档位不变。套图/写真/文章插图/PPT 没有独立质量控件，继续读（现已归一化的）配置默认值。
- Docs: 两份 README 的「工具模型固定为 gpt-image-2」段落改为下拉选项表并补质量段落；`.env.example` 与两份 README 的环境变量清单新增 `IMAGE_TOOL_MODEL` 与 `IMAGE_QUALITY`。
- Tests: 新增 `test/image-tool-model.test.mjs` 与 `test/image-quality-options.test.mjs`（均含用真实 `requestImageEdit` 断言上游请求 `model` / `quality` 的用例）；`test/studio-preview-layout.test.mjs` 的参数区标记断言随新结构更新；`test/studio-formatters.test.mjs` 覆盖两个 2.5 标签；`test/browser-shell-modules.test.mjs` 的深比较快照补上新字段。
- Not in scope: 自定义 `WIDTHxHEIGHT` 自由输入（理由见质量档一节）。
