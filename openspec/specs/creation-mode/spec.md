# creation-mode Specification

## Purpose
TBD - created by archiving change add-creation-mode. Update Purpose after archive.
## Requirements
### Requirement: Creation Mode tab is independent
The system SHALL expose Creation Mode as a separate tab under the creation workspace and SHALL NOT share prompt text, reference-image selections, prompt templates, queued jobs, or prompt-mode generated state with Creation Mode.

#### Scenario: User switches from prompt mode to Creation Mode
- **WHEN** the user opens the Creation Mode tab
- **THEN** the system displays Creation Mode-specific inputs and does not prefill them from the prompt-mode prompt, reference images, or Prompt Kit templates

#### Scenario: Creation Mode receives generated results
- **WHEN** a Creation Mode set saves generated images
- **THEN** the prompt-mode activity feed and default gallery-visible history are not updated as if the images were prompt-mode single-image jobs

### Requirement: Creation Mode generates configurable ecommerce sets
The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, 12, 14, or 16 ecommerce marketing roles and SHALL allow the user to customize which of the 16 image roles are generated for the current set: hero, benefit, scene, multi-angle, atmosphere, product detail, brand story, size/capacity/fit, effect comparison, specification table, craft process, accessory/gift, series showcase, ingredient/material, after-sales, and usage suggestion. The system SHALL keep those role IDs stable while presenting conversion-oriented Chinese role labels: 首图成交主视觉, 核心信息融合图, 适用多场景图, 多角度产品展示图, 冲动下单氛围图, 产品细节特写图, 品牌质感/礼品价值图, 尺寸容量适配图, 功能效果渲染图, 参数规格图, 品质工艺证明图, 到手清单/配件图, 多款式/SKU选择图, 材质成分解析图, 痛点图, and 卖点图. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, home/living products, or a searchable fourth-level ecommerce category template. The system SHALL support a set-level visual-language selector that defaults to `classic-commercial` and keeps the generated set visually consistent across lighting, tone, material treatment, realism level, and brand atmosphere. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain 首图成交主视觉, 核心信息融合图, 适用多场景图, and 多角度产品展示图.

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

#### Scenario: User sets a same-SKU combination pack count
- **WHEN** the user sets the SKU combination count to 2, 5, or an equivalent Chinese numeral before planning or generating a Creation Mode set
- **THEN** every appended SKU image prompt requires exactly that many identical copies of the same SKU subject
- **AND** the prompt treats the count change as copy-and-arrange duplication of the main subject, not as a request to redraw, redesign, recolor, relabel, or introduce a second SKU
- **AND** each SKU generation request attaches only the matched SKU subject reference images, plus the optional Logo reference, so unrelated uploaded product, package, scene, or material references cannot become the SKU subject
- **AND** a count of 1 keeps the previous single-subject SKU image behavior

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
- **THEN** each corresponding prompt includes buyer-decision guidance that answers a concrete shopper question before purchase, with after-sales framed as 痛点图 answering “这个产品具体帮我解决什么问题？” and usage suggestion framed as 卖点图 answering “我买它能获得哪些更明确的好处？”
- **AND** hard information roles such as size/capacity/fit and specification table remain governed by factual dimension or parameter constraints instead of emotional lifestyle conversion copy

#### Scenario: Planner gives every carousel role a shopper question
- **WHEN** the system builds a Creation Mode plan
- **THEN** every ecommerce carousel role prompt includes a `SHOPPER QUESTION` line that frames the image around one pre-purchase question such as what the product is, why it matters, where it is used, whether details are trustworthy, what arrives in the box, which SKU to choose, what real usage pain is solved, or which concrete buyer benefits are gained
- **AND** the prompt still forbids unsupported certifications, warranties, brand logos, parameters, effects, materials, and SKU options

#### Scenario: Planner avoids rigid templates in promotional roles
- **WHEN** the planned set includes the scene, atmosphere, or effect comparison role
- **THEN** scene prompts treat the role as an `适用多场景图` that shows 2-4 believable usage scenarios with advertising campaign energy instead of a stiff grid
- **AND** effect comparison prompts treat the role as a `功能效果渲染图` that may use premium 3D/CGI or cinematic product visualization to show a supplied function, mechanism, effect path, or outcome
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
- **THEN** the role picker updates to that category template's recommended image-role combination
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
- **AND** the role picker updates to the matched category template's recommended role combination
- **AND** the analysis feedback names the matched category path

#### Scenario: Product information is missing
- **WHEN** the user submits Creation Mode without product information
- **THEN** the system rejects the request with a visible validation message and does not start image generation

### Requirement: Creation Mode supports independent reference images and marketing scenarios
The system SHALL allow Creation Mode to upload its own reference images and choose a marketing scenario without sharing prompt-mode reference-image state.

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
- **THEN** set count, SKU combination count, marketing scenario, visual language, target language, output format, ratio, and resolution are presented in one compact control grid
- **AND** the desktop layout keeps those controls compact without sharing prompt-mode parameter state
- **AND** changing the Creation Mode ratio refreshes only the Creation Mode resolution options

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

### Requirement: Target language controls marketing prompts
The system SHALL apply the selected target language to every Creation Mode item prompt and marketing copy while preserving product names, model names, numbers, and units from the user's product input. The system SHALL support Simplified Chinese, English, Japanese, Korean, French, German, and Spanish presets.

#### Scenario: User selects English target language
- **WHEN** the user starts a Creation Mode set with English selected
- **THEN** each generated item prompt instructs the image generator to use concise English marketing copy for image text

#### Scenario: User selects Chinese target language
- **WHEN** the user starts a Creation Mode set with Chinese selected
- **THEN** each generated item prompt instructs the image generator to use concise Simplified Chinese marketing copy for image text

### Requirement: Creation assets are stored under the creation folder
The system SHALL save Creation Mode generated images under `Pictures/YYYY-MM/MM-DD/YYYY-MM-DD-creation/<set-folder>/`, which is beside the prompt, style-transfer, reference-analysis, image-decomposition, and PPT folders for the same date.

#### Scenario: Creation image is saved
- **WHEN** a Creation Mode item finishes generation on May 5, 2026
- **THEN** its relative output path starts with `2026-05/05-05/2026-05-05-creation/`

#### Scenario: User opens the output directory
- **WHEN** the app prepares the daily output folders
- **THEN** the same date folder contains creation, prompt, style-transfer, reference-analysis, image-decomposition, article, and ppt output folders

### Requirement: Creation records are set-based
The system SHALL persist Creation Mode records as set manifests with set-level input, target language, marketing scenario, visual language, industry template, industry template path when available, item roles, item statuses, prompts, image paths, and partial-failure status.

#### Scenario: All items complete
- **WHEN** all Creation Mode items save successfully
- **THEN** the set manifest status is `completed` and includes every saved item record

#### Scenario: One item fails
- **WHEN** at least one Creation Mode item fails after another item has saved
- **THEN** the set manifest status is `partial_failed` and saved item records remain available

### Requirement: Creation set records expose details and item repair
The system SHALL provide Creation Mode set record details that show the set-level input, target language, marketing scenario, visual language, industry template, reference image names, item roles, prompts, statuses, failure messages, and saved image paths. From the detail view, the system SHALL allow users to regenerate a saved item, fill a missing item, retry failed items, preview saved item images, copy item prompts, copy relative or full item paths, export set prompts, and export the set manifest without creating a new set record.

#### Scenario: User opens a set record detail
- **WHEN** the user opens a Creation Mode set record
- **THEN** the detail view shows the set metadata and every planned item with its role, prompt, status, error message when present, and saved image path when present

#### Scenario: User previews one saved item image
- **WHEN** the user clicks a saved Creation Mode item thumbnail
- **THEN** the shared image lightbox opens with the saved image enlarged
- **AND** the lightbox shows the actual per-item prompt sent to the upstream image request rather than the set planning prompt
- **AND** the lightbox shows the saved per-item request snapshot, including route, models, endpoint, ratio, requested and effective sizes, output format, quality, reasoning effort, and the reference image names used by that request
- **AND** a legacy manifest item recovers its actual generation prompt and request snapshot from the saved image sidecar when those fields are absent from the manifest
- **AND** the saved planning prompt remains available for editing and repair without replacing the recovered generation prompt
- **AND** missing historical request fields remain unrecorded instead of being filled from the current global configuration
- **AND** the saved relative path, download action, and path-copy actions are available inside the lightbox
- **AND** the record card itself does not render a redundant View action, the full prompt, or the saved path inline below the image

#### Scenario: User regenerates one saved item
- **WHEN** the user requests regeneration for a completed item in a Creation Mode set record
- **THEN** only that item is generated again using the set metadata and item role prompt
- **AND** the set manifest keeps the same set identity and updates that item's status, prompt, and image path
- **AND** the repair uses the visual language saved on the original set manifest

#### Scenario: User edits one item prompt before regeneration
- **WHEN** the user saves a prompt adjustment on one Creation Mode item and regenerates that item
- **THEN** the repair request uses the adjusted prompt only for that item
- **AND** the same set manifest stores the adjusted prompt on that item

#### Scenario: User fills a missing or failed item
- **WHEN** the user requests completion for missing or failed items in a Creation Mode set record
- **THEN** only items without saved images or with failed status are generated
- **AND** the set manifest becomes `completed` only after every planned item has a saved image

### Requirement: Saved asset records are grouped under Assets
The system SHALL group waterfall gallery browsing, PPT records, Creation Mode set records, and output-directory access under the Assets navigation and SHALL NOT expose a separate top-level Records navigation item.

#### Scenario: User opens Create navigation
- **WHEN** the user opens the Create navigation menu
- **THEN** the menu includes prompt image generation, Creation Mode, PPT generation, and the image-to-prompt tool
- **AND** the system does not expose a separate top-level Presentation navigation item

#### Scenario: User opens Assets navigation
- **WHEN** the user opens the Assets navigation menu
- **THEN** the menu includes waterfall gallery, Creation set records, PPT records, and output-directory access
- **AND** there is no separate top-level Records tab

#### Scenario: User opens Settings navigation
- **WHEN** the user opens the Settings navigation menu
- **THEN** the menu includes API configuration and theme controls
- **AND** it does not include creation modes, asset records, or output-directory actions

#### Scenario: User opens Creation set records
- **WHEN** the user opens the Creation set records asset view
- **THEN** the view shows saved Creation Mode set manifests and their generated item images
- **AND** selecting a saved set in this asset view does not replace the active in-progress Creation Mode set

#### Scenario: User searches Creation set records
- **WHEN** the user searches the Creation set records asset view by product, scenario, industry template, language, prompt, filename, or output path
- **THEN** the record list narrows to matching Creation Mode set manifests

#### Scenario: User reuses a Creation set record
- **WHEN** the user explicitly reuses a selected Creation Mode set record
- **THEN** the selected record is loaded into the active Creation Mode workspace
- **AND** the Creation Mode form controls reflect the selected record's product input, target language, marketing scenario, visual language, industry template, image count, and selected roles
- **AND** local reference-image file inputs are cleared because saved manifests cannot restore browser `File` objects
- **AND** saved reference image names, roles, and notes are shown as items that need reupload
- **AND** the app switches to the Creation Mode workspace so the user can continue item prompt edits, regeneration, or repair

#### Scenario: User reuploads saved Creation reference images
- **WHEN** the user uploads reference images after reusing a Creation Mode set record
- **THEN** files matching saved reference names, or the next missing reference by order, are marked as uploaded
- **AND** the uploaded files inherit the saved reference role and note for preview, generation, and repair requests
- **AND** the user can manually bind an uploaded file to a selected historical reference item to override automatic filename or order matching
- **AND** manual binding applies the selected historical reference role and note to that uploaded file
- **AND** missing historical reference items are not sent as usable reference-image metadata until a real file is uploaded

#### Scenario: User opens a Creation set record folder
- **WHEN** the user opens the folder for a selected Creation Mode set record
- **THEN** the local server resolves the folder from the saved set manifest ID
- **AND** the server opens only a validated creation subfolder under the configured output directory

#### Scenario: User copies Creation set image paths
- **WHEN** the user copies paths from a selected Creation Mode set record
- **THEN** the clipboard text includes the selected set label, recorded creation folder, and saved image relative paths
- **AND** the active Creation Mode workspace is not replaced

#### Scenario: User exports Creation set prompts and manifest
- **WHEN** the user exports a selected Creation Mode set record
- **THEN** the app can copy or download all saved item prompts for the selected set
- **AND** the app can download the selected set manifest as JSON
- **AND** item-level actions can copy either the saved relative path or the local full path for one generated image
- **AND** the active Creation Mode workspace is not replaced

#### Scenario: User works in Creation Mode
- **WHEN** the user opens the active Creation Mode workspace
- **THEN** the workspace shows the current in-progress or planned Creation set output
- **AND** saved Creation Mode history is not rendered as a history list inside the active workspace

### Requirement: Creation Mode resolves platform-specific automatic plans
The system SHALL provide versioned automatic planning profiles for `universal`, `amazon`, `tmall-taobao`, `jd`, `pdd`, `douyin`, `xiaohongshu`, `temu`, `tiktok-shop`, `shopee`, `lazada`, `etsy`, `ebay`, `walmart`, `shopify`, `aliexpress`, `rakuten`, `coupang`, and `mercado-libre`. When the user has not supplied a corresponding override, the selected profile SHALL determine the carousel image types, order, recommended count, per-item ratio, resolution tier, target language, composition, text policy, and scene policy. The `universal` profile SHALL preserve a generic ecommerce fallback.

#### Scenario: Amazon receives a strict marketplace plan
- **WHEN** the user selects Amazon without platform-related overrides
- **THEN** the planner creates seven carousel items before SKU and infographic rebuild additions
- **AND** the first item is an Amazon white-background main-image type mapped to the legacy `hero` content role
- **AND** the first item forbids visible marketing copy, collages, watermarks, unsupplied logos, badges, and misleading accessories
- **AND** the automatic plan uses a square ratio, English, and the Amazon resolution tier

#### Scenario: Xiaohongshu receives a content-native plan
- **WHEN** the user selects Xiaohongshu without platform-related overrides
- **THEN** the planner creates six carousel items before SKU and infographic rebuild additions
- **AND** the first item is a 3:4 Xiaohongshu feed-cover type
- **AND** the plan prioritizes lifestyle experience, steps or evidence, product detail, scale, and a clean product-proof image
- **AND** the prompts forbid fabricated reviews, engagement, endorsements, and disguised user testimony

#### Scenario: Taobao receives mixed native image types
- **WHEN** the user selects Taobao/Tmall without platform-related overrides
- **THEN** the planner creates eight carousel items before SKU and infographic rebuild additions
- **AND** the plan contains white-background, transparent-background, scene, selling-point, detail, dimension, SKU-choice, and 2:3 long-image types
- **AND** the effective item ratios include both 1:1 and 2:3

#### Scenario: Universal fallback remains available
- **WHEN** the platform value is absent, unknown, or explicitly `universal`
- **THEN** the planner uses the universal ecommerce profile
- **AND** the universal profile exposes the original 18 role-aligned native carousel slots and recommends 18 images without `custom` extension
- **AND** missing platform-specific evidence does not reduce the universal carousel below those 18 generic role-led slots
- **AND** an unknown explicit value produces a visible planning warning instead of being presented as a verified named-platform plan

#### Scenario: Every platform keeps one size-related image type
- **WHEN** any canonical platform automatic plan is resolved with or without exact dimension evidence
- **THEN** its enabled carousel contains at least one `dimension-fit` or `scale-proof` item mapped to `size-capacity-fit`
- **AND** missing dimension evidence does not replace or omit that size-related item
- **AND** without supplied dimension values the prompt forbids invented measurements and permits only non-numeric, evidence-grounded scale or fit presentation

#### Scenario: Platform strategy changes every item prompt
- **WHEN** the same product facts are planned for two different canonical platforms
- **THEN** every carousel item prompt includes the selected profile's platform-specific gallery instruction
- **AND** the current slot's image type, composition, text and scene policies remain explicit
- **AND** a generic legacy role brief does not replace the platform gallery strategy

#### Scenario: Product category adjusts platform slots
- **WHEN** a selected fourth-level category or applied reference evidence indicates apparel fit, electronic specifications, food ingredients, multiple SKUs, package contents, or product condition
- **THEN** the resolver substitutes or prioritizes relevant wearable, size, specification, ingredient, variant, included-item, or condition image types within the platform plan
- **AND** it does not invent facts that are absent from product input and applied reference evidence
- **AND** it does not remove official constraints bound to the retained image types

#### Scenario: Variant carousel slot differs from appended SKU items
- **WHEN** at least two distinct sellable SKU subjects are available and the selected platform recommends a variant image
- **THEN** the carousel may contain one variant-comparison item covering only the supplied SKU choices
- **AND** the planner still appends the existing one-item-per-SKU outputs after the carousel
- **AND** appended SKU items do not count against the platform carousel recommendation

#### Scenario: Single SKU does not receive an automatic variant comparison
- **WHEN** fewer than two distinct sellable SKU subjects are available
- **THEN** the automatic resolver omits or replaces the variant-comparison carousel slot unless the user explicitly keeps it as a custom slot

### Requirement: Platform image types and evidence are first-class planning data
The system SHALL store an `imageType` and effective `logoPolicy` for every platform-planned carousel item while preserving the existing stable `role` as its content intent. Each platform profile SHALL include a strategy version, evidence level, verification date, and source metadata. A blocking platform constraint SHALL reference a verified official source; lower-confidence guidance SHALL remain advisory. Browser-consumed policy and resolver modules SHALL be generated as exact `public/lib` mirrors of their canonical `lib` sources.

#### Scenario: New image type preserves legacy role compatibility
- **WHEN** the resolver creates a platform-native main-image, feed-cover, transparent-image, long-detail, condition, or lifestyle slot
- **THEN** the plan item stores both its platform-native `imageType` and a supported legacy Creation `role`
- **AND** existing reference selection, SKU, Logo, prompt allocation, filename, record, and repair behavior can continue to use the legacy role where required

#### Scenario: Official hard constraint is validated
- **WHEN** an effective item remains classified as an official platform main-image type
- **AND** its overrides request a composition or visible text forbidden by that image type's sourced official rules
- **THEN** plan preview returns an item-level blocking conflict
- **AND** generation does not start for that invalid plan

#### Scenario: Strict main image does not receive an uploaded Logo overlay
- **WHEN** the user has uploaded and enabled a Logo
- **AND** an effective item is Amazon, TikTok Shop, Walmart, or another sourced strict main-image type whose `logoPolicy` is `forbid-overlay`
- **THEN** the plan and generation-reference assembly omit the external Logo for that item
- **AND** they preserve branding or identifiers already present on the supplied product subject
- **AND** other eligible secondary items may still use the uploaded Logo
- **AND** an item override that requests external Logo overlay produces a blocking conflict until the user restores `forbid-overlay` or changes the image type to `custom`

#### Scenario: Low-evidence profile stays advisory
- **WHEN** the selected profile or a specific rule has only conservative or non-authoritative evidence
- **THEN** the UI identifies it as a conservative recommendation
- **AND** the resolver does not turn that rule into a blocking official constraint

#### Scenario: Runtime planning does not crawl platform sites
- **WHEN** a user previews, generates, repairs, or reuses a Creation set
- **THEN** the system resolves the bundled versioned profile without fetching or logging into a third-party marketplace

#### Scenario: Public browser modules match canonical sources
- **WHEN** browser assets are built or verified
- **THEN** the platform policy and browser-used resolver files in `public/lib` are byte-equivalent to their canonical `lib` files
- **AND** an out-of-sync or missing mirror fails the repository sync check

### Requirement: Users can adjust plans without editing prompts or advanced per-item parameters
The system SHALL allow users to override platform-derived target language, default ratio, default resolution, visual language, enabled image count, and compatible image-type enablement. Existing SKU bundle count and SKU generation rule inputs SHALL remain editable and SHALL NOT be locked by the platform profile. The Creation UI SHALL NOT expose item order, item image type, item ratio, item resolution, item language, item composition, item text density, item scene policy, item Logo policy, or item prompt editing, and SHALL NOT submit user-authored prompt overrides.

#### Scenario: User applies a set-level override
- **WHEN** the user changes the automatic target language, default ratio, default resolution, visual language, or enabled image count
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
- **AND** 浏览器、resolver、本地端点和 Worker 均不得把请求扩展为第 7 至 18 个通用或 `custom` 轮播项
- **AND** SKU 图和信息图重构仍作为独立追加项，不占用该平台轮播上限

#### Scenario: 通用电商保留 18 张原生套图
- **WHEN** 用户选择通用电商且未主动减少套图数量
- **THEN** 数量控件默认选择 18，并提供 0 至 18 的受支持选项
- **AND** resolver、本地端点和 Worker 返回 18 个通用电商原生轮播项
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

### Requirement: Platform switching is confirmed and race-safe
The system SHALL treat a platform change as a confirmable state transaction. Confirming SHALL clear platform-related overrides and apply the new profile while preserving product evidence; cancelling SHALL restore the previous platform and all previous field values. Reference analysis results SHALL only apply to the platform and category snapshot that initiated them.

#### Scenario: User confirms a platform switch
- **WHEN** the user changes from one platform to another and confirms the warning
- **THEN** the system resets image types, order, enabled carousel count, automatic language, automatic ratios, automatic resolutions, composition strategy, and platform-related overrides
- **AND** it preserves product name, description, selling points, category, dimensions, reference files and metadata, Logo, SKU, output format, and model/API configuration
- **AND** it immediately exposes the newly resolved platform plan for preview

#### Scenario: User cancels a platform switch
- **WHEN** the user changes the platform but cancels the warning
- **THEN** the prior platform selection is restored
- **AND** no form value, override, reference state, plan preview, or queued set snapshot changes

#### Scenario: Old reference analysis finishes after a switch
- **WHEN** a reference analysis request was started for an earlier platform or category
- **AND** its response arrives after the current platform or category has changed
- **THEN** the response is ignored and cannot alter product suggestions, reference roles, notes, category, selected slots, or plan preview

#### Scenario: 用户应用参考图分析后刷新冻结规划证据
- **WHEN** 用户点击应用当前参考图分析建议，且建议被写入参考图角色与说明
- **THEN** 浏览器从已应用的参考图角色重建 `platformReferenceCoverage` 和派生 `platformEvidence`
- **AND** 已冻结的套图级覆盖、逐图覆盖和类目信号保持不变，旧的 coverage/evidence 不会覆盖新应用结果
- **AND** 材质、包装和尺寸参考角色可恢复相应的 `material-proof`、`in-box` 和 `dimension-fit` 类型
- **AND** 未经用户应用的原始识别结果不直接成为商品事实证据

### Requirement: Creation generation uses per-item effective parameters consistently
The system SHALL include effective ratio, resolution tier, resolved size, and target language on each planned item. Local generation and Cloudflare Worker generation SHALL resolve and submit those values per item, and the same planning payload SHALL produce equivalent plans in both environments.

#### Scenario: One set uses mixed ratios
- **WHEN** a platform plan contains square and portrait items
- **THEN** each generation request uses the ratio saved on its matching item
- **AND** the prompt ratio guidance, requested upstream aspect ratio, activity metadata, saved item metadata, and lightbox parameters agree for that item

#### Scenario: Selected route does not support the recommended size
- **WHEN** an item's resolution tier cannot be represented exactly by the active image-generation route
- **THEN** the system selects the nearest supported size for the same aspect ratio
- **AND** plan or generation feedback exposes the effective size
- **AND** the effective size is stored on the item for later retry and review

#### Scenario: Local and Worker planning stay equivalent
- **WHEN** local and Cloudflare plan endpoints receive the same normalized Creation payload
- **THEN** their platform ID, strategy version, ordered image types, legacy roles, effective per-item parameters, constraints, warnings, and prompts are deeply equivalent

#### Scenario: One mixed-parameter item fails
- **WHEN** one item in a platform-planned set fails while another item completes
- **THEN** the completed item remains saved with its own effective parameters
- **AND** the set remains repairable without recalculating successful or failed items from current form values

### Requirement: Platform plans are frozen in queues and Creation records
The system SHALL snapshot the complete effective platform plan when a Creation set is queued and SHALL persist the strategy version, platform profile metadata, platform provenance, set overrides, count semantics, and per-item effective planning fields in new manifests. `carouselImageCount` and compatibility field `imageCount` SHALL count enabled carousel slots, `skuImageCount` SHALL count deduplicated appended SKU items, `infographicRebuildCount` SHALL count rebuild additions, and `totalPlannedItemCount` SHALL equal their sum. Repair and retry SHALL use the saved effective item plan unless the user explicitly requests re-planning.

#### Scenario: Plan exposes unambiguous final counts
- **WHEN** a resolved plan contains platform carousel slots, appended SKU items, or infographic rebuild items
- **THEN** its carousel, SKU, rebuild, and total count fields match the corresponding item kinds
- **AND** disabling or replacing a variant-comparison carousel slot does not remove appended one-item-per-SKU outputs
- **AND** duplicate SKU references for the same stable SKU subject create only one appended SKU item

#### Scenario: 当前表单数量与轮播计划一一对应
- **WHEN** 用户把当前可编辑表单的“套图数量”改为 4
- **THEN** 当前表单计划的 `imageCount` 和 `carouselImageCount` 均为 4
- **AND** 当前计划摘要显示轮播图 4，SKU 图和重构图仍按各自实际追加项计数
- **AND** `totalPlannedItemCount` 等于轮播图、SKU 图和重构图之和，不要求等于“套图数量”

#### Scenario: 后台队列快照不覆盖当前表单计划
- **WHEN** 一个轮播图数量为 18 的冻结队列任务正在后台生成，且用户把下一套当前表单的“套图数量”改为 4
- **THEN** 当前表单的计划摘要和高级槽位不得显示该队列任务的 18 张轮播计划
- **AND** 队列任务继续使用提交时冻结的 18 张计划，不受当前表单编辑影响
- **AND** 若当前表单计划尚未重新计算，界面显示待刷新状态而不是把队列快照标记为当前自动方案

#### Scenario: Form changes after enqueue do not affect the queued set
- **WHEN** the user submits a platform-planned set and then edits platform, category, supported overrides, ratio, size, language, or compatible slot enablement while it is waiting
- **THEN** the queued set starts with the frozen plan that existed at submission time

#### Scenario: New record is reopened or repaired
- **WHEN** a saved set contains platform strategy metadata and per-item effective parameters
- **THEN** the record view and reuse flow restore those effective values
- **AND** item retry or completion uses the saved image type, role, ratio, size, language, constraints, and prompt
- **AND** a later bundled strategy version does not silently alter the saved set

#### Scenario: Legacy record lacks platform strategy fields
- **WHEN** a Creation manifest predates `strategyVersion`, `imageType`, set overrides, or per-item parameters
- **THEN** the reader continues to display and repair it using saved roles, prompts, paths, and available set-level values
- **AND** it does not automatically apply the current platform profile or rewrite the manifest
- **AND** it records `platformProvenance` as `legacy-missing` before applying a display fallback
- **AND** an explicit saved `platform=universal` remains distinguishable as `platformProvenance=explicit`

#### Scenario: User explicitly replans a saved set
- **WHEN** the user selects Re-plan with current platform rules on a saved or reused set
- **THEN** the system resolves a new preview using the current profile version
- **AND** it does not replace the saved plan until the user confirms and submits the new plan

### Requirement: Platform planning degrades without fabricating evidence
The system SHALL omit or replace image types that require unavailable factual evidence and SHALL surface policy-loading and validation failures before generation. It SHALL NOT fill missing dimensions, materials, package contents, condition, defects, prices, certifications, sales, rankings, guarantees, reviews, or performance claims with invented content.

#### Scenario: Evidence-dependent slot has no evidence
- **WHEN** a condition, defect, dimension, material, package, comparison, certification, or performance slot lacks supporting product input or applied reference evidence
- **THEN** the resolver omits or replaces that slot with a safe product-detail or usage slot allowed by the selected profile
- **AND** the plan warning explains the missing evidence

#### Scenario: Browser policy module cannot load
- **WHEN** the browser cannot load the canonical platform policy module
- **THEN** the UI preserves all entered product and asset state
- **AND** it reports that platform automatic planning is unavailable
- **AND** it does not silently display or submit a named-platform plan built from stale duplicated defaults

### Requirement: Creation records display and expose Listing drafts in the old-style format
The Creation record UI SHALL preserve every current Listing draft in the fixed field order 标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组 and SHALL display all seven fields continuously on one page without content-group or language-view controls. Within every field or list item, the UI SHALL display the English value first and its corresponding Simplified Chinese value immediately below it when that localized value exists; this bilingual comparison SHALL remain vertical at every supported viewport width. Every visible English value SHALL remain an independent copy target that copies only that English value, and every visible Simplified Chinese value SHALL remain an independent copy target that copies only that Chinese value. Field-level English and Chinese copy controls SHALL copy the complete corresponding language value for that field, while full-copy and export actions SHALL preserve the complete bilingual field mapping. Generate, full-copy, and export controls SHALL remain available from a compact Listing workspace toolbar while the user reviews a long draft. All copy and export actions SHALL be immediately available without validation or review gating.

#### Scenario: User opens a newly generated Listing draft
- **WHEN** a completed Listing is rendered in a Creation record
- **THEN** 标题、卖点、痛点、五点描述、商品描述、后台搜索词 and 关键词分组 are all visible on the same page in that fixed order
- **AND** 后台搜索词 and 关键词分组 follow 商品描述 without requiring a content-group switch
- **AND** the UI does not render `商品文案`, `搜索优化`, `英文`, `中文`, or `对照` view controls
- **AND** the UI does not duplicate the complete English title above the title field
- **AND** the UI does not show validation, retry-review or `needs-review` controls

#### Scenario: User compares bilingual Listing values
- **WHEN** a Listing field or list item has both English and corresponding Simplified Chinese content
- **THEN** the English value is displayed above the corresponding Chinese value within the same field or item
- **AND** the Chinese value immediately follows its English counterpart before the next field or item
- **AND** desktop, stacked, and mobile layouts do not place the two values in side-by-side columns

#### Scenario: User switches the Listing language view
- **WHEN** an existing application session still contains a previous `en`, `zh`, or `compare` Listing language selection
- **THEN** the UI ignores that obsolete selection and displays the fixed English-above-Chinese comparison
- **AND** the UI does not render a language-view control that can hide either language

#### Scenario: User switches the Listing content view
- **WHEN** an existing application session still contains a previous `copy` or `search` Listing content selection
- **THEN** the UI ignores that obsolete selection and displays all seven fields on the same page
- **AND** the UI does not render a content-group control that can hide product-copy or search fields

#### Scenario: Historical Listing value has no Chinese counterpart
- **WHEN** a historical Listing field or item has an English value but no corresponding Simplified Chinese value
- **THEN** the English value remains visible and copyable in the fixed field order
- **AND** the UI does not invent or display a Chinese placeholder

#### Scenario: User copies a visible English Listing value
- **WHEN** the user clicks a visible English title, field value, list information point, or English field-level copy control
- **THEN** the clipboard contains only the selected English value or complete English field
- **AND** the clipboard does not contain its Chinese counterpart

#### Scenario: User copies a visible Chinese Listing reference
- **WHEN** the user clicks a visible Simplified Chinese value or Chinese field-level copy control
- **THEN** the clipboard contains only the selected Chinese value or complete Chinese field
- **AND** the clipboard does not contain the English value

#### Scenario: User copies Listing keyword buckets
- **WHEN** the Listing workspace displays or copies 精准关键词、长尾关键词、流量关键词 or 描述词
- **THEN** each bucket name remains a visible, non-selectable page label and is not a copy target
- **AND** clicking an English or Simplified Chinese keyword value copies only that row's actual keyword value
- **AND** the field-level English or Chinese copy control copies only that language's keyword values without any bucket-name prefix

#### Scenario: User reviews a long Listing draft
- **WHEN** the Listing workspace reaches the top of the scrollable Creation record result area
- **THEN** the Listing heading, generation action, complete-copy action, and export action remain visible while the draft content scrolls
- **AND** character counts are presented as secondary metadata rather than primary status badges

#### Scenario: User reaches Listing controls on a narrow mobile screen
- **WHEN** the user scrolls a mobile Creation record to its Listing workspace
- **THEN** the record header and filter controls remain in normal document flow instead of covering the Listing workspace
- **AND** the Listing actions and continuous vertical bilingual content remain visible and directly operable

#### Scenario: User copies or exports a Listing draft
- **WHEN** the user invokes generation, full copy, or export from the Listing workspace
- **THEN** generation reuses the existing selected-record Listing controller and concurrent-generation guard
- **AND** full copy and structured export retain the old-style bilingual field mapping for all seven fields
- **AND** the actions are not blocked by validation, review, warnings or access state

### Requirement: Hard-information images use decision-meaningful visual structures

The system SHALL keep complete supplied dimension and package facts in the effective Creation plan while composing the specification-table image as a product-led explanation of no more than four distinct, purchase-relevant specification attributes and composing the accessory/gift image as an unpacked inventory of confirmed included items. It MUST NOT invent values, items, quantities, packaging, or containers.

#### Scenario: Specification evidence contains many or repeated measurements

- **WHEN** a Creation plan includes the specification-table role and the supplied dimension evidence contains many values or repeated attribute labels
- **THEN** the specification-table prompt selects no more than four different specification attributes for visible use
- **AND** the product remains the dominant visual subject with selected values anchored through measurement lines, local callouts, or compact explanatory modules
- **AND** the prompt forbids a full-canvas spreadsheet, database-like table, dense rows, and repeated same-label filler
- **AND** the effective plan retains the complete normalized dimension facts for records and other dimension roles

#### Scenario: A visible key specification is rendered

- **WHEN** the specification-table image uses a selected supplied value
- **THEN** its digits, decimal point, units, and selected metric/imperial mode remain exact
- **AND** the image does not add unsupported parameters or explain the value with an unsupported performance claim

#### Scenario: Included items are shown without packaging evidence

- **WHEN** a Creation plan includes the accessory/gift or platform `in-box` role and supplied facts identify the product and included accessories but do not prove retail packaging
- **THEN** the prompt requires an unpacked flat lay with the product and every confirmed item fully visible outside any container
- **AND** it forbids adding a cardboard box, shipping carton, paper tray, blister tray, molded insert, or other invented packaging
- **AND** quantities remain readable and no supplied item is hidden, cropped, merged, or omitted

#### Scenario: Packaging is a confirmed included item

- **WHEN** supplied input or an applied package reference explicitly proves that packaging, a storage case, or a gift box is included
- **THEN** the prompt may show that packaging as a separate secondary inventory item beside the unpacked contents
- **AND** it does not use the container as the default frame or place all products and accessories inside it unless the user explicitly requests that internal arrangement

### Requirement: Creation set records can be deleted individually or in explicit batches
The system SHALL let users permanently delete the current Creation set record, an explicitly checked group of Creation set records, or every Creation set record matching the current explicit keyword and time filters. Each deletion SHALL remove the set manifest, its dedicated generated-image directory, and its corresponding JSON metadata directory without deleting another set or an output root.

#### Scenario: User deletes the current set record
- **WHEN** the user chooses Delete current for a selected Creation set record and confirms the action
- **THEN** the browser submits exactly that set ID to the batch deletion endpoint
- **AND** the Local store deletes that set manifest, its dedicated generated images, and its corresponding JSON sidecars
- **AND** the record list and detail selection refresh without the deleted set

#### Scenario: User checks and deletes multiple set records
- **WHEN** the user checks two or more Creation set records and chooses Delete selected
- **THEN** checking records does not change the single record opened in the detail view
- **AND** the confirmation identifies the number of checked sets
- **AND** the browser submits the distinct checked set IDs in one request
- **AND** successful deletion clears those checked IDs and refreshes the record list

#### Scenario: User deletes all records matching a search filter
- **WHEN** the user enters a non-empty Creation record search query, optionally combines it with a time condition, and chooses Delete filtered with matching sets
- **THEN** the confirmation identifies the full number of matching sets and summarizes the active keyword and time filters
- **AND** the deletion target includes every matching set in the complete filtered collection, including matches beyond the visible list rendering limit
- **AND** records outside the filtered collection are preserved

#### Scenario: User deletes all records matching a time filter
- **WHEN** the user selects a non-default quick time window or an exact date with matching sets and chooses Delete filtered
- **THEN** the confirmation identifies the full number of matching sets and summarizes the active time filter
- **AND** the deletion target includes every matching set in the complete filtered collection, including matches beyond the visible list rendering limit
- **AND** records outside the filtered collection are preserved

#### Scenario: Search filter is empty or has no matches
- **WHEN** the keyword is empty, the quick time window is All, and the exact date is empty, or when the active keyword and time filters match no sets
- **THEN** Delete filtered is disabled
- **AND** the default filter state cannot be used as an implicit Delete all action

### Requirement: Creation record deletion is confirmed and path-safe
The system SHALL present an application-modal confirmation before any Creation record deletion, SHALL send a bounded non-empty list of distinct set IDs, and SHALL resolve every recursive filesystem deletion as a non-root descendant of the configured output directory. Deletion SHALL be idempotent for records that no longer exist and SHALL NOT race a browser-known active Creation generation or planning operation.

#### Scenario: User cancels deletion
- **WHEN** the deletion confirmation is dismissed, cancelled, or closed with Escape
- **THEN** no deletion request is sent
- **AND** all records, generated files, metadata, selection, and filters remain unchanged

#### Scenario: Requested ID does not exactly match its manifest
- **WHEN** a requested set ID resolves through filename sanitization to a manifest whose stored set ID is different
- **THEN** the store does not delete that manifest or any referenced directory
- **AND** the requested ID is reported as not found

#### Scenario: Manifest contains an unsafe output directory
- **WHEN** a manifest has an empty, root, absolute, traversing, or otherwise out-of-root `relativeDir`
- **THEN** the store does not recursively delete that directory
- **AND** no other output directory is affected

#### Scenario: Creation work is active
- **WHEN** Creation planning, generation, or another record deletion is active in the browser
- **THEN** all Creation record deletion commands are disabled
- **AND** the browser does not start a competing delete request

#### Scenario: Cloudflare receives a record deletion request
- **WHEN** the Cloudflare runtime receives a valid Creation set deletion request but has no server-side Creation record store
- **THEN** it returns an idempotent success for the submitted distinct set IDs
- **AND** the browser removes matching current-session records without assuming local filesystem deletion

### Requirement: Creation set records can be filtered by creation time
The system SHALL let users filter Creation set records by the manifest `createdAt` value using All, Today, Recent 7 days, Older, or one exact local calendar date. Time filtering SHALL combine with keyword search, and the record count, empty state, detail selection, visible list, and filtered deletion target SHALL derive from the same complete filtered collection before the visible list rendering limit is applied.

#### Scenario: User selects a quick time window
- **WHEN** the user selects Today, Recent 7 days, or Older
- **THEN** the system matches records created today, from today through six local calendar days ago, or at least seven local calendar days ago respectively
- **AND** invalid or future creation timestamps do not match a bounded time window
- **AND** selecting a non-default quick window clears an exact-date filter

#### Scenario: User selects an exact date
- **WHEN** the user enters a valid exact calendar date
- **THEN** the system matches records whose `createdAt` falls on that local calendar date
- **AND** the quick time window returns to All so the exact date is the only active time condition

#### Scenario: Keyword and time filters are combined
- **WHEN** the user enters a keyword and selects an explicit time condition
- **THEN** only records matching both the existing keyword search text and the time condition are included
- **AND** counts and detail fallback use the complete combined result even when more than 60 records match

#### Scenario: User clears Creation record filters
- **WHEN** the user activates Clear filters
- **THEN** the keyword, quick time, and exact-date controls return to their defaults
- **AND** all Creation set records, including records with missing or invalid creation timestamps, are available again

### Requirement: Creation record deletion updates the open view in place
The system SHALL update the current Creation record view from the successful batch deletion result without automatically reloading the complete Creation set collection. The update SHALL preserve active keyword and time filters, surviving checked records, and the current list scroll context, while manual Refresh SHALL remain available for explicit reconciliation with external changes.

#### Scenario: Successful deletion does not reload all records
- **WHEN** the Creation record batch deletion endpoint successfully processes the submitted set IDs
- **THEN** the browser removes those deleted or already-absent records from its current set collection
- **AND** it does not automatically request the complete Creation set list
- **AND** count, filter options, list, detail, checked selection, queue, and deletion controls update in one final render

#### Scenario: Current detail survives a batch deletion
- **WHEN** a checked or filtered batch is deleted without including the record open in the detail view
- **THEN** the open detail record remains selected
- **AND** surviving checked records and active filters remain unchanged

#### Scenario: Current detail is deleted
- **WHEN** the record open in the detail view is included in a successful deletion
- **THEN** the browser selects the next surviving record in the complete filtered order
- **AND** it selects the previous surviving record when there is no next record
- **AND** it shows an empty filtered result when no matching record remains

#### Scenario: User explicitly refreshes records
- **WHEN** the user activates Refresh after records may have changed in another window or outside the application
- **THEN** the browser requests the complete Creation set list and reconciles its local record state

### Requirement: SKU color labels cover visible characteristic component colors
Each reliable complete visible SKU unit SHALL have one ordered characteristic-color label. The label SHALL include every clear subject color, including neutral parts shared by variants, and a short part name when needed. Multiple colors for one unit SHALL remain one structured value. Backgrounds, shadows, highlights, reflections, source-card text, and uncertain colors SHALL NOT be evidence. The SKU prompt SHALL render the whole label below its unit in the target language.

#### Scenario: One subject has several characteristic component colors
- **WHEN** one complete SKU subject visibly has a brown exterior, a black strap, and silver lenses
- **THEN** reference analysis returns one color-label value for that product unit covering brown, black, and silver lenses
- **AND** the planned SKU prompt requests one complete label below the subject containing all three characteristic colors

#### Scenario: Grouped subjects each have multi-color labels
- **WHEN** one SKU subject image contains multiple complete visible product units and each unit has several characteristic component colors
- **THEN** reference analysis returns exactly one ordered label value per complete product unit
- **AND** commas or component qualifiers inside one label do not create additional product-unit labels
- **AND** two units with the same characteristic colors retain two ordered label values instead of being deduplicated
- **AND** the planned SKU prompt places each complete label below its corresponding unit

#### Scenario: A visible neutral component is shared across variants
- **WHEN** each visible variant uses the same black strap or gray frame as a physical part of the sellable subject
- **THEN** the shared neutral component color remains eligible for every applicable characteristic-color label
- **AND** it is not discarded merely because all variants share it

#### Scenario: Color evidence is unsafe
- **WHEN** a possible color comes only from the background, shadow, highlight, environmental reflection, source-card text, or an unclear region
- **THEN** reference analysis excludes that possible color from the characteristic-color label
- **AND** if no reliable subject color remains, the planner does not request a guessed color label

### Requirement: Structured non-sensitive audience analysis
The system SHALL let Creation reference analysis return a normalized `audienceStrategy` containing a product-use or purchase-context audience, purchase motivations, purchase objections, desired outcome, evidence basis, confidence, and source. The analysis MUST use only supplied product facts, visible product/use evidence, platform context, and category context, and MUST NOT infer protected or sensitive personal attributes from people in reference images.

#### Scenario: Analysis returns evidence-backed audience guidance
- **WHEN** the user analyzes product references with a selected platform, category, and supplied product facts
- **THEN** the response includes a normalized audience strategy whose motivations and objections cite supplied or visible evidence and whose source and confidence are explicit

#### Scenario: Sensitive attributes are not inferred
- **WHEN** a reference image contains a person but the user did not explicitly provide demographic targeting
- **THEN** the analysis does not infer age, sex, gender identity, race, ethnicity, nationality, religion, health, disability, pregnancy, sexual orientation, income, or other sensitive attributes and falls back to a non-sensitive product-use context

#### Scenario: Uncertain audience stays conservative
- **WHEN** the product facts and references do not support a specific usage or buying context
- **THEN** the analysis returns a generic category buyer suggestion with low confidence instead of inventing a precise persona

### Requirement: Versioned platform marketing context
The system SHALL define a structured `marketingContext` for the universal profile and every supported platform profile, including shopper intent, proof style, copy style, default motivations, and default objections. Marketing context MUST remain advisory and MUST NOT be represented as an official platform rule unless independently covered by the existing sourced constraint model.

#### Scenario: Every platform has structured marketing context
- **WHEN** the platform policy registry is loaded
- **THEN** all supported platform profiles expose valid structured marketing context in addition to their existing sourced image policies

#### Scenario: Platform advice does not become a hard rule
- **WHEN** a profile marketing context has no official blocking source
- **THEN** it affects planning guidance only and does not create a blocking validation constraint

### Requirement: Deterministic audience strategy resolution
The system SHALL resolve `effectiveAudienceStrategy` using `universal fallback < platform marketing context < category context < reference-analysis suggestion < user set input < user item override`. Empty values MUST NOT erase lower-priority evidence, list fields MUST be normalized and de-duplicated, and the resolved result MUST record provenance.

#### Scenario: Reference analysis overrides platform fallback
- **WHEN** a platform default describes value-comparison shoppers and an applied reference analysis provides evidence for a gift-buying context
- **THEN** the effective strategy uses the evidence-backed gift context while retaining compatible platform proof and copy guidance

#### Scenario: User input overrides analysis suggestion
- **WHEN** a caller explicitly supplies a non-sensitive target audience or purchase objection after applying an analysis suggestion
- **THEN** the explicit user value becomes effective and its provenance is recorded as user input

#### Scenario: Item override affects one slot only
- **WHEN** a caller supplies a valid per-item conversion override
- **THEN** only the matching item changes and all other items keep their deterministic effective strategy

### Requirement: Per-item conversion intent
The system SHALL deterministically assign each planned item a `conversionIntent` containing audience focus, motivation focus, objection focus, conversion goal, and evidence focus. Different roles SHALL cover distinct buyer-decision jobs so the suite does not repeat the same generic selling-point board.

#### Scenario: Suite roles cover different decision jobs
- **WHEN** a suite contains hero, benefit, scene, detail, size, package, and SKU items
- **THEN** the hero handles recognition and the primary motivation, benefit and scene items show outcomes and use relevance, detail and size items reduce evidence or fit uncertainty, and package and SKU items reduce completeness or choice uncertainty

#### Scenario: Conversion intent is deterministic
- **WHEN** Local and Worker resolve the same normalized platform, category, audience strategy, overrides, and product evidence
- **THEN** they produce deeply equivalent effective audience strategies and per-item conversion intents in the same order

### Requirement: Evidence-bounded conversion prompts
The system SHALL include the effective per-item conversion intent in eligible carousel and SKU prompts while limiting every product claim, proof, outcome, and reassurance to supplied product facts or reference evidence. Missing evidence MUST produce a conservative question or visual emphasis instead of an invented fact. Source-only `infographic-rebuild` prompts MUST NOT include audience or conversion guidance.

#### Scenario: Source-only infographic rebuild bypasses conversion decoration
- **WHEN** a plan contains an `infographic-rebuild` item and an effective audience strategy
- **THEN** the item may retain conversion metadata for plan compatibility
- **AND** its final reconstruction prompt does not include audience focus, motivations, objections, evidence focus, or conversion guidance

#### Scenario: Prompt uses supplied motivation evidence
- **WHEN** the supplied facts support quick setup and the effective audience values convenience
- **THEN** the assigned benefit or usage prompt connects quick setup to convenience without adding unsupported setup time, performance numbers, certifications, reviews, or guarantees

#### Scenario: Prompt does not invent proof
- **WHEN** the effective audience has a durability objection but no material, test, warranty, or durability evidence is supplied
- **THEN** no item prompt invents durability proof, test results, warranty terms, ratings, sales, testimonials, or performance claims

### Requirement: Platform hard rules override conversion strategy
The system MUST apply official sourced blocking constraints and effective `textPolicy`, `logoPolicy`, and `scenePolicy` after all audience, conversion, set, item, and prompt overrides. A strict main image MUST NOT gain text, collage, external Logo, scene props, or unsupported claims from conversion guidance.

#### Scenario: Amazon main image remains strict
- **WHEN** an Amazon plan has a persuasive audience strategy and an Amazon main image slot
- **THEN** the main image remains a compliant white-background product image with no added marketing text, collage, external Logo, scene, or unsupported claim while later eligible images may use the conversion strategy

#### Scenario: Invalid item override remains blocked
- **WHEN** a per-item conversion or prompt override conflicts with a sourced blocking constraint
- **THEN** validation reports the conflict and generation is rejected

### Requirement: Audience strategy is part of the frozen effective plan
The system SHALL include original `audienceStrategy`, resolved `effectiveAudienceStrategy`, and every item's `conversionIntent` and final prompt in the versioned `effectivePlan`. Queue snapshots, Local manifests, record reuse, and repair MUST preserve these values without recomputing them from current form or current platform defaults. A source-only `infographic-rebuild` SHALL preserve compatible metadata but MUST execute the canonical reconstruction prompt at generation and repair time instead of a decorated historical saved prompt.

#### Scenario: Queue submission freezes audience decisions
- **WHEN** a user previews a plan, submits it to the queue, and then changes platform, category, product fields, or reference analysis
- **THEN** the queued job retains the submitted audience strategy, item conversion intents, order, parameters, and prompts

#### Scenario: Saved set round-trips conversion fields
- **WHEN** a completed Local set is saved and loaded
- **THEN** its effective plan and item conversion fields are deeply equivalent to the submitted frozen values

#### Scenario: Repair reuses saved item intent
- **WHEN** a saved item is retried or repaired after current strategy defaults change
- **THEN** repair reuses the saved conversion intent, eligible item prompt, ratio, size, language, and platform constraints unless the user explicitly edits that item
- **AND** an `infographic-rebuild` executes its canonical source-only prompt while retaining the saved compatible metadata and technical parameters

### Requirement: Generation submits and validates the frozen plan
The browser SHALL submit the complete frozen `effectivePlan` for formal Creation generation. Local and Worker SHALL prefer a valid submitted snapshot over replanning, SHALL limit snapshot byte size and item count, SHALL normalize required fields, and SHALL recompute counts and validation from snapshot items without trusting client-supplied `canGenerate`, validation, or count fields.

#### Scenario: Formal generation uses previewed items
- **WHEN** a valid frozen plan is submitted after preview
- **THEN** Local and Worker execute the submitted item order, eligible saved prompts, conversion intents, ratios, sizes, and languages without calling the current platform strategy to rebuild them
- **AND** any `infographic-rebuild` executes the canonical source-only reconstruction prompt instead of a decorated submitted prompt

#### Scenario: Client cannot bypass hard-rule validation
- **WHEN** a submitted snapshot declares `canGenerate=true` but an item violates a sourced platform constraint
- **THEN** the server recomputes validation, rejects generation, and does not trust the client declaration

#### Scenario: Oversized or malformed snapshot is rejected
- **WHEN** a submitted snapshot exceeds the allowed byte or item limit or lacks required item identifiers, prompts, or generation parameters
- **THEN** Local and Worker reject the request with a compact validation error before image generation

#### Scenario: Legacy request replans
- **WHEN** an older client submits a generation request without `effectivePlan`
- **THEN** Local and Worker continue to build and validate a plan from the legacy fields

### Requirement: Runtime and metadata boundaries remain compatible
The system SHALL keep Local and Worker plan/generation results equivalent for the same normalized payload and SHALL keep full audience structures inside the set-level effective plan rather than per-image R2 custom metadata. Old manifests without audience fields MUST remain readable and MUST NOT be rewritten solely to add fallback strategy fields.

#### Scenario: Local and Worker remain equivalent
- **WHEN** the same audience-aware preview or generation payload is processed in Local and Worker environments
- **THEN** the effective audience strategy, per-item conversion intents, prompts, counts, validation, and generation parameters are deeply equivalent

#### Scenario: R2 metadata stays bounded
- **WHEN** Worker emits generated image metadata for an audience-aware suite
- **THEN** the full audience strategy is not copied into each image's R2 custom metadata and the existing metadata size limit remains satisfied

#### Scenario: Legacy manifest remains readable
- **WHEN** a Local manifest lacks `audienceStrategy`, `effectiveAudienceStrategy`, and `conversionIntent`
- **THEN** it loads with its historical items and prompts intact and only explicit replanning creates new audience-aware fields

### Requirement: Source-only infographic rebuild overrides suite-wide prompt decoration
Creation Mode SHALL treat `infographic-rebuild` as a source-only reconstruction item. Requirements that normally apply shared visual language, marketing scenario, target language, reference-analysis notes, platform or category guidance, audience strategy, conversion intent, product facts, subject references, or Logo references to every planned item SHALL apply only to eligible carousel and SKU items and SHALL NOT alter an `infographic-rebuild` prompt or its reference-image collection.

Requirements that normally execute a frozen or saved item prompt unchanged SHALL preserve the stored item metadata for record compatibility, but generation and repair MUST replace an `infographic-rebuild` runtime prompt with the canonical source-only reconstruction prompt. Its saved technical parameters remain frozen and MUST NOT be recomputed from the current form.

#### Scenario: Shared Creation settings change
- **WHEN** a user changes any shared Creation setting while an information source image and its rebuild item remain the same
- **THEN** eligible carousel and SKU prompts may reflect the changed setting
- **AND** the infographic rebuild prompt and its one-image source collection remain unchanged
- **AND** the rebuild item continues using its own frozen technical generation parameters

#### Scenario: Historical saved prompt contains suite decoration
- **WHEN** a frozen plan or saved record contains an `infographic-rebuild` prompt with product, platform, language, visual-style, Logo, audience, conversion, or reference-note instructions
- **THEN** Local generation, Worker generation, and Local repair execute the canonical source-only reconstruction prompt instead
- **AND** they retain the item's saved model route, model, ratio, size, quality, format, reasoning, source identity, and compatible conversion metadata
