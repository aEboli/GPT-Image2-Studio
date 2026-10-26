## Why

套图模式的"图都差不多"由四个独立成因叠加，且历史上三次差异化改造（`2026-09-30-differentiate-creation-set-visual-formats`、`diversify-creation-scene-images`、`ground-creation-set-divergence`）都没有触及这些成因。

1. **叠加规则只按 imageType 去重，不按 role 去重，直接产出重复图。** `lib/creation-platform-resolver.mjs` 的 `replaceWithRecommendation` 仅判断目标 imageType 是否已存在；`apparel-fit` 把 `multi-angle` 换成 `scale-proof`（角色 `size-capacity-fit`），而基础 18 槽第 8 位已是 `dimension-fit`（同角色）。全量扫描 1578 个类目模板，**178 个（11.28%，全部集中在 C01 服饰）** 在 18 槽里产出两个角色相同、提示词逐字节相同的槽位。相邻的 `applyReferenceCoverageOverlays` 是做了角色判重的，只有类目叠加这一条入口漏了。
2. **用户输入的功效/安全宣称被原样放大到画面上，图片侧零护栏。** `buildCreationHeroInformationCoverageGuidance` 输出 "Hero coverage: every item in this list appears in that hierarchy: ..."，语义上是命令模型把每条事实都画上图；`Product facts` / `Selling points` 直取用户输入。实测输入"安全无毒材质 / 食品级认证 / 呵护宝宝肠胃"后 8/18 张提示词命中，智能手环 14/18，商品名含"美白"时 18/18。Listing 侧有完整宣称规则（`creation-listing-draft.mjs`、`creation-platform-resolver.mjs`），但图片规划器内没有任何过滤点。2026-09-17 的提示词压缩改造（`compactCreationPositiveInstruction`）还把 `without fake approval marks` 改写成 `with supplied approval marks`、`without unsafe usage` 改写成 `with safe, supported usage`，等于反向注入违禁词汇。
3. **画面形式是静态表，跨商品恒定。** `CREATION_ROLE_VISUAL_DIRECTIONS` 每个角色只有一句话，与商品、类目无关；三个 `scene-fit` 角色的 `directive` 文本完全相同。去掉三段共享样板后，18 个类目的最差配对仍然**恒定为同一组槽位**（0.773），说明问题在结构而非内容。
4. **类目数据对套图零贡献、真人角色数不分类目。** `creation-planner.mjs` 对 `category:` 模板把 `promptInstruction` 整段置空，导致 `detailHints` 从未进入套图提示词；真人角色固定 5 个（benefit / atmosphere / human-handheld / human-wearable / after-sales），对数码、工业等品类明显过量。

此外 19 个平台画像里实际只用得上 2 个，其余 17 个是无调用的配置重量。

## What Changes

- **类目叠加按角色判重。** `replaceWithRecommendation` 在替换前判断目标 imageType 的角色是否已存在于槽位集合；已存在则跳过叠加，保持槽位数量不变。
- **新增图片侧宣称护栏 `lib/creation-canvas-claim-guard.mjs`。** 按医疗功效、安全卫生、认证背书、价格促销、绝对化五组规则识别不可上图宣称，支持"品类词放行"（`安全帽`、`安全座椅`、`医用口罩`、`100%棉` 保留，`安全无毒`、`食品级认证` 剔除）。剔除发生在规划入口，因此整套图同时干净。
- **提示词侧配合。** `Hero coverage` 与 `Function coverage` 由"每一项都出现"改为"从这些已提供事实构建"；有文字的槽位追加一条 `CANVAS CLAIM POLICY`，只允许画布文字表达商品可见属性。
- **画面形式变体化。** 21 个角色的单句画面形式扩展为 3 个变体，只改镜头、景别、光线、拍摄瞬间，不改人物年龄与性别倾向（保证 5 个真人角色的 cast 仍互不相同）。变体按商品事实哈希选取，同一商品结果稳定，不同商品自动换版本。
- **保底图片任务。** 首图、尺寸/容量、信息图（参数表或卖点图）、细节、场景、多角度六类在整套图内保证存在；张数少于 6 时按原顺序取前 N 张，不硬塞。
- **真人角色按类目收敛。** 服饰/美妆/母婴 5 个，食品/宠物/家居 3 个，数码/家电/办公 3 个，工业 2 个，未选类目（通用电商）保持 5 个不变。被替换的槽位改用品类证明类图型（规格表、工艺证明、材质证明），且只在角色不重复时替换。
- **平台画像 19 → 2。** 仅保留通用电商与 Temu，其余 17 个平台的画像定义、来源条目与专属 prompt 分支删除；未知平台 id 回落到通用电商。保留 5 个平台专属图型（`amazon-main` 等）及其 4 条官方来源作为**历史冻结计划的兼容层**，避免老记录无法重新派生约束。

## Non-Goals

- 不改变上游模型、接口字段、尺寸档位与请求协议。
- 不修改 Listing 侧的平台注册表（`creation-listing-policies.mjs` 仍是 19 条，与套图平台是两套配置）。
- 不改写历史冻结的套图记录与已保存提示词；新规则只作用于新计划。
- 不做像素级去重、图片比对或生成后处理。
- 不新增依赖，不改动浏览器构建产物结构。

## Capabilities

### Modified Capabilities

- `creation-mode`: 套图槽位去重、画面形式变体、保底任务、类目真人角色预算、画布宣称护栏与平台画像收敛。
