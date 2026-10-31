## ADDED Requirements

### Requirement: 商业 CG 渲染替换冲动下单氛围图

系统 SHALL 在新规划中将原 atmosphere / ownership-atmosphere 图型显示为“商业 CG 渲染图”，保留既有角色、图型与槽位标识。该图 SHALL 聚焦商品体积、真实材质区分、主光与轮廓光、接触阴影及空间反射，沿用参考支持的商品结构、配色和视角，不以塑料质感或平面装饰光效代替渲染。该图 SHALL NOT 强制真人或生活操作场景，不消耗独立操作场景，不纳入真人角色配额。既有手动提示词、平台硬约束和历史冻结内容 SHALL 保持有效。

#### Scenario: 同时选择商业 CG 与功能图

- **WHEN** 用户选择 atmosphere 和 effect-comparison
- **THEN** 两个角色分别保留，前者表现材质与立体商业视觉，后者解释有依据的功能作用
- **AND** 商业 CG 不因为缺少独立使用场景或不适合真人出镜而被跳过或替换

#### Scenario: AI 自主安排商业 CG

- **WHEN** AI 营销根据商品事实和整套任务策划图片
- **THEN** 系统允许 commercial-cg 视觉形式，并提供商品建模质感、商业布光与空间表现的创意方向
- **AND** 不强制商业 CG 张数、标题或营销词，纯外观 CG 不需要功能事实，也不自动视为核心功能覆盖

### Requirement: 功能渲染加强空间作用表现

系统 SHALL 保留 effect-comparison / comparison-proof 与“功能效果渲染图”，围绕一个完整商品呈现有依据的主要功能与买家收益。功能效果 SHALL 通过符合商品的流动、前后遮挡、纵深及合理局部光照表现空间关系，SHALL NOT 仅依靠平面箭头、装饰描边或暖色背景。系统 SHALL 保持参考支持的主体结构、材质、颜色、视角和可见数字，不补造内部元件、作用范围或参数。

#### Scenario: 功能与材质任务独立

- **WHEN** 同套图包含商业 CG 与功能效果渲染
- **THEN** 功能图继续以有据的作用、流动或结果为主要证据，CG 图以商品材质和体积为主要视觉任务
- **AND** 两者不能只替换背景、标题或重复同一购买信息

## MODIFIED Requirements

### Requirement: Creation Mode generates configurable ecommerce sets

The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, 12, 14, or 16 ecommerce marketing roles and SHALL allow the user to customize which of the 16 image roles are generated for the current set: hero, benefit, scene, multi-angle, atmosphere, product detail, brand story, size/capacity/fit, effect comparison, specification table, craft process, accessory/gift, series showcase, ingredient/material, after-sales, and usage suggestion. The system SHALL keep those role IDs stable while presenting conversion-oriented Chinese role labels: 首图成交主视觉, 目标人群共鸣图, 适用多场景图, 多角度产品展示图, 商业 CG 渲染图, 产品细节特写图, 品牌质感/礼品价值图, 尺寸容量适配图, 功能效果渲染图, 参数规格图, 品质工艺证明图, 到手清单/配件图, 多款式/SKU选择图, 材质成分解析图, 痛点图, and 卖点图. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, home/living products, or a searchable fourth-level ecommerce category template. The system SHALL support a set-level visual-language selector that defaults to `classic-commercial` and keeps the generated set visually consistent across lighting, tone, material treatment, realism level, and brand atmosphere. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain 首图成交主视觉, 目标人群共鸣图, 适用多场景图, and 多角度产品展示图. Newly planned SKU items SHALL use one complete subject per distinct sellable SKU; only historical frozen plans may preserve a previously recorded combination count.

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

#### Scenario: User generates a commercial CG product image

- **WHEN** the planned set includes `atmosphere` / 商业 CG 渲染图
- **THEN** the prompt renders the reference-supported complete product with sculptural volume, actual material response, shaped key and rim lighting, contact shadows and coherent spatial reflections
- **AND** it preserves the role and image-type IDs without requiring a real person, a use action, a fixed slogan or an independent use scene
- **AND** the separate `effect-comparison` / 功能效果渲染图 keeps explaining a supported function and buyer benefit

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

系统 SHALL 保持 `effect-comparison` 作为稳定内部角色 ID 和“功能效果渲染图”作为中文展示名。新建或重新规划的该角色 SHALL 在一个统一构图中以一个完整可见、占主导的商品主体突出有证据支持的主要功能、可见效果及买家收益，其他功能仅作为与当前任务相关的辅助证据。系统 SHALL 允许围绕同一主体使用箭头、局部剖视叠层、动态轨迹、能量或材质流向以及高级 3D/CGI 或电影级产品可视化，但 SHALL NOT 生成前后对比、左右并列、分屏、成对状态、重复商品主体或多面板对比布局。 系统 SHALL 加强商品材质与体积，用符合商品的功能流动、前后遮挡、空间纵深和合理局部光照表达作用，SHALL NOT 仅依赖平面箭头或装饰描边；结构、作用范围、视角和参数均保持参考及已确认事实边界。

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
