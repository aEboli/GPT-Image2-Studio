## Why

套图生成时，每一项拿到哪些参考图由 `lib/creation-reference-labels.mjs` 的一张平铺允许角色表决定：`ITEM_SUPPORTING_REFERENCE_ROLES` 给每个图片角色列出允许的参考角色，命中即全部收进来。这张表没有优先级、没有数量上限，也不区分"必需支撑"和"可省支撑"，导致四类冗余：

- 同一支撑角色上传多张时全部附加。8 张上传的实测里，氛围图拿到 2 张场景图、材质图拿到 2 张结构图，纯按上传顺序堆叠，不按相关度取舍。
- `multi-angle` 与 `series-showcase` 的允许角色含 `product`，会把所有商品主体图一并附加。
- `human-handheld` 与 `human-wearable` 在表里没有条目，`roleFilters` 取到 `undefined` 后直接落进"返回全部上传图"的兜底，这两类真人演示图会拿到每一张上传图。
- coverage 计划未生成时（补图路径、冻结计划缺 `coverageSources`）走角色过滤兜底，`size-capacity-fit` 的允许角色 `["dimensions", "material"]` 会把结构细节图混进尺寸图。

另有一处与选图无关但叠加在同一份附件列表上：`appendCreationItemLogoReference` 只看图片类型的 `logoPolicy` 是否为 `allow-supplied`，事实类图片同样被附加 Logo。实测 Amazon 8 图套图中尺寸适配图拿到 3 张参考图（商品主体图、尺寸卡、Logo），其中 Logo 对"讲清尺寸"没有贡献；开启 Logo 会让整套图的参考图附加总数从 13 升到 18。经确认，套图模式整体不再接受 Logo，比逐个图片类型 gate 更容易收口；"上传图加 Logo"是独立分支，不在本次范围内。

参考图直接进入生成请求的输入，每一项多附加一张就多一轮图像编码开销，因此这件事同时影响输出准确度和套图整体生成耗时。

## What Changes

- 把平铺的允许角色表改成按图片类型声明的**参考图预算**：每个图片角色声明有序的支撑参考角色与支撑数量上限。选图先放主体锚点，再按声明顺序取支撑图，取满上限即止。
- 支撑角色列表按相关度排序，`size-capacity-fit` 与 `spec-table` 的支撑角色收敛为仅尺寸规格且上限 1，因此尺寸类图片稳定为"主体锚点 + 尺寸参考"两张。
- 优先级决定哪些支撑图入选，上传顺序决定附加顺序，与"按编号顺序读取参考图"的既有提示词语义保持一致。
- `multi-angle` 移除 `product` 支撑角色；`series-showcase` 保留 `product` 但封顶 2 张，多款式对比仍然成立。
- `human-handheld` 与 `human-wearable` 补上预算条目，不再落进返回全部上传图的兜底。
- 主体锚点不计入支撑额度，避免锚点本身占掉一个支撑名额。
- 参考角色元数据缺失时，每一项只附加主体锚点，不再回落为附加全部上传图。
- coverage 分支同样受支撑上限约束，使 coverage 路径与角色过滤兜底路径给出一致的数量上界。
- 套图生成与补图不再读取或附加上传的 Logo 参考图，轮播图项与 SKU 图项一并取消；套图与 SKU 提示词不再注入 Logo 放置指令。两处一并收敛，避免只掐图片导致模型凭空编造 Logo。
- 套图的生成、计划预览、补图三个表单不再提交 `logoImage` 与 `logoOptions`；对应服务端路由不再读取。
- 套图分支界面隐藏 Logo 上传、常用 Logo 库、位置与底色控件，这些控件收敛到"上传图加 Logo"分支。
- 图片类型的 `logoPolicy` 字段、`forbid-overlay` 提示词约束与 `ITEM_OVERRIDE_FIELDS` 覆写冲突校验全部保留：它们约束的是模型不得凭空添加品牌标记以及平台主图硬规则，与用户上传 Logo 是两件事。
- "上传图加 Logo"分支的上传、常用 Logo 库、位置、底色、独立 plan builder 与生成路由全部保留，行为不变。已保存记录中的 Logo 元数据保持可读，不做数据迁移。

## Capabilities

### Modified Capabilities

- `creation-mode`: 增加每个图片类型的参考图预算契约与角色元数据缺失时的兜底规则；移除套图与 SKU 的上传 Logo 附加和 Logo 指令注入，把 Logo 控件收敛到"上传图加 Logo"分支。

## Impact

- 选图与预算表：`lib/creation-reference-labels.mjs`，移除 `appendCreationItemLogoReference`。两个文件均为服务端专用，不在 `public/lib` 镜像清单内。
- 提示词注入：`lib/creation-planner.mjs`，移除 `buildCreationLogoGuidance` 及其在轮播图与 SKU 的两处调用；保留 `normalizeCreationLogoOptions`（"上传图加 Logo"仍依赖）。
- 服务端：`server.mjs` 的 `handleCreationGenerate`、`handleCreationRepair`、`handleCreationPlan` 移除 Logo 读取与注入；`createCreationReferenceUploadRegistry` 移除失去调用方的 `logoImage` 参数；删除死代码 `appendCreationLogoReference`。保留 `handleCreationLogoBatchGenerate`、`readCreationLogoImage`、`buildCreationLogoOptionsFromFormData`。
- 界面与客户端：`public/index.html` 给 Logo 块加 `data-creation-logo-batch-only`；`public/app.js` 的套图生成、计划预览、补图三个表单不再提交 Logo 字段。
- 测试：`test/creation-reference-labels.test.mjs` 更新固化三图行为与 Logo 附加的断言；`test/creation-server-static.test.mjs` 的 Logo 附加断言反转为"不存在"，并修正 `handleCreationGenerate` 切片边界——原正则会越过 `handleCreationLogoBatchGenerate` 一直切到 `handleCreationRepair`，把合法保留 Logo 的批量分支一起纳入断言范围。
- 不改变参考图上传上限、并发上限，或任何图片类型的构图、文字与场景策略。
