## MODIFIED Requirements

### Requirement: Creation Mode resolves platform-specific automatic plans

系统 SHALL 提供带版本号的自动规划画像，且仅覆盖 `universal` 与 `temu` 两个平台。当用户未提供对应覆盖项时，所选画像 SHALL 决定轮播图片类型、顺序、推荐张数、逐项比例、分辨率档位、目标语言、构图、文字策略与场景策略。`universal` 画像 SHALL 保留通用电商兜底，并作为未知或已退役平台 id 的回落目标。

#### Scenario: 通用电商保留 18 个原生槽位

- **WHEN** 用户选择通用电商且不提供平台覆盖项
- **THEN** 规划器在 SKU 与信息图重构项之前生成 18 个轮播项
- **AND** 第一项为通用首图，映射到 `hero` 内容角色

#### Scenario: Temu 接收命名平台画像

- **WHEN** 用户选择 Temu 且不提供平台覆盖项
- **THEN** 规划器生成 8 个轮播槽位
- **AND** 首项为清爽目录主图，文字策略为 `none`、场景策略为 `studio-clean`

#### Scenario: 已退役平台 id 回落通用电商

- **WHEN** 计划输入里的平台 id 为 `amazon`、`etsy`、`xiaohongshu` 等已删除平台
- **THEN** 计划解析为 `universal` 画像并生成 18 个轮播槽位
- **AND** 解析结果不产生错误，历史记录仍可读取与补图

### Requirement: Image-count overrides preserve the compatible image-type catalog

系统 SHALL 在套图级数量覆盖低于当前平台兼容图片类型数时，继续在 `effectivePlan.slots` 中保留该平台全部已解析轮播槽位。数量覆盖 SHALL 决定默认启用哪些槽位：数量大于等于 6 时，首图、尺寸/容量、信息图（参数表或卖点图）、细节、场景、多角度六类保底任务 SHALL 优先启用，其余名额按原生顺序补齐；数量小于 6 时 SHALL 按原生顺序启用前 N 个。`effectivePlan.items`、`carouselImageCount` 与实际生成 SHALL 只包含已启用轮播槽位。

#### Scenario: 通用电商选择 5 张仍显示完整 18 种类型

- **WHEN** 用户在通用电商平台把套图数量设置为 5
- **THEN** `effectivePlan.slots` 与兼容图片类型区域保留全部 18 个通用电商原生类型
- **AND** 前 5 个原生槽位启用，其余 13 个未启用
- **AND** `effectivePlan.items`、`carouselImageCount` 与实际生成只包含 5 个启用轮播项

#### Scenario: 选择 8 张时保底任务优先启用

- **WHEN** 用户在通用电商平台把套图数量设置为 8
- **THEN** 已启用的 8 个槽位包含首图、尺寸、信息图、细节、场景、多角度六类保底任务
- **AND** 其余 2 个名额按原生顺序补齐
- **AND** 未启用的槽位仍在 `effectivePlan.slots` 中可见并可手动启用

#### Scenario: 数量不足 6 时不硬塞保底任务

- **WHEN** 用户把套图数量设置为 4
- **THEN** 系统按原生顺序启用前 4 个槽位
- **AND** 不为了凑齐保底任务而跳序启用后面的槽位

## ADDED Requirements

### Requirement: 套图槽位按视觉角色去重

系统 SHALL 在应用类目叠加、参考图覆盖或任何槽位推荐替换后，保证同一份套图计划内不存在两个 `role` 相同的轮播槽位。当推荐替换的目标 imageType 的角色已存在于当前槽位集合时，系统 SHALL 跳过该次替换，MUST NOT 原地替换出一个同角色的新槽位，也 MUST NOT 减少轮播槽位总数。

#### Scenario: 服饰类目不再产出两张版型图

- **WHEN** 用户选择任意 C01 服饰四级类目并生成 18 张套图
- **THEN** 计划中 `size-capacity-fit` 角色只出现一次
- **AND** `multi-angle` 槽位保留
- **AND** 不存在两个提示词逐字节相同的槽位

#### Scenario: 全部类目模板保持槽位唯一

- **WHEN** 对 1578 个四级类目模板逐一生成通用电商 18 张计划
- **THEN** 每个计划都包含 18 个角色互不相同的轮播槽位
- **AND** 任意两个槽位的提示词不逐字节相同

### Requirement: 不可上图宣称不进入套图提示词

系统 SHALL 在规划入口把用户输入的商品描述与卖点拆分为"可画事实"与"不可画宣称"。医疗功效、安全卫生、认证背书、价格促销、绝对化表述五组宣称 SHALL 被剔除，仅保留可画事实进入事实分配与提示词组装。命中词后紧跟商品名词时 SHALL 视为品类词并保留。系统 SHALL 在计划结果中暴露被剔除的宣称，并给出可见警告。商品名 SHALL NOT 被改写，但其内容 MAY 受画布宣称策略约束。

#### Scenario: 母婴卖点被剔除后可画事实保留

- **WHEN** 用户输入 `食品级硅胶 安全无毒 圆角设计` 与卖点 `安全无毒材质 / 食品级认证 / 呵护宝宝肠胃`
- **THEN** 计划的可画描述为 `硅胶 圆角设计`
- **AND** 18 张轮播提示词都不包含 食品级、安全无毒、认证、呵护、肠胃
- **AND** 计划的 `canvasClaims` 记录被剔除的宣称，并产生 `canvas-claim-removed` 警告

#### Scenario: 品类词不被误删

- **WHEN** 商品名为 `安全帽`、描述含 `儿童安全座椅`、卖点含 `医用口罩` 或 `100%棉`
- **THEN** 这些词原样保留在计划与提示词中
- **AND** 仅当同一词以宣称形态出现（如 `安全无毒`、`100%` 单独成句）时才被剔除

#### Scenario: 有文字的槽位携带画布宣称策略

- **WHEN** 计划项的文字策略不是 `none`
- **THEN** 该提示词包含 `CANVAS CLAIM POLICY` 段，限定画布文字只表达商品可见属性
- **AND** 文字策略为 `none` 的严格主图不包含该段

### Requirement: 画面形式随商品变化

每个套图角色的画面形式 SHALL 由多个变体组成，选取 MUST 是确定性的：同一商品事实重复构建 SHALL 得到相同变体；不同商品事实 SHOULD 得到不同变体组合。变体只 SHALL 改变镜头、景别、光线与拍摄瞬间，MUST NOT 改变该角色的 cast 年龄与性别倾向。同一份套图计划内各槽位的画面形式 SHALL 互不相同。

#### Scenario: 不同商品得到不同画面形式

- **WHEN** 分别用 `男士速干短袖T恤` 与 `不锈钢保温杯` 生成通用电商 18 张计划
- **THEN** 两个计划的首图画面形式不同
- **AND** 两个计划的细节图画面形式不同

#### Scenario: 同一商品重复构建结果稳定

- **WHEN** 用相同商品事实连续构建两次计划
- **THEN** 两次得到的画面形式逐项一致

#### Scenario: 五个真人角色的 cast 互不相同

- **WHEN** 任意商品在通用电商平台生成 18 张套图
- **THEN** `benefit`、`atmosphere`、`human-handheld`、`human-wearable`、`after-sales` 五个角色的 cast 年龄段互不相同
- **AND** 画面形式在 18 个槽位之间互不相同

### Requirement: 必要图片任务在整套图内保底

当轮播张数大于等于 6 时，每份套图计划 SHALL 至少包含首图、尺寸/容量、信息图（参数表或卖点图之一）、细节、场景、多角度六类任务。该保底 SHALL 在类目叠加、参考图覆盖、真人角色预算替换与数量覆盖之后仍然成立。

#### Scenario: 服饰类目保留多角度与尺寸

- **WHEN** 用户选择 C01 服饰类目并生成 18 张套图
- **THEN** 计划同时包含 `multi-angle` 与 `size-capacity-fit`
- **AND** 两个角色各只出现一次

#### Scenario: 工业类目收敛真人角色后仍保留保底任务

- **WHEN** 用户选择 C17 工业类目并生成 18 张套图
- **THEN** 真人角色不超过 2 个
- **AND** 六个保底任务全部存在

### Requirement: 真人角色数量按类目收敛

系统 SHALL 按类目决定套图中真人角色（`benefit`、`atmosphere`、`human-handheld`、`human-wearable`、`after-sales`）的数量上限，并 SHALL 在未选择类目时保持默认数量不变。超出上限时系统 SHALL 按固定顺序移除真人角色并替换为品类证明类图型，且 MUST NOT 替换出与既有角色重复的新槽位。

#### Scenario: 服饰与美妆保留 5 个真人角色

- **WHEN** 用户选择 C01 服饰或 C02 美妆四级类目
- **THEN** 计划的真人角色数量为 5

#### Scenario: 数码与家居收敛到 3 个

- **WHEN** 用户选择 C06 数码或 C07 家电四级类目
- **THEN** 计划的真人角色数量为 3
- **AND** 被替换的槽位改用品类证明类图型

#### Scenario: 工业收敛到 2 个

- **WHEN** 用户选择 C17 工业四级类目
- **THEN** 计划的真人角色数量为 2

#### Scenario: 未选类目时保持默认

- **WHEN** 用户未选择四级类目（使用通用电商模板）
- **THEN** 计划的真人角色数量保持为 5
- **AND** 槽位构成与改动前一致
