## ADDED Requirements

### Requirement: 套图按事实规划核心购买理由与可见功能

系统 SHALL 从当前已确认商品事实中规划整套主购买理由，明确主要事实、买家收益和功能的画面表现。已有功能事实时，自动规划 SHALL 安排实际可见的功能表现；仅有功能名称、参数、引用 ID 或暖色背景 SHALL NOT 视为功能覆盖。此规则 SHALL 跨类目生效，不依赖特定商品名称。

#### Scenario: 加热手套的核心功能需要可见表现
- **WHEN** 已确认资料支持手套加热且自动套图容纳功能表现
- **THEN** 计划包含完整商品主体上的热量或温暖收益表现
- **AND** 表现说明为创意示意，不凭空标注温度、发热范围或内部线路

#### Scenario: 非加热类目与非功能商品
- **WHEN** 当前事实支持其他商品功能或仅支持外观信息
- **THEN** 功能商品按自身事实分配可见功能任务
- **AND** 仅有外观事实的商品不套用加热、能量光效或虚构功能

### Requirement: 营销套图执行有上限的审核修复循环

系统 SHALL 在初稿通过事实与引用校验后审核功能遗漏、购买问题和证据重复及明显的版式同质化。存在可修复问题时 SHALL 最多进行两轮局部 AI 修复，每轮重新校验。合格项、用户锁定项、平台强制项和已确认分析 SHALL 保持不变。存在无法解决的关键问题时 SHALL 明确报告并阻止未经审核的套图进入生图；合格初稿 SHALL 不增加修复请求。

#### Scenario: 修复缺失的功能任务
- **WHEN** 初稿遗漏已确认核心功能的可见表现
- **THEN** 系统选择可调整位置进行局部修复并重新审核
- **AND** 其余合格提示词与参考图分配保持原样

#### Scenario: 修复耗尽或用户约束冲突
- **WHEN** 两轮后仍有关键问题或所有可用位置都被用户或平台锁定
- **THEN** 系统明确说明未解决问题和约束冲突
- **AND** 不无限重试、不静默替换锁定提示词或开始有缺陷的整套生图

#### Scenario: 已确认预览与历史补图
- **WHEN** 用户提交修复后的冻结预览或补齐历史计划
- **THEN** 生成与补图复用最终提示词、来源与审核元数据
- **AND** 不再次发起整套审核修复请求

### Requirement: 视觉表达依据任务而非固定信息图配额

自动规则规划 SHALL 按有效内容分配信息图，SHALL NOT 因为图片数量达到固定阈值而强制插入信息图。主图与场景图 SHALL 按当前购买任务选择构图，不把圆框、拼图和卖点条作为通用必需元素。功能渲染 SHALL 在一个完整主体和统一构图中突出主要功能及其收益，并只保留与当前任务有关的辅助功能证据。

#### Scenario: 功能渲染与场景图具有不同任务和画面
- **WHEN** 同一套图包含功能表现、使用场景和规格说明
- **THEN** 各图交代独立新增信息并使用适合任务的视觉形式和文字密度
- **AND** 不把三者都组织为大商品周围的重复信息小框


## MODIFIED Requirements

### Requirement: Creation Mode generates configurable ecommerce sets

The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, 12, 14, or 16 ecommerce marketing roles and SHALL allow the user to customize which of the 16 image roles are generated for the current set: hero, benefit, scene, multi-angle, atmosphere, product detail, brand story, size/capacity/fit, effect comparison, specification table, craft process, accessory/gift, series showcase, ingredient/material, after-sales, and usage suggestion. The system SHALL keep those role IDs stable while presenting conversion-oriented Chinese role labels: 首图成交主视觉, 目标人群共鸣图, 适用多场景图, 多角度产品展示图, 冲动下单氛围图, 产品细节特写图, 品牌质感/礼品价值图, 尺寸容量适配图, 功能效果渲染图, 参数规格图, 品质工艺证明图, 到手清单/配件图, 多款式/SKU选择图, 材质成分解析图, 痛点图, and 卖点图. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, home/living products, or a searchable fourth-level ecommerce category template. The system SHALL support a set-level visual-language selector that defaults to `classic-commercial` and keeps the generated set visually consistent across lighting, tone, material treatment, realism level, and brand atmosphere. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain 首图成交主视觉, 目标人群共鸣图, 适用多场景图, and 多角度产品展示图. Newly planned SKU items SHALL use one complete subject per distinct sellable SKU; only historical frozen plans may preserve a previously recorded combination count.

#### Scenario: User starts a conversion-oriented creation set

- **WHEN** the user submits product information and a target language in Creation Mode
- **THEN** the first planned item remains `hero` / 首图成交主视觉 and the second remains `benefit` / 目标人群共鸣图
- **AND** the hero prompt requests the reliable non-dimension product identity, description, selling-point, material, usage, scene, package, and trust facts that fit its bounded information hierarchy
- **AND** newly authored hero canvas copy uses the selected target language while physical product and packaging text remains unchanged
- **AND** the hero prompt emphasizes one memorable source-grounded buying reason with one dominant product and a task-appropriate composition, without mandatory circular scene frames or feature strips

#### Scenario: User selects the target-shopper resonance role

- **WHEN** a preset or custom subset contains `benefit`
- **THEN** the role is shown as 目标人群共鸣图 and its prompt depicts one recognizable target shopper, one concrete decision moment or pain context, and one emotionally credible reason to choose the product
- **AND** the prompt keeps that resonance framing as the single job of the role, with explicit selling-point stacks reserved for 卖点图

#### Scenario: User views a historical universal set with the former second selling-point label

- **WHEN** a saved historical item uses the stable second-slot identity `universal:benefit-proof` or another compatible second-slot `benefit` identity
- **THEN** the card and exported prompt heading are displayed as 目标人群共鸣图
- **AND** the later `universal:selling-point-stack` item remains displayed as 卖点图
- **AND** the stored manifest title, prompt, filename, and stable item ID are not rewritten

#### Scenario: User generates a high-intent atmosphere image

- **WHEN** the planned set includes `atmosphere` / 冲动下单氛围图
- **THEN** the prompt places the exact product inside a specific decisive ownership or usage moment with a visible action, target-user cue, and purchase-trigger emotion
- **AND** the prompt requires that purchase-triggering moment as the composition, with the product recognizable and commercially inspectable

#### Scenario: Preserved blocking policy is stricter than conversion guidance

- **WHEN** a current or preserved legacy slot has a blocking no-text, white-background, transparent, or no-collage constraint
- **THEN** the blocking constraint remains authoritative
- **AND** hero all-fact copy, circular scene frames, and scene stitching are omitted wherever they conflict with that policy

#### Scenario: User starts a creation set

- **WHEN** the user submits product information and a target language in Creation Mode
- **THEN** the system creates the selected number of planned image items
- **AND** the first four items use hero, benefit, scene, and multi-angle roles
- **AND** generation requests use only the references relevant to the current image role instead of attaching the full uploaded reference set to every image

#### Scenario: User selects eight images

- **WHEN** the user starts a Creation Mode set with 8 selected
- **THEN** the planned set includes atmosphere, product-detail, brand-story, and size/capacity/fit roles after the first four ecommerce roles

#### Scenario: User selects twelve images

- **WHEN** the user starts a Creation Mode set with 12 selected
- **THEN** the planned set includes effect comparison, specification table, craft process, and accessory/gift roles after the first eight ecommerce roles

#### Scenario: User adds SKU images from distinct product references

- **WHEN** Creation reference analysis identifies distinct sellable product subjects from uploaded white-background product images
- **THEN** the planned set appends one SKU image item for each distinct sellable product subject after the selected carousel roles
- **AND** SKU image items do not count against the selected 4, 6, 8, 10, 12, 14, or 16 carousel image count
- **AND** accessory-only, package-only, material-only, and scene references do not create standalone SKU image items
- **AND** each SKU prompt changes the background while preserving the subject shape, colors, markings, identifiers, and existing product logos
- **AND** if the user uploaded a Logo reference, each SKU prompt also applies that supplied logo while existing product identifiers stay visible

#### Scenario: New plans use one complete subject per SKU

- **WHEN** the user previews or generates a new Creation Mode set with distinct sellable SKU subjects
- **THEN** the UI does not expose a SKU combination-count control
- **AND** every appended SKU image prompt uses one complete instance of its matched SKU subject
- **AND** the plan and generation request do not accept a user-entered count for duplicating that subject

#### Scenario: User sets a same-SKU combination pack count

- **WHEN** a saved Creation Mode set created before this control was removed contains a frozen SKU combination count greater than one and the user repairs it
- **THEN** the repair keeps the saved count and frozen prompt semantics
- **AND** opening or repairing the record does not rewrite its manifest to one
- **AND** new Creation Mode plans do not expose or submit a user-entered combination count

#### Scenario: User customizes selected image roles

- **WHEN** the user selects a custom subset of Creation Mode image roles before generation
- **THEN** the generation request includes the selected role list
- **AND** the planned set image count equals the number of selected roles
- **AND** the planned items use the selected roles instead of only slicing the first preset roles

#### Scenario: User previews and edits the planned set before generation

- **WHEN** the user requests a Creation Mode plan preview before starting image generation
- **THEN** the system returns the same planned ecommerce image items without requiring API credentials
- **AND** the user can adjust one planned item prompt before generation
- **AND** the generation request uses that adjusted prompt only for the matching planned item

#### Scenario: User chooses a set visual language

- **WHEN** the user selects a visual language before previewing or generating a Creation Mode set
- **THEN** the plan-preview and generation requests include the selected `visualLanguage`
- **AND** every planned item prompt includes the same shared visual-language guidance
- **AND** individual item roles may still vary camera angle, framing, scene density, props, and information layout while keeping that visual language
- **AND** the generated set manifest stores both `visualLanguage` and `visualLanguageLabel`
- **AND** missing or unknown visual-language values fall back to `classic-commercial`
- **AND** the upload-image logo branch does not display or submit the visual-language selector

#### Scenario: Planner makes templated roles buyer-decision oriented

- **WHEN** the planned set includes roles such as benefit, multi-angle, atmosphere, brand story, effect comparison, craft process, accessory/gift, series showcase, ingredient/material, after-sales, or usage suggestion
- **THEN** each corresponding prompt answers a concrete shopper question before purchase, with after-sales framed as 痛点图 answering “这个产品具体帮我解决什么问题？” and usage suggestion framed as 卖点图 answering “我买它能获得哪些更明确的好处？”
- **AND** hard information roles such as size/capacity/fit and specification table remain governed by factual dimension or parameter requirements instead of emotional lifestyle conversion copy

#### Scenario: Planner gives every carousel role a shopper question

- **WHEN** the system builds a Creation Mode plan
- **THEN** every ecommerce carousel role prompt states the one pre-purchase question it answers, such as what the product is, why it matters, where it is used, whether details are trustworthy, what arrives in the box, which SKU to choose, what real usage pain is solved, or which concrete buyer benefits are gained
- **AND** the prompt still limits visible certifications, warranties, brand logos, parameters, effects, materials, and SKU options to supplied evidence

#### Scenario: Planner avoids rigid templates in promotional roles

- **WHEN** the planned set includes the scene, atmosphere, or effect comparison role
- **THEN** scene prompts treat the role as an `适用多场景图` that shows 2-4 believable usage scenarios with advertising campaign energy and layered depth
- **AND** effect comparison prompts treat the role as a `功能效果渲染图` that may use premium 3D/CGI or cinematic product visualization to show a supplied function, mechanism, effect path, or outcome in one unified product-led composition
- **AND** those prompts still limit visible technical structures, parameters, certifications, performance numbers, and effects to supplied facts

#### Scenario: User changes marketing scenario

- **WHEN** the user selects a Creation Mode marketing scenario such as livestream, marketplace search, gift guide, or brand story
- **THEN** the role picker updates to the scenario's recommended image-role combination
- **AND** the quick image count reflects the recommended role count when that count is supported
- **AND** the user can still manually add or remove image roles before generation

#### Scenario: User chooses a category industry template progressively

- **WHEN** the user opens the Creation Mode industry template browser
- **THEN** the main form shows a single current-category control instead of occupying the form with multiple category columns
- **AND** the system opens a floating dropdown that shows only first-level categories by default
- **AND** choosing a first-level category keeps the dropdown open and replaces the list with matching second-level categories
- **AND** choosing a second-level category replaces the list with matching third-level categories
- **AND** choosing a third-level category replaces the list with matching fourth-level category templates
- **AND** the main control displays the currently chosen category name while the user progresses through the hierarchy
- **AND** previous broad industry template choices such as apparel, beauty, food, consumer electronics, or home/living are not shown as selectable templates
- **WHEN** the user selects a fourth-level category template
- **THEN** the role picker updates to that category template's recommended role combination
- **AND** the planned prompts include the selected fourth-level category's path-specific visual and compliance guidance
- **AND** the generation and plan-preview requests include the selected category-coded industry template

#### Scenario: User searches third-level or fourth-level category templates

- **WHEN** the user searches Creation Mode industry templates by third-level category name, fourth-level category name, or category code
- **THEN** the system shows matching category templates named by their fourth-level category
- **AND** the search results only contain fourth-level category templates, not the previous broad industry templates
- **AND** the search does not return category templates for queries that only match first-level or second-level category names
- **AND** duplicate fourth-level names remain distinguishable by their full category path
- **AND** the selected category template is submitted using its unique category code
- **AND** the planned prompts include category-path-specific visual guidance for that fourth-level category

#### Scenario: Smart reference analysis selects a category template

- **WHEN** Creation reference-image smart analysis identifies a product category with enough context to match a fourth-level category template
- **THEN** the system switches the industry template control to that category template
- **AND** the role picker updates to that category template's recommended role combination
- **AND** the analysis feedback names the matched category path

#### Scenario: Product information is missing

- **WHEN** the user submits Creation Mode without product information
- **THEN** the system rejects the request with a visible validation message and does not start image generation

### Requirement: 功能效果渲染图以单一主体呈现完整功能

系统 SHALL 保持 `effect-comparison` 作为稳定内部角色 ID 和“功能效果渲染图”作为中文展示名。新建或重新规划的该角色 SHALL 在一个统一构图中以一个完整可见、占主导的商品主体突出有证据支持的主要功能、可见效果及买家收益，其他功能仅作为与当前任务相关的辅助证据。系统 SHALL 允许围绕同一主体使用箭头、局部剖视叠层、动态轨迹、能量或材质流向以及高级 3D/CGI 或电影级产品可视化，但 SHALL NOT 生成前后对比、左右并列、分屏、成对状态、重复商品主体或多面板对比布局。

#### Scenario: 用户规划功能效果渲染图
- **WHEN** 用户在 Creation Mode 中选择 `effect-comparison` 角色并提交商品资料
- **THEN** 计划提示词要求一个完整可见、占主导的商品主体和统一的功能可视化构图
- **AND** 提示词要求主要功能及其作用或收益在画面中可见，不以名称、参数卡或暖色背景代替效果，也不把创意示意说成实测
- **AND** 提示词禁止前后对比、左右并列、分屏、成对状态、重复商品主体和多面板对比布局
- **AND** 提示词仍禁止虚构未提供的技术结构、性能数字、认证或效果

#### Scenario: Different Creation entry points keep single-subject semantics
- **WHEN** a Creation workflow plans a functional-effect image
- **THEN** category and image-type guidance does not reintroduce comparison or split-panel composition
- **AND** the workflow uses the compatible internal image-type ID and single-subject visualization

### Requirement: Main carousel information coverage is evidence based

通用电商自动方案 SHALL 按独立购买问题与实际事实分配主轮播中的功能表现、场景、细节和必要信息说明，SHALL NOT 按图片数量强制设置固定信息图最低配额。有核心功能事实且有可调整位置时，功能的可见表现 SHALL 优先于重复的卖点总览或额外场景。追加源图重构 MUST NOT 代替主轮播的核心功能任务。事实不足时 SHALL 展示缺失资料并建议减少张数或跳过，MUST NOT 为满足配比虚构功能、步骤、内部结构、参数或商品变体。

#### Scenario: 功能优先于重复的信息总览
- **WHEN** 六张自动轮播有已确认功能，而没有独立功能表现位置
- **THEN** 系统优先将可调整的重复总览或额外场景改为功能表现
- **AND** 不因六张或十二张阈值额外强制加入信息图

#### Scenario: 追加重构不替代主套图的信息分工
- **WHEN** 用户启用额外源图重构且资料支持核心功能或其他独立购买信息
- **THEN** 主轮播按事实保留必要的核心功能表现与独立任务
- **AND** 追加重构不代替主轮播的功能覆盖，也不产生固定信息图配额

#### Scenario: 有效信息不足
- **WHEN** 商品只有少量可见外观事实，没有可靠参数、步骤或其他独立信息任务
- **THEN** 系统明确显示不能满足的独立任务并建议减少张数
- **AND** 不将同一卖点改写三次或重复同一照片来满足数量

### Requirement: 可选 AI 整套营销提示词一次规划全部图片

套图 SHALL 提供默认开启且可记忆的“AI 整套营销提示词”开关。开启后 SHALL 由电商视觉营销专家在正常成功路径的一次规划请求中返回全部 N 条可直接用于生图的提示词，并提供每项的图片类型、营销目标、受众、卖点/痛点、营销建议和参考图分配。缺少有效分析时 SHALL 在同一次请求中按现有契约补齐商品分析与参考用途。系统 MUST NOT 为每张图单独发出一次提示词规划请求。

AI 模式普通营销轮播 SHALL 支持 1–20 张，并以独立 ID 标识同一图型下不同的营销任务，MUST NOT 被现有 18 个固定槽位裁剪。SKU 与独立源图重构 SHALL 保持现有单独计数和执行规则。开关关闭时 SHALL 使用原有本地规划，0 张普通轮播 MUST NOT 发起空的 AI 规划请求。

系统 SHALL 在图片生成前校验返回数量、ID、图型、非空提示词、策略与事实引用、参考图编号和商品主体绑定。对于商品分析已确认的主主体和事实来源，若模型仅漏写其参考编号，系统 SHALL 将对应的可信原始上传编号补入逐图分配，再执行数量和字节预算校验。用户手动锁定的主体优先；否则主体索引 SHALL 在分析请求前确定，分析响应 MUST NOT 通过重排或修改辅助图角色悄然更换全套主体。MUST NOT 猜测未知来源、静默丢弃无效编号，或在补齐后超过单图参考上限和字节预算。真正缺少来源或无效的结果 MUST NOT 进入图片生成。

营销规划响应 SHALL 包含有事实依据的 `suite_strategy` 和非空的顶层 `items`；已有有效分析时只返回这两个字段。正常合格初稿仍为一次整套请求；初稿存在质量问题时 MAY 按有界审核修复循环对指定条目追加最多两轮局部修复。系统 MUST NOT 将截断的整套对象解析为其内部的任意 JSON 子对象。首次响应缺少整套条目时，系统 MAY 对全套做一次携带完整规划 schema 和所需条目数量的重试；若重试仍不完整，SHALL 显示明确错误，MUST NOT 把它报告为成功的零条计划或发出图片请求。

预览 SHALL 使用户能够核对逐图营销任务、最终提示词和参考分配。生成、队列、保存和补图 SHALL 使用同一份冻结的最终提示词与参考分配。系统生成的 `PRODUCT FIDELITY` SHALL 在新预览最终提示词中只出现一次，不附加分析外观锁；同一有效计划提交生成时 MUST 保持提示词字节内容不变。已有有效预览、普通重试和补图 MUST NOT 自动重新规划整套提示词；输入发生相关变化后 SHALL 使新草稿计划失效，并拒绝陈旧响应覆盖当前结果。

#### Scenario: AI 遗漏主体和事实来源编号

- **WHEN** 20 条完整计划已引用有效商品事实，但部分条目的参考索引遗漏事实来源图或预先确定的主主体图
- **THEN** 系统将分析已确认的来源编号补入逐图参考分配并保留原始上传编号
- **AND** 相同参考分配进入预览与后续图片请求
- **AND** 若补齐会超过 8 张或现有字节预算，系统明确拒绝，不静默删图

#### Scenario: 辅助图分析响应尝试更换主主体

- **WHEN** 规划前图 1 已被选作主主体，模型响应将图 2 提为商品主体或重排参考图
- **THEN** 系统仍将图 1 用作本套图主体，且图 2 不会被提升为整体主主体

#### Scenario: 流式规划响应被截断

- **WHEN** 模型响应只包含一个完整的内部商品事实对象，而整套 JSON 在 `items` 返回前被截断
- **THEN** 系统不将内部对象识别成完整套图计划
- **AND** 系统最多重试一次完整整套规划，之后仍不完整则显示明确错误，且不发出生图请求

#### Scenario: 已预览提示词包含参考图保真约束

- **WHEN** 用户提交一份已包含 `PRODUCT FIDELITY` 的有效预览计划
- **THEN** 冻结和生成阶段保留相同提示词且不重复插入同一保真约束

#### Scenario: 一次规划 20 张营销图

- **WHEN** 用户开启开关并选择 20 张普通营销轮播，且当前资料足以支持计划
- **THEN** 正常路径的一次规划请求返回 20 个唯一且完整的条目
- **AND** 计划、预览和生图不将条目裁剪为 18，也不逐图重复请求提示词

#### Scenario: 分配落实到实际图片请求

- **WHEN** 某条提示词选择主主体图及一张功能说明图作为依据
- **THEN** 该项图片请求使用计划中相同的提示词、图型和已校验参考分配
- **AND** 不只在文案中提到这两张图却发送其他无关参考或错误编号

#### Scenario: 生成直接使用已预览计划

- **WHEN** 用户核对过有效的 AI 整套预览后开始生成
- **THEN** 系统直接使用相同的最终提示词与参考图分配
- **AND** 不再次调用模型生成另一套内容

#### Scenario: 规划条目不完整

- **WHEN** 用户选择 20 张，模型完整响应只返回 18 条，或部分普通条目返回空提示词、重复 ID 或不存在的参考图
- **THEN** 系统标明缺少数量或移除对应无效条目，重新计算实际可生成数量
- **AND** 剩余任务有效且未破坏整套硬约束时可以生成，不静默填入模板条目
- **AND** 响应截断、没有可用营销条目或破坏平台必需项／用户锁定项时阻止生成

#### Scenario: 用户补图

- **WHEN** 某个已保存的 AI 规划图片生成失败并执行补图
- **THEN** 补图继续采用原记录中的最终提示词和参考分配
- **AND** 不重新生成整套提示词，也不使用当前其他商品的分析

#### Scenario: 用户修改商品或规划条件

- **WHEN** 商品资料、参考图、分析、语言、张数、平台、视觉风格、图型约束或开关发生影响规划的变化
- **THEN** 新草稿旧计划失效，需要重新规划
- **AND** 旧异步响应不能覆盖当前草稿，已排队和历史记录保留各自冻结计划

#### Scenario: 用户锁定单图提示词

- **WHEN** 用户在规划前明确锁定某张图的提示词或图型
- **THEN** 整套规划保留该项约束，并为其余图片安排互补的营销任务
- **AND** 用户手动内容不会被新规划静默覆盖

完整返回数量偏差和普通条目错误 SHALL 按“AI 营销规划隔离不可用条目并同步有效数量”处理；这些错误本身 MUST NOT 使其它有效条目失效。上述完整解析、来源真实性、冻结一致性和整套硬约束要求 SHALL 继续有效。

### Requirement: 营销任务区分真实使用价值并保持商品身份

整套营销规划 SHALL 明确每图用途、主要购买问题、适用场景或证据焦点，并优先安排有事实支持的不同使用任务。系统 SHALL 审核只更换近义标题、背景或色调的重复任务，并在有界质量循环内仅修复冲突项，保护已确认合格项和用户锁定项；不能靠删去质量问题项伪装成合格整套。主参考图保真约束 SHALL 保护商品身份、部件和表面归属、标识、数量及参考支持的状态，MUST NOT 以分析外观锁作为第二外观依据；场景适应 MAY 改变参考支持的姿态、动作、环境和光照，但 MUST NOT 创造商品能力。

#### Scenario: 白底图和到手清单姿态相似
- **WHEN** 两图主体姿态相似但分别回答商品外观和实际包装内容两个有据可核对的问题
- **THEN** 系统保留两项独立用途而不只凭姿态相似删除任务

#### Scenario: 两张雪景图只换近义标语
- **WHEN** 两项购买问题、动作和证据表达相同，仅背景或标题近义改写
- **THEN** 规划视图显示真实审核和局部修复阶段，修复后的任务提供独立新增信息
- **AND** 生成前仍遵守平台必需项、用户锁定项和原有事实校验

#### Scenario: 手套从静物改为骑行佩戴
- **WHEN** 商品事实与参考支持骑行握持表现
- **THEN** 场景和姿态可适应握持动作
- **AND** 掌面防滑区域、手背控制部件和标识保持正确归属

### Requirement: 相同规划复用并可追踪实际模型调用

系统 SHALL 按完整输入和实际模型配置合并相同在途规划，依据既有失效规则复用有效分析与确认计划。无有效分析直接规划的正常成功路径 SHALL 为一次模型请求；先识别再规划 SHALL 为两次独立用途请求；有效冻结计划生成或补图 SHALL 不产生额外文本规划。系统 SHALL 关联逻辑请求 ID、用途、触发来源、真实尝试数、重试原因与首次回答耗时，不记录凭据或原始图片内容。质量修复 SHALL 单独记录轮次、目标图片、剩余问题及失败原因；新规划契约 SHALL 使旧草稿缓存失效，但不改写历史产物或历史补图。

#### Scenario: 同输入连续点击预览
- **WHEN** 相同输入和模型配置已有进行中的预览请求
- **THEN** 后续消费者复用该进行中的请求而不新增模型 POST
- **AND** 一个消费者取消不影响其它仍在等待的消费者

#### Scenario: 复用已识别商品事实规划整套图
- **WHEN** 当前识别结果仍有效且用户请求营销规划
- **THEN** 营销规划复用已校验事实及其 ID，不要求模型重新输出整份分析
- **AND** 用户确认该计划后生成和补图复用同一冻结提示词与参考分配

#### Scenario: 查询一次操作为何发生多个上游请求
- **WHEN** 一个逻辑操作发生兼容重试或与另一操作相邻执行
- **THEN** 可通过逻辑请求 ID 和实际尝试记录区分独立操作与同操作重试
- **AND** 不以 token 数量或相近时间推定调用归属

### Requirement: AI 营销规划进度来自当前请求的可观测事件

系统 SHALL 在实际资料准备、模型请求、输出接收、计划校验和终态边界产生进度事件。上游提供流式文本时，系统 SHALL 在完整最终响应前更新实际接收量，并 SHALL 在完整字段尚未闭合时显示标注待校验的安全回答草稿；完整字段可进入分析或条目摘要，草稿不得用于生成。界面 SHALL 将接收条目数标为待校验，最终完整解析及营销校验完成后，全部有效才报告规划完成；移除普通错误条目后仍有可用任务且满足整套硬约束时报告部分可用。系统 MUST NOT 把心跳当作模型输出，MUST NOT 从截断响应的任意内部对象认定整套成功。

#### Scenario: 接收二十条中的部分条目

- **WHEN** 模型正在返回 20 条营销提示词且当前已有 8 个可独立解析的完整条目
- **THEN** 面板可显示已接收 8/20 及待校验状态
- **AND** 不将这些条目提交生图，也不把 SKU 与重构的额外任务计入 20 条

#### Scenario: 上游仅提供普通 JSON

- **WHEN** 上游在完整结果可用前没有提供可观测的文本增量
- **THEN** 系统继续显示等待与耗时，收到完整结果后再进行校验
- **AND** 不模拟按张返回或模型内部处理阶段

#### Scenario: 部分结果校验失败

- **WHEN** 完整解析后的响应中部分普通条目缺失、事实失效或参考分配无效，但仍存在满足约束的可用任务
- **THEN** 系统显示部分可用、实际通过数量以及缺少／移除清单
- **AND** 仅保留校验通过的任务用于生成，不把无效条目计入成功或未完成数量
- **AND** 无可用营销任务、响应无法完整解析或整套硬约束失败时仍显示失败阶段及原因

#### Scenario: 整套规划发生已有重试

- **WHEN** 现有协议回退或整套响应重试实际发生
- **THEN** 面板显示真实重试状态与尝试编号，并重置当前尝试的接收计数及部分摘要
- **AND** 不累计前一尝试的条目，兼容格式回退与 JSON 修复共用一次重试预算，单次协议请求最多两次上游 POST；有界质量修复属于明确展示的额外局部规划请求，最多两轮，并独立记录真实次数

#### Scenario: 连接结束但缺少终态

- **WHEN** 规划流结束而没有收到明确完成或失败事件
- **THEN** 系统显示连接中断并停止忙碌计时
- **AND** 不把已经收到的部分分析或条目当作成功计划
