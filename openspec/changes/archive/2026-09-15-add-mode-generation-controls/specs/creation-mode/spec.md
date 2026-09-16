## MODIFIED Requirements

### Requirement: Creation Mode generates configurable ecommerce sets

The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, 12, 14, or 16 ecommerce marketing roles and SHALL allow the user to customize which of the 16 image roles are generated for the current set: hero, benefit, scene, multi-angle, atmosphere, product detail, brand story, size/capacity/fit, effect comparison, specification table, craft process, accessory/gift, series showcase, ingredient/material, after-sales, and usage suggestion. The system SHALL keep those role IDs stable while presenting conversion-oriented Chinese role labels: 首图成交主视觉, 目标人群共鸣图, 适用多场景图, 多角度产品展示图, 冲动下单氛围图, 产品细节特写图, 品牌质感/礼品价值图, 尺寸容量适配图, 功能效果渲染图, 参数规格图, 品质工艺证明图, 到手清单/配件图, 多款式/SKU选择图, 材质成分解析图, 痛点图, and 卖点图. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, home/living products, or a searchable fourth-level ecommerce category template. The system SHALL support a set-level visual-language selector that defaults to `classic-commercial` and keeps the generated set visually consistent across lighting, tone, material treatment, realism level, and brand atmosphere. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain 首图成交主视觉, 目标人群共鸣图, 适用多场景图, and 多角度产品展示图. Newly planned SKU items SHALL use one complete subject per distinct sellable SKU; only historical frozen plans may preserve a previously recorded combination count.

#### Scenario: User starts a conversion-oriented creation set

- **WHEN** the user submits product information and a target language in Creation Mode
- **THEN** the first planned item remains `hero` / 首图成交主视觉 and the second remains `benefit` / 目标人群共鸣图
- **AND** the hero prompt requests all reliable non-dimension product identity, description, selling-point, material, usage, scene, package, and trust facts that fit its bounded information hierarchy
- **AND** newly authored hero canvas copy uses the selected target language while physical product and packaging text remains unchanged
- **AND** the hero prompt retains 3-5 small circular scene frames around the dominant product

#### Scenario: User selects the target-shopper resonance role

- **WHEN** a preset or custom subset contains `benefit`
- **THEN** the role is shown as 目标人群共鸣图 and its prompt depicts one recognizable target shopper, one concrete decision moment or pain context, and one emotionally credible reason to choose the product
- **AND** the role does not become a second generic selling-point list, parameter table, or plain product-only card

#### Scenario: User views a historical universal set with the former second selling-point label

- **WHEN** a saved historical item uses the stable second-slot identity `universal:benefit-proof` or another compatible second-slot `benefit` identity
- **THEN** the card and exported prompt heading are displayed as 目标人群共鸣图
- **AND** the later `universal:selling-point-stack` item remains displayed as 卖点图
- **AND** the stored manifest title, prompt, filename, and stable item ID are not rewritten

#### Scenario: User generates a high-intent atmosphere image

- **WHEN** the planned set includes `atmosphere` / 冲动下单氛围图
- **THEN** the prompt places the exact product inside a specific decisive ownership or usage moment with a visible action, target-user cue, and purchase-trigger emotion
- **AND** the prompt forbids a flat static display, empty decorative mood, or unrelated lifestyle scene

#### Scenario: Platform policy is stricter than conversion guidance

- **WHEN** a platform-native slot has a blocking no-text, white-background, transparent, or no-collage constraint
- **THEN** the blocking platform policy remains authoritative
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
- **AND** if the user uploaded a Logo reference, each SKU prompt also applies that supplied logo without covering existing product identifiers

#### Scenario: New plans use one complete subject per SKU

- **WHEN** the user previews or generates a new Creation Mode set with distinct sellable SKU subjects
- **THEN** the UI does not expose a SKU combination-count control
- **AND** every appended SKU image prompt uses one complete instance of its matched SKU subject
- **AND** the plan and generation request do not accept a user-entered count for duplicating that subject

#### Scenario: User sets a same-SKU combination pack count

- **WHEN** a saved Creation Mode set created before this control was removed contains a frozen SKU combination count greater than one and the user repairs it
- **THEN** the repair keeps the saved count and frozen prompt semantics
- **AND** opening or repairing the record does not rewrite its manifest to one
- **AND** new Creation Mode plans do not expose or submit a user-entered combination count.

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
- **AND** individual item roles may still vary camera angle, framing, scene density, props, and information layout without switching to another visual language
- **AND** the generated set manifest stores both `visualLanguage` and `visualLanguageLabel`
- **AND** missing or unknown visual-language values fall back to `classic-commercial`
- **AND** the upload-image logo branch does not display or submit the visual-language selector

#### Scenario: Planner makes templated roles buyer-decision oriented

- **WHEN** the planned set includes roles such as benefit, multi-angle, atmosphere, brand story, effect comparison, craft process, accessory/gift, series showcase, ingredient/material, after-sales, or usage suggestion
- **THEN** each corresponding prompt includes buyer-decision guidance that answers a concrete shopper question before purchase, with after-sales framed as 痛点图 answering "这个产品具体帮我解决什么问题？" and usage suggestion framed as 卖点图 answering "我买它能获得哪些更明确的好处？"
- **AND** hard information roles such as size/capacity/fit and specification table remain governed by factual dimension or parameter constraints instead of emotional lifestyle conversion copy

#### Scenario: Planner gives every carousel role a shopper question

- **WHEN** the system builds a Creation Mode plan
- **THEN** every ecommerce carousel role prompt includes a `SHOPPER QUESTION` line that frames the image around one pre-purchase question such as what the product is, why it matters, where it is used, whether details are trustworthy, what arrives in the box, which SKU to choose, what real usage pain is solved, or which concrete buyer benefits are gained
- **AND** the prompt still forbids unsupported certifications, warranties, brand logos, parameters, effects, materials, and SKU options

#### Scenario: Planner avoids rigid templates in promotional roles

- **WHEN** the planned set includes the scene, atmosphere, or effect comparison role
- **THEN** scene prompts treat the role as an 适用多场景图 that shows 2-4 believable usage scenarios with advertising campaign energy instead of a stiff grid
- **AND** effect comparison prompts treat the role as a 功能效果渲染图 that may use premium 3D/CGI or cinematic product visualization to show a supplied function, mechanism, effect path, or outcome
- **AND** those prompts still do not invent unsupported technical structures, parameters, certifications, performance numbers, or effects

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

### Requirement: Creation Mode supports independent reference images and marketing scenarios

The system SHALL allow Creation Mode to upload its own reference images and choose a marketing scenario without sharing prompt-mode reference-image state. Creation Mode SHALL expose its own thinking-effort and image-quality selectors in the compact generation-control grid, and these selectors SHALL not read Prompt Mode's current values.

#### Scenario: User adds Creation Mode reference images

- **WHEN** the user uploads or drops images in the Creation Mode reference area
- **THEN** the images are stored only in Creation Mode browser state
- **AND** submitted to `/api/creation/generate` as generation references

#### Scenario: User chooses a marketing scenario

- **WHEN** the user selects a scenario such as detail page, social seeding, launch, promotion, livestream, gift guide, marketplace search, or brand story
- **THEN** every planned item prompt includes scenario-specific ecommerce guidance
- **AND** each planned item prompt includes role-specific guidance for that selected scenario when available
- **AND** the set manifest stores the selected scenario and reference image names

#### Scenario: User edits Creation Mode generation parameters

- **WHEN** the user opens the Creation Mode parameter area
- **THEN** set count, target language, output format, ratio, resolution, thinking effort, and quality are presented in one compact control grid
- **AND** the grid does not expose a SKU combination-count control
- **AND** the desktop layout keeps those controls compact without sharing prompt-mode parameter state
- **AND** changing the Creation Mode ratio refreshes only the Creation Mode resolution options

#### Scenario: User selects Creation Mode thinking effort and quality

- **WHEN** the user selects a thinking effort and quality before planning or generating a Creation Mode set
- **THEN** the plan and generation requests use the selected thinking effort
- **AND** the generation request uses the selected quality after normalization for the active image model
- **AND** a queued set retains those values for its generation operation.

#### Scenario: User tags reference image roles

- **WHEN** the user assigns a role such as product, package, material, scene, style, or other to a Creation Mode reference image
- **THEN** the selected role is stored with the reference image metadata
- **AND** the generated item prompts include role-aware reference guidance

#### Scenario: Usage and scene references drive role-specific coverage

- **WHEN** a Creation Mode plan assigns a `usage` or `scene` reference image to a generated item
- **THEN** the item prompt treats the assigned scene reference image as a visual blueprint to faithfully reconstruct first and then recompose around the current product and selected visual language
- **AND** the scene reference note is used only to identify the source content and must not be turned into new visible labels or a different scenario
- **AND** the item prompt treats the assigned usage reference image as selling-point evidence that can inform setup, operation, charging, connection, care, or mistake-prevention benefits
- **AND** the usage reference note must not be turned into a tutorial card, preserved step sequence, or rewritten operation flow

#### Scenario: User reviews applied reference roles

- **WHEN** reference image roles or notes have been applied to a Creation Mode set
- **THEN** the active set detail and saved asset record detail show the same reference role summary
- **AND** repair requests keep the saved reference role metadata when the original file input is no longer recoverable

#### Scenario: User analyzes Creation Mode reference images

- **WHEN** the user asks Creation Mode to identify uploaded reference images
- **THEN** the system analyzes those images through a Creation Mode-specific endpoint
- **AND** the suggested role and note for each reference image are shown as pending recommendations
- **AND** the suggested role and note are applied only to Creation Mode reference state after the user explicitly applies the recommendations
- **AND** the analysis result is not written into prompt-mode reference-analysis history
- **AND** generated item prompts include any applied reference-image analysis notes

### Requirement: Users can adjust plans without editing prompts or advanced per-item parameters

The system SHALL allow users to override platform-derived target language, default ratio, default resolution, visual language, enabled image count, compatible image-type enablement, thinking effort, and image quality. The SKU generation rule input SHALL remain editable and SHALL NOT be locked by the platform profile. New Creation plans SHALL use a fixed one-subject SKU count and SHALL NOT expose or submit an editable SKU bundle-count field. The Creation UI SHALL NOT expose item order, item image type, item ratio, item resolution, item language, item composition, item text density, item scene policy, item Logo policy, or item prompt editing, and SHALL NOT submit user-authored prompt overrides.

#### Scenario: User applies a set-level override

- **WHEN** the user changes the automatic target language, default ratio, default resolution, visual language, thinking effort, quality, or enabled image count
- **THEN** the effective plan uses that value for items without a more specific item override
- **AND** the UI marks the field as user-overridden

#### Scenario: User enables or disables compatible image types

- **WHEN** the user enables or disables a current carousel slot in the compatible image-type area
- **THEN** plan preview reflects the enabled slot list
- **AND** the planned carousel count equals the number of enabled carousel slots
- **AND** no advanced per-item editor or prompt input is shown

#### Scenario: 平台决定套图数量上限

- **WHEN** 当前平台 profile 只内置 6 个规范化轮播槽位
- **THEN** 套图数量控件只提供不超过 6 的受支持选项
- **AND** 浏览器、resolver 和本地端点均不得把请求扩展为第 7 至 18 个通用或 `custom` 轮播项
- **AND** SKU 图和信息图重构仍作为独立追加项，不占用该平台轮播上限

#### Scenario: 通用电商保留 18 张原生套图

- **WHEN** 用户选择通用电商且未主动减少套图数量
- **THEN** 数量控件默认选择 18，并提供 0 至 18 的受支持选项
- **AND** resolver 和本地端点返回 18 个通用电商原生轮播项
- **AND** 这些轮播项对应原有 18 个角色且不使用 `custom` 图片类型补足

#### Scenario: 平台切换立即收紧数量

- **WHEN** 用户从内置 9 个轮播槽位的平台切换到内置 6 个轮播槽位的平台
- **THEN** 数量控件立即移除 7 至 18 的选项
- **AND** 若旧选择超过 6，当前值收紧为新平台推荐值并立即请求新计划
- **AND** 冻结 `effectivePlan`、摘要、队列快照和实际生成均使用收紧后的轮播数量

#### Scenario: 首次显式数量预览保留平台范围内的已对齐角色

- **WHEN** 用户在当前平台上限内修改数量，浏览器已保存显式 `imageCount` 和相同数量的已对齐角色，但新的 `effectivePlan` 尚未返回
- **THEN** 首次预览仍提交显式数量及全部已对齐 `selectedRoles`
- **AND** 未手动编辑角色不会被解释为清空角色
- **AND** 只有不存在显式数量且不存在手动角色编辑时，浏览器才提交空角色选择以请求纯自动计划

#### Scenario: 平台自动推荐数量保持可见且不冒充用户覆盖

- **WHEN** 用户尚未主动修改数量，且 Amazon 自动计划解析为 7 个有效轮播项
- **THEN** 数量控件和兼容图片类型区域显示当前有效轮播数量 7
- **AND** 浏览器不把该自动值保存为显式 `imageCount` 覆盖

#### Scenario: 兼容图片类型区域使用当前有效轮播计划口径

- **WHEN** 当前平台计划已解析，或用户启用、禁用、增删、排序槽位后预览更新
- **THEN** 兼容图片类型区域仅列出当前 `effectivePlan` 的轮播槽位，并按每个槽位的 `enabled` 状态显示选择结果
- **AND** 计数显示“已启用轮播槽位数 / 当前轮播槽位总数”
- **AND** 追加 SKU 项和信息图重构项不进入该区域的列表或计数

#### Scenario: 显式套图参数覆盖平台默认值

- **WHEN** 用户选择小红书平台，并显式选择 English、统一比例和分辨率
- **THEN** 浏览器把 `targetLanguage`、`ratio` 和 `resolutionTier` 保存为套图级覆盖
- **AND** 预览返回的每个轮播 item、冻结 `effectivePlan`、队列和实际逐图请求均使用这些显式值
- **AND** 小红书的简体中文、3:4 和 1.5K 平台默认值不得重新覆盖用户选择

#### Scenario: Image count change is frozen before first generation

- **WHEN** reference analysis or an earlier preview produced one count and the user selects a different image count
- **THEN** the browser immediately requests a refreshed plan using the new explicit count and aligned roles
- **AND** a generation submit waits for the latest preview to finish
- **AND** the first queued generation uses the refreshed count without requiring a second click

#### Scenario: SKU generation toggle preserves the platform carousel plan

- **WHEN** a named-platform plan is visible and the user disables or enables SKU image generation
- **THEN** the browser immediately refreshes the plan for the same selected platform
- **AND** only appended SKU items, `skuImageCount`, and `totalPlannedItemCount` change
- **AND** `carouselImageCount`, ordered carousel slot keys, image types, and compatible image-type state remain unchanged
- **AND** the refresh does not show or submit the universal legacy role list

#### Scenario: User restores the current platform recommendation

- **WHEN** the user selects Restore current platform recommendation
- **THEN** the system clears only platform-related set and item overrides
- **AND** it recomputes the profile, category, and reference-derived plan
- **AND** it preserves product information, category, dimensions, references, Logo, SKU, output format, and model/API configuration
