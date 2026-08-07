## MODIFIED Requirements

### Requirement: Creation Mode generates configurable ecommerce sets
The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, 12, 14, or 16 ecommerce marketing roles and SHALL allow the user to customize which of the 16 image roles are generated for the current set: hero, benefit, scene, multi-angle, atmosphere, product detail, brand story, size/capacity/fit, effect comparison, specification table, craft process, accessory/gift, series showcase, ingredient/material, after-sales, and usage suggestion. The system SHALL keep those role IDs stable while presenting conversion-oriented Chinese role labels: 首图成交主视觉, 目标人群共鸣图, 适用多场景图, 多角度产品展示图, 冲动下单氛围图, 产品细节特写图, 品牌质感/礼品价值图, 尺寸容量适配图, 功能效果渲染图, 参数规格图, 品质工艺证明图, 到手清单/配件图, 多款式/SKU选择图, 材质成分解析图, 痛点图, and 卖点图. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, home/living products, or a searchable fourth-level ecommerce category template. The system SHALL support a set-level visual-language selector that defaults to `classic-commercial` and keeps the generated set visually consistent across lighting, tone, material treatment, realism level, and brand atmosphere. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain 首图成交主视觉, 目标人群共鸣图, 适用多场景图, and 多角度产品展示图.

#### Scenario: User starts a conversion-oriented creation set
- **WHEN** the user submits product information and a target language in Creation Mode
- **THEN** the first planned item remains `hero` / 首图成交主视觉 and the second remains `benefit` / 目标人群共鸣图
- **AND** the hero prompt requests all reliable non-dimension product identity, description, selling-point, material, usage, scene, package, and trust facts that fit its bounded information hierarchy
- **AND** newly authored hero canvas copy uses the selected target language while physical product and packaging text remains unchanged
- **AND** the hero prompt retains 3–5 small circular scene frames around the dominant product

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
## MODIFIED Requirements

### Requirement: 功能效果渲染图以单一主体呈现完整功能

系统 SHALL 保持 `effect-comparison` 作为稳定内部角色 ID 和“功能效果渲染图”作为中文展示名。新建或重新规划的该角色 SHALL 在一个统一构图中以一个完整可见、占主导的商品主体呈现所有已提供且有证据支持的功能、机制、效果路径或结果。系统 SHALL 允许围绕同一主体使用箭头、局部剖视叠层、动态轨迹、能量或材质流向以及高级 3D/CGI 或电影级产品可视化，但 SHALL NOT 生成前后对比、左右并列、分屏、成对状态、重复商品主体或多面板对比布局。

#### Scenario: 用户规划功能效果渲染图
- **WHEN** 用户在 Creation Mode 中选择 `effect-comparison` 角色并提交商品资料
- **THEN** 计划提示词要求一个完整可见、占主导的商品主体和统一的功能可视化构图
- **AND** 提示词要求展示全部有证据支持的功能、机制、效果路径或结果
- **AND** 提示词禁止前后对比、左右并列、分屏、成对状态、重复商品主体和多面板对比布局
- **AND** 提示词仍禁止虚构未提供的技术结构、性能数字、认证或效果

#### Scenario: 不同营销和平台规划路径保持单一主体语义
- **WHEN** 用户在促销、平台搜索或平台原生规划中选择功能效果渲染图
- **THEN** 该路径的场景、类目和平台图片类型提示词不重新引入比较或分栏构图
- **AND** 平台计划继续使用兼容的内部图片类型 ID，但对用户显示“功能效果渲染图”并使用单一主体功能渲染构图策略
