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
For ordinary Creation carousel and SKU items, the system SHALL apply the selected target language to newly added marketing copy outside the supplied physical product or packaging subject while preserving product names, model names, numbers, and units from the user's product input. The system SHALL support Simplified Chinese, English, Japanese, Korean, French, German, and Spanish presets.

The target language MUST NOT translate, transliterate, rewrite, correct, localize, redraw, replace, remove, cover, or restyle any existing content on a supplied physical product or packaging subject. Protected subject content SHALL include patterns, artwork, illustrations, symbols, Logo and brand marks, printed, engraved, embossed, or embroidered text, exact characters and spelling, writing system, original language, placement, orientation, proportions, and colors. Existing subject content in a different language SHALL remain visible in that original language and SHALL be an explicit exception to target-language-only rules for newly added text. Source-card overlays outside the physical subject, including badges, prices, captions, and watermarks, SHALL NOT become protected subject content solely because they are present in a reference image.

Local generation, Worker generation, and repair SHALL enforce the same protection at runtime for current plans and historical frozen prompts. The dedicated `infographic-rebuild` item SHALL remain outside this ordinary-item rule and SHALL continue following its source-only target-language translation contract.

#### Scenario: User selects English target language
- **WHEN** the user starts an ordinary Creation Mode set with English selected
- **THEN** each eligible generated item prompt instructs the image generator to use concise English for newly added marketing copy outside the physical subject
- **AND** it does not treat the target language as permission to translate or redraw existing subject-surface content

#### Scenario: User selects Chinese target language
- **WHEN** the user starts an ordinary Creation Mode set with Chinese selected
- **THEN** each eligible generated item prompt instructs the image generator to use concise Simplified Chinese for newly added marketing copy outside the physical subject
- **AND** it preserves any different original language already printed or rendered on the physical subject

#### Scenario: Product packaging carries original artwork and foreign-language text
- **WHEN** a carousel or SKU item uses a supplied package subject whose surface contains patterns, illustrations, symbols, branding, and text in a language different from the selected target language
- **THEN** the prompt requires those subject-surface elements, exact characters, spelling, writing system, language, placement, orientation, proportions, and colors to remain unchanged
- **AND** only new captions, callouts, labels, or marketing typography outside the package use the selected target language

#### Scenario: Historical frozen prompt is generated or repaired
- **WHEN** Local, Worker, or repair executes an ordinary saved item whose frozen prompt predates the subject-content protection rule
- **THEN** the runtime prompt adds the same subject-content protection and target-language scope without requiring replanning

#### Scenario: Dedicated infographic rebuild translates source text
- **WHEN** an `infographic-rebuild` item is generated with a selected target language
- **THEN** its canonical source-only prompt continues requiring complete faithful translation of translatable source text
- **AND** the ordinary carousel and SKU subject-content rule is not appended to that dedicated prompt

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
The Creation record UI SHALL preserve every current Listing draft in the fixed field order 标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组 and SHALL display all seven fields continuously on one page without content-group or language-view controls. Within every field or list item, the UI SHALL display the English value first and its corresponding Simplified Chinese value immediately below it when that localized value exists; this bilingual comparison SHALL remain vertical at every supported viewport width. English and Simplified Chinese values belonging to the same list item SHALL form one compact visual pair. A divider SHALL appear only between adjacent list items, SHALL follow the complete bilingual pair rather than separate its two languages, and SHALL match the rendered width of the longer value in that pair without exceeding the available content width. Every visible English value SHALL remain an independent copy target that copies only that English value, and every visible Simplified Chinese value SHALL remain an independent copy target that copies only that Chinese value. Field-level English and Chinese copy controls SHALL copy the complete corresponding language value for that field, while full-copy and export actions SHALL preserve the complete bilingual field mapping. Generate, full-copy, and export controls SHALL remain available from a compact Listing workspace toolbar while the user reviews a long draft. All copy and export actions SHALL be immediately available without validation or review gating.

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
Each reliable complete visible SKU unit SHALL have one ordered pure-color label. The label SHALL contain only reliable color names. Its characters MUST be limited to Unicode letters, numbers, spaces, and a single hyphen located between letters or numbers inside a recognized compound color name. Multiple separate colors inside one unit label SHALL be separated by single spaces only. A hyphen MUST NOT separate independent colors. The label MUST NOT contain commas, quotation marks, slashes, brackets, list markers, or any other punctuation, and it MUST NOT contain part names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or any other non-color text. Neutral colors shared by variants SHALL remain eligible, but the associated part names SHALL be removed. Multiple colors for one unit SHALL remain one structured value, while separate complete units SHALL remain separate ordered array values. Backgrounds, shadows, highlights, reflections, source-card text, and uncertain colors SHALL NOT be evidence. The system SHALL normalize analyzed, submitted, and historical labels before planning, and the SKU prompt SHALL render only the normalized color label below its unit in the target language.

#### Scenario: One subject has several characteristic component colors
- **WHEN** one complete SKU subject visibly has a brown exterior, a black strap, and silver lenses
- **THEN** reference analysis returns one color-label value `brown black silver` for that product unit
- **AND** the planned SKU prompt requests that exact color-only label below the subject without `exterior`, `strap`, `lenses`, quotation marks, commas, or other non-color characters

#### Scenario: A color name originally contains a hyphen
- **WHEN** a reliable recognized compound SKU color is supplied as `off-white`
- **THEN** the system preserves the visible label as `off-white`
- **AND** the internal hyphen remains because it belongs to the color name
- **AND** a hyphen used only between separate colors is removed and replaced by the normal single-space separator

#### Scenario: Grouped subjects each have multi-color labels
- **WHEN** one SKU subject image contains multiple complete visible product units and each unit has several characteristic colors
- **THEN** reference analysis returns exactly one ordered color-only label value per complete product unit
- **AND** each array value uses spaces between separate colors while retaining any recognized compound color's internal hyphen
- **AND** two units with the same colors retain two ordered label values instead of being deduplicated
- **AND** the planned SKU prompt places each complete label below its corresponding product unit without adding quotes, commas, bullets, indexes, or brackets to the visible text

#### Scenario: A visible neutral component is shared across variants
- **WHEN** each visible variant uses the same black strap or gray frame as a physical part of the sellable subject
- **THEN** `black` or `gray` remains eligible for every applicable color label
- **AND** `strap`, `frame`, and other part names do not appear in the visible label

#### Scenario: Submitted label contains non-color qualifiers
- **WHEN** analysis, browser input, or a historical record supplies a label such as `matte brown leather, black strap, silver lenses`
- **THEN** the system normalizes the label to `brown black silver` before building the SKU prompt
- **AND** no removed word or disallowed punctuation is rendered below the subject

#### Scenario: Color evidence is unsafe
- **WHEN** a possible color comes only from the background, shadow, highlight, environmental reflection, source-card text, an unclear region, or a value that cannot be reliably normalized as a color
- **THEN** reference analysis and local normalization exclude that possible color from the label
- **AND** if no reliable subject color remains, the planner does not request a guessed or fallback label

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

### Requirement: Creation result cards expose orange hover feedback

The system SHALL show an orange boundary highlight around both current and saved Creation result cards while a pointing device hovers the card. The highlight SHALL transition smoothly between resting and active states and SHALL NOT change the card dimensions, grid placement, or surrounding layout. A card containing keyboard focus SHALL expose the same boundary feedback. When the pointer remains stationary over a highlighted Creation result card for 30 seconds, the system SHALL emit one outward orange ripple without changing layout. Continued pointer inactivity SHALL repeat the ripple at 30-second intervals, while any pointer movement SHALL cancel the active ripple and restart the full interval. The system SHALL suppress the ripple when reduced motion is requested.

#### Scenario: Pointer enters and leaves a Creation result card

- **WHEN** the pointer enters a current or saved Creation result card
- **THEN** the card border and outer glow become orange without moving or resizing the card
- **AND** when the pointer leaves, the card transitions back to its resting border

#### Scenario: Keyboard focus enters a Creation result card

- **WHEN** a keyboard user focuses an interactive control inside a Creation result card
- **THEN** the card displays the same orange boundary highlight without changing the layout

#### Scenario: Stationary pointer triggers a repeating ripple

- **WHEN** the pointer remains over a current or saved Creation result card without moving for 30 seconds
- **THEN** one orange ripple expands outward from that card boundary and fades without moving or resizing the card
- **AND** while the pointer remains stationary, another ripple is emitted after each additional 30-second interval

#### Scenario: Pointer movement restarts the idle interval

- **WHEN** the pointer moves before or during an idle ripple
- **THEN** any active ripple is removed immediately
- **AND** the next ripple cannot occur until another uninterrupted 30-second interval has elapsed over a Creation result card

#### Scenario: Reduced motion suppresses the ripple

- **WHEN** the operating system requests reduced motion
- **THEN** the static orange hover or focus highlight remains available
- **AND** the outward idle ripple is not animated

### Requirement: 套图图片文件名以编号开头

系统 SHALL 对本地服务与 Cloudflare Worker 新生成的套图图片使用 `编号-时间-图片类型-短标识.扩展名` 的文件名结构。编号 SHALL 位于四位时分时间之前，非套图模式的文件名结构 SHALL 保持不变。

#### Scenario: 生成或修复一张套图图片

- **WHEN** 用户首次生成、补齐或重生成一张套图图片
- **THEN** 文件名以该图片在套图中的编号开头
- **AND** 紧随编号之后的是四位时分时间
- **AND** 图片类型、短标识和扩展名仍保留在文件名中

### Requirement: 摩托车骑行护目镜使用真实四级类目

Creation Mode SHALL 提供代码为 `C10-006-001-005`、名称为“骑行护目镜”、路径为“汽车摩托 > 摩托车用品 > 摩托装备 > 骑行护目镜”的四级商品类目，并 SHALL 在类目选择、搜索、参考分析自动匹配、计划和新套图记录中使用该稳定类目代码与路径。

#### Scenario: 用户搜索并选择骑行护目镜
- **WHEN** 用户按 `C10-006-001-005`、骑行护目镜或完整类目路径搜索四级类目
- **THEN** 系统返回名称为“骑行护目镜”的唯一类目模板
- **AND** 选择后控件、计划和新套图记录显示完整真实类目路径而不是“通用电商”

#### Scenario: 明确的摩托骑行风镜自动命中
- **WHEN** 参考分析文本同时包含摩托车或机车语境以及护目镜或风镜商品词
- **THEN** 系统自动匹配 `C10-006-001-005`
- **AND** 旧自动类目不会被继承到本轮商品上下文

#### Scenario: 宽泛护目镜文本保持未匹配
- **WHEN** 参考分析文本只包含“护目镜”或“风镜”而没有摩托车、摩托或机车语境
- **THEN** 系统不自动匹配骑行护目镜
- **AND** 系统不因此覆盖用户手工选择的类目或误匹配工业防护眼镜

#### Scenario: 修正已有错误回退记录
- **WHEN** 已知受影响的摩托车骑行风镜记录因类目库缺失而保存为通用电商
- **THEN** 系统维护操作将其顶层当前类目修正为 `C10-006-001-005` 及完整类目路径
- **AND** 已冻结的历史逐图提示词保持不变并可作为生成时审计证据

### Requirement: Image-count overrides preserve the compatible image-type catalog

The system SHALL keep every resolved carousel slot for the current platform addressable in `effectivePlan.slots` when a set-level image-count override is lower than the platform's compatible image-type count. The count override SHALL define the default enabled prefix without removing later compatible slots. `effectivePlan.items`, `carouselImageCount`, and actual generation SHALL continue to include only enabled carousel slots.

#### Scenario: 通用电商选择 5 张仍显示完整 18 种类型

- **WHEN** 用户在通用电商平台把套图数量设置为 5
- **THEN** `effectivePlan.slots` 和兼容图片类型区域保留全部 18 个通用电商原生类型
- **AND** 前 5 个默认槽位启用，其余 13 个槽位未启用
- **AND** 兼容图片类型计数显示 `5 / 18`
- **AND** `effectivePlan.items`、`carouselImageCount` 和实际生成只包含 5 个启用轮播项

#### Scenario: 零张与完整数量使用同一类型目录

- **WHEN** 用户把通用电商套图数量设置为 0、1 或 18
- **THEN** 每种数量下兼容图片类型区域都显示相同的 18 个原生类型
- **AND** 启用项数量分别为 0、1 或 18
- **AND** 未启用类型不会进入生成请求

#### Scenario: 用户等量替换兼容图片类型

- **WHEN** 通用电商当前启用 5 个类型，用户取消其中一个并启用第 18 个类型
- **THEN** 第 18 个类型保持可见且可以直接启用
- **AND** 最终 `effectivePlan.items` 和 `carouselImageCount` 仍为 5
- **AND** 实际生成包含新启用类型且不包含被取消类型

#### Scenario: 命名平台目录不扩展为通用 18 项

- **WHEN** 当前命名平台只提供 6 个解析后可用的规范化轮播槽位，且用户选择少于 6 张
- **THEN** 兼容图片类型区域持续显示该平台的 6 个槽位
- **AND** resolver 不增加第 7 至 18 个通用或 `custom` 类型

#### Scenario: 追加生成项不进入兼容类型目录

- **WHEN** 当前计划还包含 SKU 图或信息图重构项
- **THEN** 这些追加项不进入 `effectivePlan.slots` 的兼容轮播目录或其分母
- **AND** 它们继续只计入各自计数与 `totalPlannedItemCount`

### Requirement: Creation Mode shows set-level generation queue
The Creation Mode workbench SHALL show a compact queue strip for submitted image sets when a set is running or waiting.

#### Scenario: A set is currently generating
- **WHEN** a Creation Mode set is generating
- **THEN** the output panel shows that set in the queue strip as the current generation
- **AND** the main image grid displays that set's item-level progress

#### Scenario: Another set is queued
- **WHEN** the user submits a second Creation Mode set while one is already generating
- **THEN** the second set is added behind the active set
- **AND** the queue strip shows the waiting set as a compact pill labeled by queue order, such as "队列一" and "队列二"
- **AND** the queued set preview includes any SKU image cards derived from the submitted SKU subjects

### Requirement: Creation Mode keeps one set visible in the main grid
The Creation Mode main result grid SHALL display one selected set at a time instead of merging images from multiple queued sets.

#### Scenario: User selects a queued set
- **WHEN** the user clicks a queued set in the queue strip
- **THEN** the main grid switches to that set's queued preview cards
- **AND** the active generation continues without changing order

#### Scenario: A queued set finishes while another set starts
- **WHEN** one queued set completes and the next queued set starts generating
- **THEN** the completed set remains visible in the queue strip for the current browser session
- **AND** the user can switch back to the completed set without refreshing the page

### Requirement: Creation Mode can enqueue during generation
The Creation Mode primary generation action SHALL remain available for valid set submissions while another set is running, up to the configured queue limit.

#### Scenario: User submits while another set is running
- **WHEN** a Creation Mode set is already running
- **AND** the user submits valid product inputs for another set
- **THEN** the button communicates the queue action
- **AND** the app stores a snapshot of that set's form data for later execution
- **AND** the queued set starts after the active set finishes

### Requirement: Platform switching is immediate and race-safe
The system SHALL accept a valid Creation platform selected by the user immediately, without displaying a confirmation dialog or offering a cancel rollback. The switch SHALL clear platform-related planning state, reset the draft preview, and resolve the new platform plan while preserving product evidence and generation configuration. Reference analysis results SHALL only apply to the platform and category snapshot that initiated them.

#### Scenario: User switches directly to another platform
- **WHEN** the user selects a valid platform different from the current Creation platform
- **THEN** the selected platform becomes current without calling `window.confirm` or displaying another confirmation dialog
- **AND** the system clears platform-related image types, order, enabled carousel count, automatic language, automatic ratios, automatic resolutions, composition strategy, and set/item overrides
- **AND** it resets the previous draft preview and immediately exposes the newly resolved platform plan

#### Scenario: Direct platform switching preserves product evidence and configuration
- **WHEN** the system directly accepts a new Creation platform
- **THEN** it preserves product name, description, selling points, category, dimensions, reference files and metadata, Logo, SKU, output format, and model/API configuration
- **AND** only platform-related planning state is cleared

#### Scenario: User selects the previous platform again
- **WHEN** the user selects a platform that was active before an intervening platform switch
- **THEN** the system directly accepts that selection and resolves the platform using current rules
- **AND** it does not restore the platform-specific set or item overrides that were cleared by the earlier switch

#### Scenario: Old reference analysis finishes after a direct switch
- **WHEN** a reference analysis request was started for an earlier platform or category
- **AND** its response arrives after the current platform or category has changed
- **THEN** the response is ignored and cannot alter product suggestions, reference roles, notes, category, selected slots, or plan preview

### Requirement: Platform confirmation removal is isolated to platform selection
The system SHALL retain the existing Creation reference-analysis recommendation application flow and SHALL keep platform planning, preview, and generation contracts unchanged apart from removing confirmation and cancellation from the platform select interaction.

#### Scenario: Reference analysis suggestions still require their existing apply action
- **WHEN** Creation reference analysis returns role, note, product, category, or SKU suggestions
- **THEN** the existing recommendation summary and Apply suggestions action remain available
- **AND** changing platform does not automatically apply or discard those suggestions except through existing freshness rules

#### Scenario: Platform planner and APIs remain compatible
- **WHEN** a directly accepted platform is previewed or submitted for generation
- **THEN** the browser uses the existing platform, override, preview, and generation API fields
- **AND** Local and Worker use the existing platform resolver, Creation planner, validation, queue, and persistence behavior

### Requirement: SKU color recognition is context-safe and target-localized
The SKU color normalizer SHALL reject ambiguous token occurrences inside unrelated words or conjunction phrases and SHALL emit canonical color-only values. When one unit has multiple recognized colors, the planner SHALL localize every color into the selected supported target language before composing the exact visible label.

#### Scenario: Product text contains ambiguous CJK substrings
- **WHEN** product text contains `青少年防紫外线` without reliable visible color evidence
- **THEN** the normalizer does not infer blue, cyan, or purple labels from those substrings

#### Scenario: English conjunction resembles a foreign color token
- **WHEN** an English value contains `black or rose`
- **THEN** the normalizer does not emit `black or rose` as one color-only label
- **AND** conjunction text is never preserved as a color name

#### Scenario: Chinese target receives a multi-color English label
- **WHEN** a reliable unit label is `brown black silver` and the selected target language is Simplified Chinese
- **THEN** the planned exact visible label contains the corresponding Chinese color names in the same order
- **AND** no English color token remains in that label

### Requirement: Product-name category matching requires reliable category semantics
Automatic fourth-level category matching from a product name SHALL use exact category identity, explicit aliases, or existing scored context that reliably identifies the category path. A unique but broad leaf-name suffix alone SHALL NOT select or write a category.

#### Scenario: Unrelated products share a broad leaf suffix
- **WHEN** a product name is `钢琴支架`, `硬盘支架`, `相机支架`, or `投影仪支架` without mobile-accessory context
- **THEN** the system does not assign `数码电子 > 手机通讯 > 手机配件 > 支架`
- **AND** automatic selection falls back without overwriting a manual category

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

### Requirement: 套图 SKU 项名称使用可靠颜色标签

Creation Mode SHALL 将新计划和本地队列中的 SKU 项命名为 `SKU image {序号} - {颜色名称}`，其中 `{颜色名称}` 来自与 SKU 图内颜色标签相同的可靠颜色解析和目标语言本地化规则。对于简体中文目标语言，同一完整商品主体内的多颜色名称 SHALL 在用户界面名称中压缩显示：除最后一个颜色词外，前面颜色词末尾的“色” SHALL 被省略，颜色词之间不加空格，例如 `red black blue` SHALL 显示为 `红黑蓝色`。英文颜色名称 SHALL 保持 `red black blue` 的空格形式不变。没有结构化 `colorNames` 或 `color_names` 数组时，同一 SKU 主体可靠解析出的多个颜色 SHALL 默认作为一个名称标签处理；只有明确的 `subjectUnitCount` 与可靠颜色数相等时，才 SHALL 视为多个完整主体并保留标签边界。一个完整商品主体内的多个颜色在 SKU 图内 SHALL 仍保持为一个以单个空格连接的完整标签。结构化数组中的多个标签 SHALL 表示分组 SKU 的多个完整主体，并按稳定主体顺序各自格式化后以 ` / ` 连接。系统 MUST NOT 从背景、阴影、高光、环境反射、源卡片覆盖文字或无法安全规范化的文本推测颜色。

名称中的中文压缩 SHALL 只作用于计划项和队列项的用户可见名称，不得改变 SKU 图内提示词标签。单个复合颜色如 `深蓝色`、`玫瑰金色` 或 `米白色` SHALL 保持完整，不得因没有多个独立颜色而去掉末尾“色”。

当没有可靠颜色标签时，系统 SHALL 使用 `SKU image {序号}`，MUST NOT 回退到原始 SKU 标题、ID、货号或参考文件名。新计划的 SKU `filenameToken` 和新生成图片的文件名短标识 SHALL 只使用稳定 SKU 序号和可选的可靠颜色 token，MUST NOT 包含原始 SKU 标题、ID、货号或参考文件名。该名称变化 SHALL 不改变 SKU 项序号、排序、ID、生成提示词、Listing、导出字段、原始参考文件名、参考索引、图片关联或已持久化历史项。

#### Scenario: 单一 SKU 使用本地化颜色名称

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `brown black silver` 且目标语言为简体中文
- **THEN** 该 SKU 项名称为 `SKU image 1 - 棕黑银色`
- **AND** SKU 图内的颜色标签仍为 `棕色 黑色 银色`
- **AND** `filenameToken` 不包含原始 SKU 标题、ID、货号或参考文件名

#### Scenario: 分组 SKU 保留多个主体颜色顺序

- **WHEN** 一个新计划或本地队列中的 SKU 主体按稳定顺序提供 `blue` 和 `gray` 两个完整主体颜色标签
- **THEN** 该 SKU 项名称使用 `SKU image {序号} - blue / gray`
- **AND** `filenameToken` 只使用稳定序号和安全颜色 token

#### Scenario: SKU 缺少可靠颜色名称

- **WHEN** 一个 SKU 主体没有可靠的结构化、显式或可安全识别的颜色标签，且参考文件名为 `260526-SKU-151142-5714.png`
- **THEN** 该 SKU 项名称为 `SKU image {序号}`
- **AND** `filenameToken` 和新生成图片文件名均不包含 `260526-SKU-151142-5714`、SKU 标题、ID 或其他货号
- **AND** 原始 SKU ID、参考文件名、参考索引和图片关联保持不变

#### Scenario: Historical saved plan keeps its name

- **WHEN** 一个历史记录已经保存了使用旧降级顺序生成的 SKU 项名称或 `filenameToken`
- **THEN** 系统保留该记录中已经保存的值
- **AND** 不迁移其文件名、提示词、Listing、导出字段或下游数据

#### Scenario: 中文多颜色显示名压缩且图内标签不变

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `red black blue` 且目标语言为简体中文
- **THEN** 该 SKU 项名称为 `SKU image 1 - 红黑蓝色`
- **AND** SKU 图内对应的颜色标签仍为 `红色 黑色 蓝色`

#### Scenario: 英文多颜色显示名保留空格

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `red black blue` 且目标语言为 English
- **THEN** 该 SKU 项名称为 `SKU image 1 - red black blue`

#### Scenario: 中文分组 SKU 不跨主体压缩

- **WHEN** 一个本地队列中的分组 SKU 按稳定顺序提供 `red` 和 `black` 两个完整主体颜色标签且目标语言为简体中文
- **THEN** 该 SKU 项名称使用 `SKU image {序号} - 红色 / 黑色`

#### Scenario: 单个复合颜色保持完整

- **WHEN** 一个 SKU 主体只有一个可靠复合颜色 `navy blue` 且目标语言为简体中文
- **THEN** 该 SKU 项名称使用 `SKU image {序号} - 深蓝色`

### Requirement: 套图记录复用显式多选导出 Temu Excel

系统 SHALL 在套图记录中提供“导出 Temu Excel”操作，并 SHALL 使用现有显式勾选记录作为批次目标。勾选批次 MUST 保持独立于当前详情记录。浏览器 SHALL 只提交当前完整已加载集合中仍存在的、有界、去重 set ID，并 SHALL 调用本地 `POST /api/creation/sets/export-temu-excel` 获取一个 `.xlsx` 附件。

#### Scenario: 用户导出多套勾选记录

- **WHEN** 用户勾选两套或更多套图记录并启动 Temu Excel 导出
- **THEN** 浏览器按当前勾选顺序提交不同的 set ID
- **AND** 服务端返回一个包含所有有效目标的 Temu `.xlsx`
- **AND** 勾选记录不会替换当前打开的详情记录

#### Scenario: 没有显式勾选记录

- **WHEN** 当前没有仍属于已加载集合的勾选记录
- **THEN** “导出 Temu Excel”操作处于禁用状态
- **AND** 浏览器不发送导出请求

#### Scenario: 批量导出完成或失败

- **WHEN** 一次 Temu 导出请求结束
- **THEN** 当前记录、关键词和时间筛选、仍有效的勾选记录及列表滚动位置保持不变
- **AND** 页面显示成功的记录数、SKU 行数和问题数，或显示结构化失败原因

### Requirement: Temu 导出使用已确认模板并按 SKU 一行写入

系统 SHALL 使用用户确认、版本化且可验证的标准 Temu `.xlsx` 模板。导出器 SHALL 验证模板身份、目标数据 sheet 和关键表头，SHALL 按请求 set 顺序及每套 manifest 的规范 SKU 顺序写入一 SKU 一行，并 SHALL 保留未映射的模板 sheet、列顺序、格式、数据验证和受信公式。系统 MUST NOT 在模板缺失或不匹配时猜测表头或创建一个相似替代模板。

#### Scenario: 一套记录包含多个 SKU

- **WHEN** 一个选中 manifest 包含三个按稳定顺序保存的 `skuSubjects`
- **THEN** 工作簿为该商品生成三行且顺序与 manifest 一致
- **AND** 每行重复商品级字段并只使用对应 SKU 的标识、名称、图片和特有事实
- **AND** 系统不从文件名、图片或提示词发明额外 SKU

#### Scenario: 选中记录没有可用 SKU

- **WHEN** 一个选中 manifest 没有可识别的 `skuSubjects`
- **THEN** 工作簿仍为该记录生成一个商品级待补全行
- **AND** SKU 单元格保持空白
- **AND** 导出问题表为该行记录 `MISSING_SKU`

#### Scenario: 标准模板结构不匹配

- **WHEN** 模板文件缺失、身份不匹配、目标 sheet 缺失或关键表头发生未知漂移
- **THEN** 服务端在任何图片上传和工作簿写入前停止
- **AND** 返回明确模板错误
- **AND** 不生成猜测列的替代工作簿

### Requirement: 导出默认值只补空缺并保留事实来源

Temu 导出表单 SHALL 允许用户显式提供第一变种属性名、默认价格、包装长度、包装宽度、包装高度、包装重量、库存和产地。API SHALL 使用 `variantAttributeName` 表示第一变种属性名，并分别使用 `defaultPrice`、以厘米为单位的三个包装尺寸字段、以克为单位的包装重量字段、非负整数库存和模板格式的产地字段。已有明确记录值 SHALL 优先；用户默认值 SHALL 只补空字段，并 SHALL 在导出问题表中标记为“用户批次默认值”。系统 MUST NOT 自动估算或猜测价格、尺寸、重量、库存或产地。

#### Scenario: 记录值和默认值同时存在

- **WHEN** 一行已有明确包装重量且用户同时提供默认包装重量
- **THEN** 导出行保留已有明确重量
- **AND** 默认重量不覆盖该值

#### Scenario: 默认值补齐空字段

- **WHEN** 一行缺少库存且用户显式提供有效默认库存
- **THEN** 导出行使用该默认库存
- **AND** 问题表对该行和库存字段记录 `USER_DEFAULT_APPLIED`
- **AND** 来源显示为用户批次默认值而不是识别值或平台值

#### Scenario: 尺寸或重量没有事实和默认值

- **WHEN** 一个模板必填尺寸或重量既没有明确记录值也没有用户默认值
- **THEN** 对应单元格保持空白
- **AND** 问题表记录 `MISSING_REQUIRED_FIELD`
- **AND** 系统不从图片尺寸、提示词、类目常见值或其他 SKU 推断数值

### Requirement: Listing 与模板必填字段缺口可导出且可定位

导出器 SHALL 只读取套图记录已有的兼容 Listing 草稿和 manifest 字段，MUST NOT 在导出过程中生成、翻译或重写 Listing。缺少 Listing 或任一模板必填字段时，系统 SHALL 继续生成待补全工作簿，SHALL 保持未知单元格为空，并 SHALL 在导出问题表中用 set、SKU、数据行和模板字段定位每个缺口。

#### Scenario: 记录没有 Listing

- **WHEN** 一个选中 set 没有可用 Listing 草稿
- **THEN** 该 set 的每个 SKU 行仍写入工作簿
- **AND** Listing 相关字段保持空白
- **AND** 问题表记录 `MISSING_LISTING` 及对应必填字段问题
- **AND** 导出器不调用模型生成替代 Listing

#### Scenario: 只有部分必填字段缺失

- **WHEN** 一行有标题、SKU 和图片，但缺少模板要求的申报价格
- **THEN** 已知字段按原值导出
- **AND** 申报价格保持空白
- **AND** 问题表准确指向该行的申报价格列

### Requirement: 图片 URL 优先复用公网地址并可选执行 Cloudinary unsigned upload

导出器 SHALL 为模板图片字段使用可验证的公网 HTTPS URL。已有无凭据、非本地网络目标的绝对 HTTPS URL SHALL 直接复用。仅有安全本地输出文件时，系统 MAY 在用户同时提供 `cloudName` 与 unsigned `uploadPreset` 后调用固定 Cloudinary 官方 image upload 端点，并 SHALL 只接受有效响应中的公网 HTTPS `secure_url`。请求和持久化结构 MUST NOT 接受或保存 API Secret、签名、自定义上传 endpoint、Authorization header 或 Cookie。

#### Scenario: 记录已有公网 HTTPS 图片

- **WHEN** 一个所需图片已有符合公网边界的绝对 HTTPS URL
- **THEN** 工作簿直接使用该 URL
- **AND** 系统不把该图片重新上传到 Cloudinary

#### Scenario: 本地图片使用 unsigned preset 上传成功

- **WHEN** 一个所需图片只有安全本地 `relativePath`，且用户提供合法 `cloudName` 与 `uploadPreset`
- **THEN** 本地服务向 `https://api.cloudinary.com/v1_1/<cloudName>/image/upload` 提交有界 multipart unsigned upload
- **AND** 请求只包含图片和 `upload_preset` 等允许的 unsigned 字段
- **AND** 工作簿使用响应中验证后的 `secure_url`
- **AND** 请求不包含 API Secret 或签名

#### Scenario: 没有 Cloudinary 配置

- **WHEN** 所需图片只有本地文件且请求未提供 Cloudinary 配置
- **THEN** 服务端仍生成待补全工作簿
- **AND** 对应图片单元格保持空白
- **AND** 问题表记录 `MISSING_PUBLIC_IMAGE_URL` 和需要配置 unsigned upload 或人工补图的建议
- **AND** 系统不把相对路径、本地绝对路径或虚构 URL 写入图片字段

#### Scenario: 部分图片上传失败

- **WHEN** 批次中的一个唯一图片上传失败而其他图片成功
- **THEN** 成功图片继续用于所有关联 SKU 行
- **AND** 失败图片对应单元格保持空白
- **AND** 问题表定位所有受影响的行和图片字段
- **AND** 整个工作簿仍可下载

#### Scenario: Cloudinary 素材图派生为合规方图

- **WHEN** 产品素材图使用 Cloudinary delivery URL
- **THEN** 导出器使用白底 pad 方式派生 1200×1200 的 1:1 HTTPS 交付 URL
- **AND** SKU 预览图和轮播图仍使用各自对应的原图 URL
- **AND** 本地源图片不被改写

### Requirement: 成功的 Cloudinary URL 按本地源指纹缓存到 manifest

系统 SHALL 将成功 Cloudinary 上传的 `secure_url`、本地源相对路径内容指纹、cloudName、远端资源标识和上传时间写入对应 Creation manifest 的版本化缓存。缓存 SHALL 只在源文件指纹、cloudName 和 URL 安全边界仍匹配时复用；更新 SHALL 通过每 set 串行 merge-save 保留其他并发字段。失败上传 MUST NOT 产生成功缓存。

#### Scenario: 后续导出复用未变化图片

- **WHEN** 一个 item 已有有效缓存且当前本地文件 SHA-256 与缓存指纹相同
- **THEN** 后续导出直接复用缓存 `secure_url`
- **AND** 不再次调用 Cloudinary

#### Scenario: 本地图片内容发生变化

- **WHEN** item 的 `relativePath` 相同但文件内容指纹与缓存不同
- **THEN** 旧缓存不用于本次工作簿
- **AND** 有合法 unsigned 配置时系统重新上传当前文件
- **AND** 无配置时将图片作为待补全问题处理

#### Scenario: 上传成功但缓存写入失败

- **WHEN** Cloudinary 返回有效 `secure_url` 但 manifest merge-save 失败
- **THEN** 当前工作簿可以使用本次取得的 URL
- **AND** 问题表记录 `IMAGE_CACHE_WRITE_FAILED`
- **AND** 系统不声称该 URL 已持久化缓存

### Requirement: 导出问题表完整说明待补全和清理事项

每个 Temu 导出工作簿 SHALL 包含独立导出问题 sheet。该 sheet SHALL 至少提供严重级别、问题代码、set ID、商品名称、SKU ID/名称、数据行号、模板字段/列、问题说明、当前来源和建议处理。它 SHALL 覆盖缺 Listing、缺 SKU、缺模板必填字段、缺公网图片、Cloudinary 配置或上传问题、文件/路径问题、缓存写入失败、单元格清理和长度截断，并 MUST NOT 暴露 Secret、认证信息、本地绝对路径或未经清理的上游响应。

#### Scenario: 工作簿没有数据问题

- **WHEN** 所有导出行的必填字段和图片均完整且没有清理或缓存警告
- **THEN** 工作簿仍包含稳定命名的问题 sheet 和表头
- **AND** 问题数据区为空

#### Scenario: 同一失败图片影响多个 SKU

- **WHEN** 一个共享图片 URL 解析失败并影响三个 SKU 行
- **THEN** 内部上传或解析工作可以去重
- **AND** 问题表仍能定位三个受影响行各自的模板图片字段

### Requirement: Temu Excel 导出限制输入、路径和单元格风险

本地端点 SHALL 在网络上传或工作簿写入前执行有界输入检查：JSON body 最多 256 KiB、最多 100 个不同 set ID、每个 ID 最多 200 字符、总数据行最多 2000、唯一图片最多 5000、单个本地图片最多 20 MiB。manifest 文件名解析后存储的 set ID MUST 与请求精确匹配。本地图片 SHALL 同时通过词法和 `realpath` 输出根 containment、`lstat` 普通文件、非符号链接及图片类型检查；端点 MUST NOT 接受客户端绝对源路径或目标目录。

所有外部文本 SHALL 作为非公式数据写入，SHALL 清除 XML 1.0 不允许的控制字符，并 SHALL 将忽略前导空白后以 `=`, `+`, `-`, `@` 开头的文本编码为电子表格字面值。任何单元格 SHALL 不超过 32767 字符；发生字符清理或截断时 SHALL 在问题表中记录。模板定义外的公式单元格 MUST NOT 被数据映射覆盖。

#### Scenario: set ID 清理发生文件名碰撞

- **WHEN** 请求 ID 经文件名清理后指向一个 manifest，但 manifest 内存储的 set ID 与请求值不同
- **THEN** 服务端拒绝该目标
- **AND** 不读取其图片、不上传资源且不把它写入工作簿

#### Scenario: manifest 图片路径经过符号链接逃逸

- **WHEN** 一个相对图片路径词法上位于输出根内但实际文件通过符号链接指向输出根外
- **THEN** 系统不读取或上传该文件
- **AND** 其他安全行仍可导出
- **AND** 问题表记录路径安全问题且不暴露根外绝对路径

#### Scenario: 外部文本尝试公式注入

- **WHEN** 商品、SKU、Listing 或默认产地文本忽略前导空白后以 `=`, `+`, `-` 或 `@` 开头
- **THEN** 输出单元格显示为字面文本而不执行公式
- **AND** 模板自带受信公式保持原样

#### Scenario: 单元格包含非法 XML 字符或超长文本

- **WHEN** 一个外部文本包含 XML 1.0 不允许的控制字符或超过 32767 字符
- **THEN** 系统移除非法控制字符并在 Unicode 边界限制长度
- **AND** 生成的工作簿可以重新打开
- **AND** 问题表记录清理或截断及原始长度，不存放完整超长原文

#### Scenario: 批次超过输入边界

- **WHEN** 请求体、set 数、输出行数、唯一图片数或单图大小超过规定上限
- **THEN** 服务端在任何 Cloudinary 上传和工作簿写入前返回 `400` 或 `413`
- **AND** 不产生部分工作簿或部分远端上传

### Requirement: Temu Excel 导出具有明确的本地与 Cloudflare 能力边界

`POST /api/creation/sets/export-temu-excel` SHALL 在共享 API capability matrix 中标记为 Local supported、Cloudflare unsupported。Local SHALL 使用本地 Creation manifest、受控输出文件和可持久化 manifest 缓存生成 XLSX。Cloudflare SHALL 返回现有 `unsupported_runtime_capability` JSON，MUST NOT 从 R2 任务或浏览器临时状态伪造记录，MUST NOT 代表用户执行 Cloudinary 上传，并 MUST NOT 返回空的假工作簿。

#### Scenario: 本地服务导出有效批次

- **WHEN** Local 接收通过输入与模板校验的导出请求
- **THEN** 它返回正确 XLSX MIME 和安全 attachment 文件名
- **AND** 工作簿包含模板数据行和导出问题 sheet
- **AND** 响应不被缓存

#### Scenario: Cloudflare 收到导出请求

- **WHEN** Cloudflare Worker 收到 `POST /api/creation/sets/export-temu-excel`
- **THEN** 它返回 code 为 `unsupported_runtime_capability` 的结构化错误
- **AND** 前端说明需要使用本地应用
- **AND** Worker 不读取 R2、调用 Cloudinary 或返回 XLSX

### Requirement: 现有单套文本与 JSON 导出保持不变

Temu Excel SHALL 使用独立按钮、表单、端点和文件名。现有当前套图提示词 TXT、manifest JSON 和 Listing JSON 导出的可用条件、目标记录、payload、文件名及内容 SHALL 保持不变。

#### Scenario: 用户继续使用现有导出

- **WHEN** 用户在当前详情记录上导出提示词、manifest 或 Listing
- **THEN** 浏览器继续调用原有导出实现并生成原有格式
- **AND** 当前勾选的 Temu 批次不改变该单套导出目标
- **AND** 不要求 Cloudinary 配置或 Temu 模板

### Requirement: Browser and queue preserve safe SKU filename tokens

For each newly planned or locally queued SKU image, the system SHALL create a `filenameToken` from only the stable SKU sequence and an optional reliable normalized color label. Browser normalization SHALL preserve this token through generation and repair submissions. Local and Worker filename builders SHALL use the preserved token before any display title fallback. The token and new output filename MUST NOT contain the raw SKU title, SKU ID, product part number, or reference filename. Association metadata and generation prompts SHALL remain unchanged.

#### Scenario: Queued SKU has a part-number filename and no reliable color

- **WHEN** a newly queued SKU references `260526-SKU-151142-5714.png` and supplies no reliable color label
- **THEN** its display title is `SKU image 1`
- **AND** its `filenameToken` is `sku-1`
- **AND** browser normalization preserves `sku-1` for the generation request

#### Scenario: Queued SKU has a reliable color

- **WHEN** a newly queued second SKU supplies the reliable color label `blue`
- **THEN** its `filenameToken` is `sku-2-blue`
- **AND** the token contains no raw SKU title, ID, or reference filename

#### Scenario: Existing association metadata is retained

- **WHEN** a safe filename token is generated for a SKU item
- **THEN** the SKU ID, original reference filename, reference index, prompt, and image association remain available unchanged
