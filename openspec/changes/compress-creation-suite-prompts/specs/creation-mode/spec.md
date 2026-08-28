## ADDED Requirements

### Requirement: Suite item prompts stay short and positively phrased

Creation Mode SHALL compose every planned carousel and SKU item prompt as a short sequence of positive rendering instructions. Each prompt SHALL state what the image must contain rather than listing prohibited outcomes, and SHALL NOT contain `Do not`, `Avoid`, `Never`, `never`, `不要`, or other prohibition phrasing.

Necessary constraints SHALL be preserved as positive requirements. In particular the prompt SHALL still express that existing product and packaging surface content stays as shown, that exact size and weight values appear only in the dimension and specification roles, that visible facts come only from supplied product input and reference evidence, and that included-item images show the unpacked inventory on an open surface.

Each carousel or SKU item prompt SHALL contain at most 3300 characters. Every role SHALL contribute exactly one merged role directive instead of separate brief, shopper-question, buyer-decision, role-intent, role-focus, and rendering-constraint blocks.

#### Scenario: Planner builds a standard eight-image set

- **WHEN** the user plans an eight-image Creation set with product information, selling points, and dimension specifications
- **THEN** every planned carousel item prompt is at most 3300 characters
- **AND** no planned item prompt contains `Do not`, `Avoid`, `Never`, `never`, or `不要`
- **AND** each planned item prompt still names its role job, the product, and the facts assigned to that role

#### Scenario: Planner keeps necessary constraints in positive form

- **WHEN** a planned set reserves exact dimension values for the size or specification role and supplies a physical product subject
- **THEN** the non-dimension item prompts state that size and weight values belong to the dimension and specification images
- **AND** the item prompts state that existing product and packaging surface text, artwork, and marks stay exactly as shown in their original language
- **AND** the item prompts state that visible facts come only from supplied product input and reference evidence

#### Scenario: SKU prompt is compressed

- **WHEN** the plan appends SKU items for distinct sellable subjects
- **THEN** each SKU item prompt is at most 3300 characters
- **AND** it contains no prohibition phrasing
- **AND** it still requires the supplied SKU subject, its preserved shape, colors, markings, and identifiers, a new ecommerce background, the requested combination count, and one shared series template

## MODIFIED Requirements

### Requirement: Creation Mode generates a conversion-oriented ecommerce image set
The system SHALL generate one set for one product with quick presets of 4, 6, 8, 10, 12, 14, or 16 ecommerce marketing roles and SHALL allow the user to customize which of the 16 image roles are generated for the current set: hero, benefit, scene, multi-angle, atmosphere, product detail, brand story, size/capacity/fit, effect comparison, specification table, craft process, accessory/gift, series showcase, ingredient/material, after-sales, and usage suggestion. The system SHALL keep those role IDs stable while presenting conversion-oriented Chinese role labels: 首图成交主视觉, 目标人群共鸣图, 适用多场景图, 多角度产品展示图, 冲动下单氛围图, 产品细节特写图, 品牌质感/礼品价值图, 尺寸容量适配图, 功能效果渲染图, 参数规格图, 品质工艺证明图, 到手清单/配件图, 多款式/SKU选择图, 材质成分解析图, 痛点图, and 卖点图. The system SHALL also allow the user to choose an industry template for general ecommerce, apparel, beauty, food, consumer electronics, home/living products, or a searchable fourth-level ecommerce category template. The system SHALL support a set-level visual-language selector that defaults to `classic-commercial` and keeps the generated set visually consistent across lighting, tone, material treatment, realism level, and brand atmosphere. When the user uses a preset without custom role changes and no non-general industry template is selected, the first four roles SHALL remain 首图成交主视觉, 目标人群共鸣图, 适用多场景图, and 多角度产品展示图.

#### Scenario: User starts a conversion-oriented creation set
- **WHEN** the user submits product information and a target language in Creation Mode
- **THEN** the first planned item remains `hero` / 首图成交主视觉 and the second remains `benefit` / 目标人群共鸣图
- **AND** the hero prompt requests the reliable non-dimension product identity, description, selling-point, material, usage, scene, package, and trust facts that fit its bounded information hierarchy
- **AND** newly authored hero canvas copy uses the selected target language while physical product and packaging text remains unchanged
- **AND** the hero prompt retains 3–5 small circular scene frames around the dominant product

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
- **AND** if the user uploaded a Logo reference, each SKU prompt also applies that supplied logo while existing product identifiers stay visible

#### Scenario: User sets a same-SKU combination pack count
- **WHEN** the user sets the SKU combination count to 2, 5, or an equivalent Chinese numeral before planning or generating a Creation Mode set
- **THEN** every appended SKU image prompt requires exactly that many identical copies of the same SKU subject
- **AND** the prompt frames the count change as copy-and-arrange duplication of the same supplied subject with its shape, colors, markings, and hardware unchanged
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
- **AND** the scene reference note is used only to identify which source to follow
- **AND** the item prompt treats the assigned usage reference image as selling-point evidence that can inform setup, operation, charging, connection, care, or mistake-prevention benefits
- **AND** the usage source is expressed as selling-point evidence rather than the structure of the image

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
For ordinary Creation carousel and SKU items, the system SHALL apply the selected target language to newly added marketing copy outside the supplied physical product or packaging subject while preserving product names, model names, numbers, and units from the user's product input. The system SHALL support Simplified Chinese, English, Japanese, Korean, French, German, and Spanish presets.

The target language SHALL leave every existing element on a supplied physical product or packaging subject exactly as shown. Protected subject content SHALL include patterns, artwork, illustrations, symbols, Logo and brand marks, printed, engraved, embossed, or embroidered text, exact characters and spelling, writing system, original language, placement, orientation, proportions, and colors. Existing subject content in a different language SHALL remain visible in that original language and SHALL be an explicit exception to target-language-only rules for newly added text. Source-card overlays outside the physical subject, including badges, prices, captions, and watermarks, SHALL remain outside protected subject content.

The runtime subject-content instruction SHALL be expressed as positive preservation requirements without prohibition phrasing. Local generation and repair SHALL enforce the same protection at runtime for current plans and historical frozen prompts. The dedicated `infographic-rebuild` item SHALL remain outside this ordinary-item rule and SHALL continue following its source-only target-language translation contract.

#### Scenario: User selects English target language
- **WHEN** the user starts an ordinary Creation Mode set with English selected
- **THEN** each eligible generated item prompt instructs the image generator to use concise English for newly added marketing copy outside the physical subject
- **AND** the same prompt scopes that language to new canvas copy only, leaving existing subject-surface content as shown

#### Scenario: User selects Chinese target language
- **WHEN** the user starts an ordinary Creation Mode set with Chinese selected
- **THEN** each eligible generated item prompt instructs the image generator to use concise Simplified Chinese for newly added marketing copy outside the physical subject
- **AND** it preserves any different original language already printed or rendered on the physical subject

#### Scenario: Product packaging carries original artwork and foreign-language text
- **WHEN** a carousel or SKU item uses a supplied package subject whose surface contains patterns, illustrations, symbols, branding, and text in a language different from the selected target language
- **THEN** the prompt requires those subject-surface elements, exact characters, spelling, writing system, language, placement, orientation, proportions, and colors to remain unchanged
- **AND** only new captions, callouts, labels, or marketing typography outside the package use the selected target language

#### Scenario: Historical frozen prompt is generated or repaired
- **WHEN** Local generation or repair executes an ordinary saved item whose frozen prompt predates the subject-content protection rule
- **THEN** the runtime prompt adds the same subject-content protection and target-language scope without requiring replanning

#### Scenario: Dedicated infographic rebuild translates source text
- **WHEN** an `infographic-rebuild` item is generated with a selected target language
- **THEN** its canonical source-only prompt continues requiring complete faithful translation of translatable source text
- **AND** the ordinary carousel and SKU subject-content rule is not appended to that dedicated prompt
