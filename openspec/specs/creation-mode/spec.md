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

### Requirement: Suite item prompts stay short and positively phrased

Creation Mode SHALL compose every planned carousel and SKU item prompt as a concise sequence of positive rendering instructions. Each prompt SHALL state what the image must contain rather than listing prohibited outcomes, and SHALL NOT contain Do not, Avoid, Never, never, 不要, or other prohibition phrasing.

Necessary constraints SHALL be preserved as positive requirements. In particular, the prompt SHALL still express that existing product and packaging surface content stays as shown, that exact size and weight values appear only in the dimension and specification roles, that visible facts come only from supplied product input and reference evidence, and that included-item images show the unpacked inventory on an open surface.

Prompt composition SHALL NOT impose a character-length ceiling or truncate assembled sections to satisfy a total prompt length. Every role SHALL contribute one merged role directive instead of separate brief, shopper-question, buyer-decision, role-intent, role-focus, and rendering-constraint blocks.

Ordinary carousel item prompts SHALL be organized as separate lines for the task, the assigned references, product fidelity, canvas text, and style. The task line SHALL carry the role directive without a `Role job` label. Universal carousel prompts SHALL omit internal composition and scene-policy labels and buyer-goal labels; preserved legacy platform-native slots SHALL keep their saved composition and scene policy. Product identity and surface-content preservation SHALL be expressed once as a single `PRODUCT FIDELITY` instruction naming the primary product anchor when one exists, and runtime generation SHALL treat that instruction as satisfying both subject locks. Each assigned reference and its note SHALL appear once per prompt.

#### Scenario: Planner builds a standard eight-image set

- **WHEN** the user plans an eight-image Creation set with product information, selling points, and dimension specifications
- **THEN** every planned carousel item prompt retains its complete assembled sections regardless of total character count
- **AND** no planned item prompt contains Do not, Avoid, Never, never, or 不要
- **AND** each planned item prompt still names its role job, the product, and the facts assigned to that role

#### Scenario: Planner keeps necessary constraints in positive form

- **WHEN** a planned set reserves exact dimension values for the size or specification role and supplies a physical product subject
- **THEN** the non-dimension item prompts state that size and weight values belong to the dimension and specification images
- **AND** the item prompts state that existing product and packaging surface text, artwork, and marks stay exactly as shown in their original language
- **AND** the item prompts state that visible facts come only from supplied product input and reference evidence

#### Scenario: Carousel prompt is organized without duplicate blocks

- **WHEN** the planner builds a universal set with a primary product reference and an assigned package reference
- **THEN** each carousel prompt contains one `PRODUCT FIDELITY` instruction naming the primary reference and no separate subject content or identity lock
- **AND** it contains no `Role job`, `Buyer goal`, or `Composition:` label
- **AND** the package reference filename appears once in the item that carries it

#### Scenario: Runtime keeps the merged fidelity instruction

- **WHEN** Local generation executes a carousel item whose prompt contains `PRODUCT FIDELITY`
- **THEN** the runtime prompt adds no separate subject content or identity lock

#### Scenario: SKU prompt is compressed

- **WHEN** the plan appends SKU items for distinct sellable subjects
- **THEN** each SKU item prompt retains all assembled sections regardless of total character count
- **AND** it contains no prohibition phrasing
- **AND** it still requires the supplied SKU subject, its preserved shape, colors, markings, and identifiers, a new ecommerce background, the applicable subject count, and one shared series template

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

Platform, scenario, category, and visual-language labels used for planning SHALL remain internal metadata and SHALL NOT be rendered as artwork text.

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
- **THEN** its canonical source-only prompt continues requiring complete faithful translation of translatable surrounding layout text while preserving existing physical product or packaging text in its original language
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

### Requirement: Creation Mode uses a universal automatic plan
Creation Mode SHALL expose only the universal ecommerce profile for new user-created plans and SHALL NOT expose a marketplace platform selector. Browser submissions for new plans SHALL use `platform=universal`. The universal local plan SHALL retain up to 18 role-aligned carousel slots; AI marketing planning MAY independently create 1–20 ordinary carousel tasks. Product category, available evidence, and existing set-level overrides MAY shape the plan without selecting a marketplace. SKU and infographic rebuild items SHALL remain separately counted.

#### Scenario: New Creation plan uses the universal profile
- **WHEN** the user previews or generates a new Creation set
- **THEN** the browser submits `platform=universal` without offering marketplace choices
- **AND** the local plan uses the universal ecommerce profile

#### Scenario: Universal local and AI marketing counts remain distinct
- **WHEN** the user plans ordinary carousel images
- **THEN** the local template path supports up to 18 role-aligned slots
- **AND** the AI marketing path supports 1–20 independently planned tasks
- **AND** SKU and infographic rebuild additions do not count against either carousel limit

#### Scenario: Product category adjusts the universal plan
- **WHEN** the selected category or applied reference evidence indicates apparel fit, electronic specifications, food ingredients, multiple SKUs, package contents, or product condition
- **THEN** the resolver may substitute or prioritize relevant image types within the universal plan
- **AND** it does not invent facts absent from product input and applied reference evidence

#### Scenario: Historical marketplace plans remain frozen
- **WHEN** a saved set contains legacy marketplace profile metadata
- **THEN** the system preserves and displays that saved plan without offering marketplace selection for new plans
- **AND** ordinary retry and repair continue using the saved effective plan

### Requirement: Creation image types and evidence are first-class planning data
The system SHALL store an `imageType` and effective `logoPolicy` for each universal-plan carousel item while preserving the stable `role` as its content intent. The universal profile SHALL include its strategy version, evidence level, verification date, and source metadata. Any blocking constraint retained for compatibility SHALL reference a verified source; lower-confidence guidance SHALL remain advisory. Browser-consumed policy and resolver modules SHALL be generated as exact `public/lib` mirrors of their canonical `lib` sources.

#### Scenario: Image type preserves role compatibility
- **WHEN** the resolver creates a universal carousel slot
- **THEN** the plan item stores its `imageType` and supported Creation `role`
- **AND** reference selection, SKU, Logo, prompt allocation, filename, record, and repair behavior continue using the stable role where required

#### Scenario: A retained blocking constraint is validated
- **WHEN** a current or preserved legacy plan contains a sourced blocking constraint
- **AND** its overrides request a composition or visible text forbidden by that constraint
- **THEN** plan preview returns an item-level blocking conflict
- **AND** generation does not start for that invalid plan

#### Scenario: Preserved strict main image does not receive an uploaded Logo overlay
- **WHEN** a preserved legacy item has a sourced strict main-image type whose `logoPolicy` is `forbid-overlay`
- **AND** the user has uploaded and enabled a Logo
- **THEN** the plan and generation-reference assembly omit the external Logo for that item
- **AND** they preserve branding or identifiers already present on the supplied product subject
- **AND** other eligible secondary items may still use the uploaded Logo
- **AND** an item override that requests external Logo overlay produces a blocking conflict until the user restores `forbid-overlay` or changes the image type to `custom`

#### Scenario: Low-evidence policy stays advisory
- **WHEN** the universal profile or a preserved legacy rule has only conservative or non-authoritative evidence
- **THEN** the UI identifies it as a conservative recommendation
- **AND** the resolver does not turn that rule into a blocking official constraint

#### Scenario: Runtime planning does not crawl platform sites
- **WHEN** a user previews, generates, repairs, or reuses a Creation set
- **THEN** the system resolves the bundled versioned profile without fetching or logging into a third-party marketplace

#### Scenario: Public browser modules match canonical sources
- **WHEN** browser assets are built or verified
- **THEN** the platform policy and browser-used resolver files in `public/lib` are byte-equivalent to their canonical `lib` files
- **AND** an out-of-sync or missing mirror fails the repository sync check

### Requirement: Users can adjust universal plans without editing prompts or advanced per-item parameters

The system SHALL allow users to override universal-plan target language, default ratio, default resolution, visual language, enabled image count, compatible image-type enablement, thinking effort, and image quality. The SKU generation rule input SHALL remain editable. New Creation plans SHALL use a fixed one-subject SKU count and SHALL NOT expose or submit an editable SKU bundle-count field. The Creation UI SHALL NOT expose marketplace selection, item order, item image type, item ratio, item resolution, item language, item composition, item text density, item scene policy, item Logo policy, or item prompt editing, and SHALL NOT submit user-authored prompt overrides.

#### Scenario: User applies a set-level override

- **WHEN** the user changes the automatic target language, default ratio, default resolution, visual language, thinking effort, quality, or enabled image count
- **THEN** the effective plan uses that value for items without a more specific item override
- **AND** the UI marks the field as user-overridden

#### Scenario: User enables or disables compatible image types

- **WHEN** the user enables or disables a current carousel slot in the compatible image-type area
- **THEN** plan preview reflects the enabled slot list
- **AND** the planned carousel count equals the number of enabled carousel slots
- **AND** no advanced per-item editor or prompt input is shown

#### Scenario: Local template plan uses universal slot capacity

- **WHEN** the local template planning path is active
- **THEN** its count control supports up to 18 universal role-aligned carousel slots
- **AND** SKU images and infographic rebuilds remain independent additions

#### Scenario: Universal local plan retains 18 native slots

- **WHEN** the local template path is active and the user has not reduced the carousel count
- **THEN** 数量控件默认选择 18，并提供 0 至 18 的受支持选项
- **AND** resolver 和本地端点返回 18 个通用电商原生轮播项
- **AND** 这些轮播项对应原有 18 个角色且不使用 `custom` 图片类型补足

#### Scenario: Marketplace selection is unavailable

- **WHEN** the user opens Creation Mode
- **THEN** no marketplace selector is shown and the profile label is universal ecommerce
- **AND** new plan submissions use `platform=universal`

#### Scenario: First explicit count preview preserves aligned roles

- **WHEN** the user changes the image count and an `effectivePlan` has not returned yet
- **THEN** 首次预览仍提交显式数量及全部已对齐 `selectedRoles`
- **AND** 未手动编辑角色不会被解释为清空角色
- **AND** 只有不存在显式数量且不存在手动角色编辑时，浏览器才提交空角色选择以请求纯自动计划

#### Scenario: Universal recommended count remains visible without becoming an override

- **WHEN** the user has not changed the count and the universal local plan resolves to 18 carousel items
- **THEN** the count control and compatible image-type area show 18
- **AND** 浏览器不把该自动值保存为显式 `imageCount` 覆盖

#### Scenario: Compatible image types follow the current effective plan

- **WHEN** the universal plan resolves or the user enables or disables a compatible slot
- **THEN** 兼容图片类型区域仅列出当前 `effectivePlan` 的轮播槽位，并按每个槽位的 `enabled` 状态显示选择结果
- **AND** 计数显示“已启用轮播槽位数 / 当前轮播槽位总数”
- **AND** 追加 SKU 项和信息图重构项不进入该区域的列表或计数

#### Scenario: Explicit set parameters override universal defaults

- **WHEN** the user explicitly changes target language, ratio, or resolution
- **THEN** 浏览器把 `targetLanguage`、`ratio` 和 `resolutionTier` 保存为套图级覆盖
- **AND** 预览返回的每个轮播 item、冻结 `effectivePlan`、队列和实际逐图请求均使用这些显式值
- **AND** universal defaults do not override explicit values

#### Scenario: Image count change is frozen before first generation

- **WHEN** reference analysis or an earlier preview produced one count and the user selects a different image count
- **THEN** the browser immediately requests a refreshed plan using the new explicit count and aligned roles
- **AND** a generation submit waits for the latest preview to finish
- **AND** the first queued generation uses the refreshed count without requiring a second click

#### Scenario: SKU generation toggle preserves the universal carousel plan

- **WHEN** the user disables or enables SKU image generation
- **THEN** the browser refreshes the plan using the universal profile
- **AND** only appended SKU items, `skuImageCount`, and `totalPlannedItemCount` change
- **AND** `carouselImageCount`, ordered carousel slot keys, image types, and compatible image-type state remain unchanged
- **AND** the refresh does not show or submit the universal legacy role list

#### Scenario: User restores the current universal recommendation

- **WHEN** the user selects Restore current recommendation
- **THEN** the system clears applicable set and item overrides
- **AND** it recomputes the universal, category, and reference-derived plan
- **AND** it preserves product information, category, dimensions, references, Logo, SKU, output format, and model/API configuration

### Requirement: Creation generation uses per-item effective parameters consistently
The system SHALL include effective ratio, resolution tier, resolved size, and target language on each planned item. Local generation SHALL resolve and submit those values per item, and the same planning payload SHALL produce a deterministic effective plan.

#### Scenario: One set uses mixed ratios
- **WHEN** an effective plan contains square and portrait items
- **THEN** each generation request uses the ratio saved on its matching item
- **AND** the prompt ratio guidance, requested upstream aspect ratio, activity metadata, saved item metadata, and lightbox parameters agree for that item

#### Scenario: Selected route does not support the recommended size
- **WHEN** an item's resolution tier cannot be represented exactly by the active image-generation route
- **THEN** the system selects the nearest supported size for the same aspect ratio
- **AND** plan or generation feedback exposes the effective size
- **AND** the effective size is stored on the item for later retry and review

#### Scenario: One mixed-parameter item fails
- **WHEN** one item in a Creation set fails while another item completes
- **THEN** the completed item remains saved with its own effective parameters
- **AND** the set remains repairable without recalculating successful or failed items from current form values

### Requirement: Creation plans are frozen in queues and records
The system SHALL snapshot the complete effective universal plan when a new Creation set is queued and SHALL persist its strategy version, universal profile metadata, set overrides, count semantics, and per-item effective planning fields. Legacy marketplace metadata SHALL remain readable and frozen on saved records. `carouselImageCount` and compatibility field `imageCount` SHALL count enabled carousel slots, `skuImageCount` SHALL count deduplicated appended SKU items, `infographicRebuildCount` SHALL count rebuild additions, and `totalPlannedItemCount` SHALL equal their sum. Repair and retry SHALL use the saved effective item plan unless the user explicitly requests re-planning.

#### Scenario: Plan exposes unambiguous final counts
- **WHEN** a resolved plan contains carousel slots, appended SKU items, or infographic rebuild items
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
- **WHEN** the user submits a set and then edits category, supported overrides, ratio, size, language, or compatible slot enablement while it is waiting
- **THEN** the queued set starts with the frozen plan that existed at submission time

#### Scenario: New record is reopened or repaired
- **WHEN** a saved set contains platform strategy metadata and per-item effective parameters
- **THEN** the record view and reuse flow restore those effective values
- **AND** item retry or completion uses the saved image type, role, ratio, size, language, constraints, and prompt
- **AND** a later bundled strategy version does not silently alter the saved set

#### Scenario: Legacy record lacks platform strategy fields
- **WHEN** a Creation manifest predates `strategyVersion`, `imageType`, set overrides, or per-item parameters
- **THEN** the reader continues to display and repair it using saved roles, prompts, paths, and available set-level values
- **AND** it does not automatically apply the current universal profile or rewrite the manifest
- **AND** it records `platformProvenance` as `legacy-missing` before applying a display fallback
- **AND** an explicit saved `platform=universal` remains distinguishable as `platformProvenance=explicit`

#### Scenario: User explicitly replans a saved set
- **WHEN** the user selects Re-plan on a saved or reused set
- **THEN** the system resolves a new preview using the current universal profile
- **AND** it does not replace the saved plan until the user confirms and submits the new plan

### Requirement: Universal planning degrades without fabricating evidence
The system SHALL omit or replace image types that require unavailable factual evidence and SHALL surface policy-loading and validation failures before generation. It SHALL NOT fill missing dimensions, materials, package contents, condition, defects, prices, certifications, sales, rankings, guarantees, reviews, or performance claims with invented content.

#### Scenario: Evidence-dependent slot has no evidence
- **WHEN** a condition, defect, dimension, material, package, comparison, certification, or performance slot lacks supporting product input or applied reference evidence
- **THEN** the resolver omits or replaces that slot with an evidence-grounded product-detail or usage slot allowed by the universal profile
- **AND** the plan warning explains the missing evidence

#### Scenario: Browser policy module cannot load
- **WHEN** the browser cannot load the canonical universal policy module
- **THEN** the UI preserves all entered product and asset state
- **AND** it reports that automatic planning is unavailable
- **AND** it does not silently display or submit a plan built from stale duplicated defaults

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

#### Scenario: AI 套图沿用默认双单位规则

- **WHEN** 用户未单独选择单位模式，AI 套图的参数图、尺寸图或场景角标使用已确认的 `14.5 cm` 和 `35.8 g`
- **THEN** 规划请求明确传入默认 `dimensionUnitMode: both`，并提供 `14.5 cm (5.71 in)` 和 `35.8 g (1.26 oz)` 的换算文本
- **AND** 最终生成提示词要求每个新增测量标签同时显示公制值与英制值，换算保留本图事实的字段标签、所属款式与条件
- **AND** 换算副本不作为额外规格事实，不把其他图片或款式的测量值带入本图

#### Scenario: 单单位选择、无文字图和冻结计划保持原有边界

- **WHEN** 用户明确选择 `metric` 或 `imperial`，或图片属于无文字渲染、用户锁定内容或已冻结计划
- **THEN** 新规划遵循用户选择的单位模式，无文字图片不因单位规则新增标注，实物原有印字保持原样
- **AND** 用户锁定或已冻结的提示词保持逐字一致，重复校验不重复追加单位约束

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
The system SHALL let Creation reference analysis return a normalized `audienceStrategy` containing a product-use or purchase-context audience, purchase motivations, purchase objections, desired outcome, evidence basis, confidence, and source. The analysis MUST use only supplied product facts, visible product/use evidence, universal ecommerce context, and category context, and MUST NOT infer protected or sensitive personal attributes from people in reference images.

#### Scenario: Analysis returns evidence-backed audience guidance
- **WHEN** the user analyzes product references with a category and supplied product facts
- **THEN** the response includes a normalized audience strategy whose motivations and objections cite supplied or visible evidence and whose source and confidence are explicit

#### Scenario: Sensitive attributes are not inferred
- **WHEN** a reference image contains a person but the user did not explicitly provide demographic targeting
- **THEN** the analysis does not infer age, sex, gender identity, race, ethnicity, nationality, religion, health, disability, pregnancy, sexual orientation, income, or other sensitive attributes and falls back to a non-sensitive product-use context

#### Scenario: Uncertain audience stays conservative
- **WHEN** the product facts and references do not support a specific usage or buying context
- **THEN** the analysis returns a generic category buyer suggestion with low confidence instead of inventing a precise persona

### Requirement: Versioned universal marketing context
The system SHALL define a structured `marketingContext` for the universal profile, including shopper intent, proof style, copy style, default motivations, and default objections. Marketing context MUST remain advisory and MUST NOT be represented as an official marketplace rule.

#### Scenario: Universal profile has structured marketing context
- **WHEN** the Creation policy registry is loaded
- **THEN** the universal profile exposes valid structured marketing context

#### Scenario: Universal advice does not become a hard rule
- **WHEN** universal marketing context has no blocking source
- **THEN** it affects planning guidance only and does not create a blocking validation constraint

### Requirement: Deterministic audience strategy resolution
The system SHALL resolve `effectiveAudienceStrategy` using `universal marketing context < category context < reference-analysis suggestion < user set input < user item override`. Empty values MUST NOT erase lower-priority evidence, list fields MUST be normalized and de-duplicated, and the resolved result MUST record provenance.

#### Scenario: Reference analysis overrides universal fallback
- **WHEN** the universal default describes general shoppers and an applied reference analysis provides evidence for a gift-buying context
- **THEN** the effective strategy uses the evidence-backed gift context while retaining compatible universal proof and copy guidance

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
- **WHEN** Local resolves the universal profile, category, audience strategy, overrides, and product evidence
- **THEN** it produces a deterministic effective audience strategy and per-item conversion intents in the same order

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

### Requirement: Preserved blocking rules override conversion strategy
The system MUST apply official sourced blocking constraints and effective `textPolicy`, `logoPolicy`, and `scenePolicy` after all audience, conversion, set, item, and prompt overrides. A strict main image MUST NOT gain text, collage, external Logo, scene props, or unsupported claims from conversion guidance.

#### Scenario: Preserved strict main image remains strict
- **WHEN** a preserved legacy plan has a persuasive audience strategy and a sourced strict main-image slot
- **THEN** the main image retains its saved no-text, no-collage, Logo, scene, and evidence constraints while later eligible images may use conversion guidance

#### Scenario: Invalid item override remains blocked
- **WHEN** a per-item conversion or prompt override conflicts with a sourced blocking constraint
- **THEN** validation reports the conflict and generation is rejected

### Requirement: Audience strategy is part of the frozen effective plan
The system SHALL include original `audienceStrategy`, resolved `effectiveAudienceStrategy`, and every item's `conversionIntent` and final prompt in the versioned `effectivePlan`. Queue snapshots, Local manifests, record reuse, and repair MUST preserve these values without recomputing them from current form or current universal defaults. A source-only `infographic-rebuild` SHALL preserve compatible metadata but MUST execute the canonical reconstruction prompt at generation and repair time instead of a decorated historical saved prompt.

#### Scenario: Queue submission freezes audience decisions
- **WHEN** a user previews a plan, submits it to the queue, and then changes category, product fields, or reference analysis
- **THEN** the queued job retains the submitted audience strategy, item conversion intents, order, parameters, and prompts

#### Scenario: Saved set round-trips conversion fields
- **WHEN** a completed Local set is saved and loaded
- **THEN** its effective plan and item conversion fields are deeply equivalent to the submitted frozen values

#### Scenario: Repair reuses saved item intent
- **WHEN** a saved item is retried or repaired after current strategy defaults change
- **THEN** repair reuses the saved conversion intent, eligible item prompt, ratio, size, language, and any preserved legacy constraints unless the user explicitly edits that item
- **AND** an `infographic-rebuild` executes its canonical source-only prompt while retaining the saved compatible metadata and technical parameters

### Requirement: Generation submits and validates the frozen plan
The browser SHALL submit the complete frozen `effectivePlan` for formal Creation generation. Local SHALL prefer a valid submitted snapshot over replanning, SHALL limit snapshot byte size and item count, SHALL normalize required fields, and SHALL recompute counts and validation from snapshot items without trusting client-supplied `canGenerate`, validation, or count fields.

#### Scenario: Formal generation uses previewed items
- **WHEN** a valid frozen plan is submitted after preview
- **THEN** Local executes the submitted item order, eligible saved prompts, conversion intents, ratios, sizes, and languages without calling the current universal strategy to rebuild them
- **AND** any `infographic-rebuild` executes the canonical source-only reconstruction prompt instead of a decorated submitted prompt

#### Scenario: Client cannot bypass hard-rule validation
- **WHEN** a submitted snapshot declares `canGenerate=true` but an item violates a sourced platform constraint
- **THEN** the server recomputes validation, rejects generation, and does not trust the client declaration

#### Scenario: Oversized or malformed snapshot is rejected
- **WHEN** a submitted snapshot exceeds the allowed byte or item limit or lacks required item identifiers, prompts, or generation parameters
- **THEN** Local rejects the request with a compact validation error before image generation

#### Scenario: Legacy request replans
- **WHEN** an older client submits a generation request without `effectivePlan`
- **THEN** Local continues to build and validate a plan from the legacy fields

### Requirement: Runtime and metadata boundaries remain compatible
The system SHALL keep the full audience structure inside the set-level effective plan, and old manifests without audience fields MUST remain readable and MUST NOT be rewritten solely to add fallback strategy fields.

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
- **THEN** Local generation and Local repair execute the canonical source-only reconstruction prompt instead
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

系统 SHALL 对本地服务新生成的套图图片使用 `编号-HHMM-名称.扩展名` 的文件名结构。编号 SHALL 位于四位时分时间之前，名称 SHALL 是该图片类型的可读标题或安全 SKU token，文件名 MUST NOT 再带随机短标识。非套图模式的文件名结构 SHALL 使用 `HHMM-名称.扩展名`。

#### Scenario: 生成或修复一张套图图片

- **WHEN** 用户首次生成、补齐或重生成一张套图图片
- **THEN** 文件名以该图片在套图中的编号开头
- **AND** 紧随编号之后的是四位时分时间
- **AND** 图片类型名称和扩展名仍保留在文件名中
- **AND** 文件名不含随机短标识

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

The system SHALL keep every resolved universal carousel slot addressable in `effectivePlan.slots` when a set-level image-count override is lower than the universal profile's compatible image-type count. The count override SHALL define the default enabled prefix without removing later compatible slots. `effectivePlan.items`, `carouselImageCount`, and actual generation SHALL continue to include only enabled carousel slots.

#### Scenario: Universal plan at five items still shows all 18 types

- **WHEN** the user sets the local template plan count to 5
- **THEN** `effectivePlan.slots` 和兼容图片类型区域保留全部 18 个通用电商原生类型
- **AND** 前 5 个默认槽位启用，其余 13 个槽位未启用
- **AND** 兼容图片类型计数显示 `5 / 18`
- **AND** `effectivePlan.items`、`carouselImageCount` 和实际生成只包含 5 个启用轮播项

#### Scenario: Zero and full counts use the same type catalog

- **WHEN** the user sets the local template count to 0, 1, or 18
- **THEN** 每种数量下兼容图片类型区域都显示相同的 18 个原生类型
- **AND** 启用项数量分别为 0、1 或 18
- **AND** 未启用类型不会进入生成请求

#### Scenario: User replaces a compatible image type at equal count

- **WHEN** the universal plan has 5 enabled types and the user disables one and enables the eighteenth type
- **THEN** 第 18 个类型保持可见且可以直接启用
- **AND** 最终 `effectivePlan.items` 和 `carouselImageCount` 仍为 5
- **AND** 实际生成包含新启用类型且不包含被取消类型

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
The Creation Mode primary generation action SHALL remain available for valid set submissions while another set is running, up to the configured queue limit. New suites SHALL start when one of at most two suite slots is free, subject to the frozen global image-request concurrency limit.

#### Scenario: User submits while another set is running
- **WHEN** a Creation Mode set is already running
- **AND** the user submits valid product inputs for another set
- **THEN** the button communicates the queue action
- **AND** the app stores a snapshot of that set's form data
- **AND** the queued set may start alongside the active set if a suite slot is free, otherwise it waits for a slot

### Requirement: Creation Mode keeps marketplace selection out of the user flow
Creation Mode SHALL NOT offer marketplace selection. New previews and generation submissions SHALL use the universal profile. Reference-analysis recommendations SHALL retain their separate explicit apply action, and stale analysis responses SHALL NOT overwrite newer category or product inputs.

#### Scenario: Reference analysis suggestions still require their existing apply action
- **WHEN** Creation reference analysis returns role, note, product, category, or SKU suggestions
- **THEN** the existing recommendation summary and Apply suggestions action remain available
- **AND** opening a new plan does not automatically apply or discard those suggestions except through existing freshness rules

#### Scenario: Preview and generation use the universal profile
- **WHEN** a new Creation plan is previewed or submitted for generation
- **THEN** the existing API platform field contains `universal`
- **AND** the resolver, planner, validation, queue, and persistence use the universal profile

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

### Requirement: 套图 SKU 项名称使用可靠颜色标签

Creation Mode SHALL 将新计划和本地队列中的 SKU 项命名为 `SKU image {序号} - {颜色名称}`，其中 `{颜色名称}` 来自与 SKU 图内颜色标签相同的可靠颜色解析和目标语言本地化规则。对于简体中文目标语言，同一完整商品主体内的多颜色名称 SHALL 在用户界面名称中压缩显示：除最后一个颜色词外，前面颜色词末尾的“色” SHALL 被省略，颜色词之间不加空格，例如 `red black blue` SHALL 显示为 `红黑蓝色`。英文颜色名称 SHALL 保持 `red black blue` 的空格形式不变。没有结构化 `colorNames` 或 `color_names` 数组时，同一 SKU 主体可靠解析出的多个颜色 SHALL 默认作为一个名称标签处理；只有明确的 `subjectUnitCount` 与可靠颜色数相等时，才 SHALL 视为多个完整主体并保留标签边界。一个完整商品主体内的多个颜色在 SKU 图内 SHALL 仍保持为一个以单个空格连接的完整标签。结构化数组中的多个标签 SHALL 表示分组 SKU 的多个完整主体，并按稳定主体顺序各自格式化后以 ` / ` 连接。系统 MUST NOT 从背景、阴影、高光、环境反射、源卡片覆盖文字或无法安全规范化的文本推测颜色。

名称中的中文压缩 SHALL 只作用于计划项和队列项的用户可见名称，不得改变 SKU 图内提示词标签。单个复合颜色如 `深蓝色`、`玫瑰金色` 或 `米白色` SHALL 保持完整，不得因没有多个独立颜色而去掉末尾“色”。

当没有可靠颜色标签时，系统 SHALL 使用 `SKU image {序号}`，MUST NOT 回退到原始 SKU 标题、ID、货号或参考文件名。新计划的 SKU `filenameToken` 和新生成图片文件名的名称部分 SHALL 只使用稳定 SKU 序号和可选的可靠颜色 token，MUST NOT 包含原始 SKU 标题、ID、货号或参考文件名。该名称变化 SHALL 不改变 SKU 项序号、排序、ID、生成提示词、Listing、导出字段、原始参考文件名、参考索引、图片关联或已持久化历史项。

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

### Requirement: Temu Excel 导出仅使用本地能力

`POST /api/creation/sets/export-temu-excel` SHALL be a Local-only endpoint. Local SHALL 使用本地 Creation manifest、受控输出文件和可持久化 manifest 缓存生成 XLSX，并 MUST NOT 返回空的假工作簿。

#### Scenario: 本地服务导出有效批次

- **WHEN** Local 接收通过输入与模板校验的导出请求
- **THEN** 它返回正确 XLSX MIME 和安全 attachment 文件名
- **AND** 工作簿包含模板数据行和导出问题 sheet
- **AND** 响应不被缓存

### Requirement: 现有单套文本与 JSON 导出保持不变

Temu Excel SHALL 使用独立按钮、表单、端点和文件名。现有当前套图提示词 TXT、manifest JSON 和 Listing JSON 导出的可用条件、目标记录、payload、文件名及内容 SHALL 保持不变。

#### Scenario: 用户继续使用现有导出

- **WHEN** 用户在当前详情记录上导出提示词、manifest 或 Listing
- **THEN** 浏览器继续调用原有导出实现并生成原有格式
- **AND** 当前勾选的 Temu 批次不改变该单套导出目标
- **AND** 不要求 Cloudinary 配置或 Temu 模板

### Requirement: Browser and queue preserve safe SKU filename tokens

For each newly planned or locally queued SKU image, the system SHALL create a `filenameToken` from only the stable SKU sequence and an optional reliable normalized color label. Browser normalization SHALL preserve this token through generation and repair submissions. Local filename builders SHALL use the preserved token before any display title fallback. The token and new output filename MUST NOT contain the raw SKU title, SKU ID, product part number, or reference filename. Association metadata and generation prompts SHALL remain unchanged.

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

### Requirement: 提示词生图预览加载动效具有液体重力反馈

提示词生图主预览在无结果且存在运行任务时 SHALL 保持现有阶段、并发数量、最多六个 orb、稳定任务槽位和节点复用契约，并 SHALL 以独立的液体主体、液面扰动、下坠细流和底部沉积层表现有重量的向下沉降、撞击摊平及黏滞回流。多任务场 SHALL 保持屏幕向下的重力方向，不得用整场持续旋转改变重力方向。视觉参数 SHALL 只影响动画时序和形变，不得被当作真实生成百分比。

#### Scenario: 单个提示词任务正在生成

- **WHEN** 主预览没有图片且当前任务处于 `uploading`、`connecting`、`generating` 或 `saving`
- **THEN** 液体主体从底部锚定并呈现阶段对应的有界高度
- **AND** 液面、细流和沉积层表现非对称的下坠、底部摊平和缓慢回流
- **AND** 运动不只是对称的上下漂浮

#### Scenario: 多个提示词任务同时运行

- **WHEN** 主预览同时展示两个或更多运行任务
- **THEN** orb 继续遵守现有碰撞安全间距和稳定任务 ID 槽位
- **AND** 每个 orb 内部液体的向下方向保持与屏幕一致
- **AND** 外环可以独立旋转或轻微漂移，但不带动液体改变重力方向

#### Scenario: 用户启用减少动态效果

- **WHEN** `prefers-reduced-motion: reduce` 生效
- **THEN** 液面、细流、沉积、重力回弹、外环和多任务场动画均停止
- **AND** 预览保留静态的底部锚定液体形态、任务状态和可访问名称

### Requirement: 提示词生图预览液体细流循环保持连续

提示词生图主预览在持续加载时 SHALL 让液体细流以错相轨道连续循环，任一循环边界都不得让所有细流同时消失或瞬间回到可见区域。错相偏移 SHALL 与当前阶段的流动时长绑定，并保持在有界的视觉参数范围内。

#### Scenario: 细流经过循环边界

- **WHEN** 任一细流从容器外入口位置开始新的循环
- **THEN** 至少另一条细流仍处于可见的下落、撞击或回流阶段
- **AND** 用户不会看到整段细流突然消失后又突然出现

#### Scenario: 用户启用减少动态效果

- **WHEN** `prefers-reduced-motion: reduce` 生效
- **THEN** 两条细流均停止动画
- **AND** 预览保留静态的底部锚定液体形态、任务状态和可访问名称

### Requirement: 提示词模式参考图预览保留参数上下文

提示词模式打开参考图预览时 SHALL 保持参考图主体清晰，并以轻量遮罩保留后方工作台参数区域的可辨认上下文。遮罩不得完全不透明或使用足以让参数标题、字段和值无法辨认的模糊效果；该行为仅作用于参考图预览，不改变其他图片查看器的遮罩。

#### Scenario: 用户查看参考图预览

- **WHEN** 用户在提示词模式点击参考图缩略图打开预览
- **THEN** 参考图主体保持清晰可辨
- **AND** 后方参数区域的标题、字段和值仍可辨认
- **AND** 关闭预览后参数区域和滚动位置保持原状

#### Scenario: 小视口查看参考图预览

- **WHEN** 用户在窄屏或移动视口打开参考图预览
- **THEN** 遮罩仍保留足够背景对比度以辨认参数区域
- **AND** 参考图预览控件不被背景内容遮挡

### Requirement: 用户可分别清空提示词模式输入

提示词模式 SHALL 在“参考图”和“提示词”标题旁提供独立清空操作。标题行图标控件在桌面布局 SHALL 与左侧标题文字高度对齐并使用一致的紧凑外框、圆角和交互反馈，清空控件 SHALL 使用线性垃圾箱图标，提示词模板控件 SHALL 使用 `⭐` 图标；在触控布局仍 SHALL 保留至少 44px 的点击区域。清空参考图 SHALL 只移除当前提示词模式参考图并重置文件输入；清空提示词 SHALL 只清除提示词文本并刷新计数与生成按钮状态。

#### Scenario: 清空参考图

- **WHEN** 用户点击参考图标题旁的清空按钮
- **THEN** 当前提示词模式参考图全部移除
- **AND** 参考图预览对象被释放、文件输入被重置
- **AND** 提示词文本保持不变

#### Scenario: 清空提示词

- **WHEN** 用户点击提示词标题旁的清空按钮
- **THEN** 提示词文本变为空并显示 `0 字`
- **AND** 当前参考图保持不变

#### Scenario: 标题行图标对齐

- **WHEN** 用户在桌面布局查看参考图或提示词标题行
- **THEN** 清空和提示词模板控件的外框高度与左侧标题文字视觉高度一致
- **AND** 清空控件显示线性垃圾箱图标，提示词模板控件显示 `⭐`
- **AND** 键盘焦点反馈与触控布局至少 44px 的点击区域保持可用

### Requirement: 当前结果可作为参考图

提示词模式 SHALL 在当前结果预览工具栏提供“添加到参考图”按钮。当前有可用图片时，点击按钮 SHALL 将其转换为有效图片文件并加入参考图，复用现有去重和数量上限；按钮 SHALL 通过悬浮说明和可访问名称说明也可以拖动图片到参考图区域。参考图和提示词清空按钮的悬浮说明 SHALL 保持稳定的可读宽度，在桌面和移动视口中横向显示或自然换行，不得逐字竖排，也不得被按钮或折叠面板裁剪。

#### Scenario: 点击添加当前结果

- **WHEN** 用户点击“添加到参考图”且当前预览存在图片
- **THEN** 当前图片追加到参考图列表
- **AND** 现有参考图顺序与内容保持不变
- **AND** 重复图片或超过上限时不新增并显示明确反馈

#### Scenario: 拖动当前结果到参考图

- **WHEN** 用户用鼠标拖动当前预览图片并放到参考图上传区或缩略图网格
- **THEN** 系统执行与点击按钮相同的添加、去重和上限检查
- **AND** 放置目标显示拖入状态

#### Scenario: 当前结果不可用

- **WHEN** 当前预览没有有效图片或浏览器无法读取图片
- **THEN** “添加到参考图”按钮不可用或操作无副作用
- **AND** 页面保留现有参考图状态

#### Scenario: 操作说明在窄视口中可读

- **WHEN** 用户在桌面或移动视口悬浮或键盘聚焦清空按钮、或“添加到参考图”按钮
- **THEN** 说明文字以稳定宽度横向显示并按需要换行
- **AND** 说明文字不被按钮、视口边界或参考图折叠面板裁剪

### Requirement: 提示词模式胶片条使用页面会话展示窗口

提示词模式胶片条首次成功载入 SHALL 只展示最近 10 张提示词模式历史图片，并把这 10 张作为当前页面会话的初始基线。当前页面提交的有效提示词生成任务 SHALL 只在其图片成功保存后加入该基线；系统 MUST NOT 为了填满窗口而加入基线之外、更早的历史图片。基线与当前页面成功结果 SHALL 按创建时间倒序组成最多 50 张历史缩略图的滚动窗口；超过 50 张时，排序最早的可见项 SHALL 被移出。运行中任务占位 SHALL 与历史图片窗口分开计数，并 SHALL 按提交时间倒序显示，最新请求位于左侧、较早请求依次向右；相同提交时间的任务 SHALL 保持队列顺序。任务状态更新 MUST NOT 改变其胶片条排序。基线、当前会话任务和结果窗口 MUST NOT 持久化，刷新或下一次载入 SHALL 恢复为最近 10 张提示词模式历史图片。

#### Scenario: 首次载入提示词模式

- **WHEN** 用户首次进入或重新载入提示词模式，且画廊中存在超过 10 张提示词模式图片
- **THEN** 胶片条按创建时间倒序展示最近 10 张提示词模式图片
- **AND** 非提示词模式图片不进入该窗口

#### Scenario: 当前页面继续生成

- **GIVEN** 当前页面胶片条已显示首次载入的 10 张基线图片
- **WHEN** 用户在当前页面提交的 5 个提示词生成任务均成功保存图片
- **THEN** 胶片条展示这 5 张当前会话结果和原有 10 张基线图片，共 15 张历史缩略图
- **AND** 基线之外、更早的历史图片不进入该窗口

#### Scenario: 当前会话超过总上限

- **GIVEN** 当前页面已有 10 张初始基线图片
- **WHEN** 当前页面成功保存的提示词结果与基线合计超过 50 张
- **THEN** 胶片条仅保留按创建时间倒序的最新 50 张受控候选图片
- **AND** 最早的基线图片或较早的当前会话结果按顺序移出窗口

#### Scenario: 运行中任务独立计数

- **WHEN** 当前页面正在运行最多 10 个提示词生成任务
- **THEN** 运行中任务占位显示在历史缩略图之外
- **AND** 占位不减少最多 50 张历史缩略图的展示数量

#### Scenario: 扩展窗口后重新载入

- **GIVEN** 当前页面的胶片条已包含当前会话成功结果
- **WHEN** 用户刷新页面或下一次载入应用
- **THEN** 胶片条恢复为只展示最近 10 张提示词模式历史图片

#### Scenario: 运行中请求按最新优先排列

- **GIVEN** 当前会话中存在多个运行中或排队中的提示词请求
- **WHEN** 胶片条首次渲染或因请求状态更新而重绘
- **THEN** 最新提交的请求位于最左侧，较早请求依次向右
- **AND** 相同提交时间的请求保持队列顺序
- **AND** 状态更新不改变请求的位置

### Requirement: 提示词模板面板避让参数区

提示词模式的 Prompt Kit 模板面板 SHALL 嵌入主预览内容区，打开时覆盖预览元信息和画布，并跟随内容区的实际尺寸与位置变化。面板 SHALL NOT 遮挡左侧参考图、提示词、开始生成、参数设置控件，或底部预览工具栏及胶片条；面板以外的操作 SHALL 保持可用。模板的选择、编辑、保存、插入、删除、关闭和已存储内容 SHALL 保持既有行为。面板内部 SHALL 按自身可用宽度调整布局，受限宽度 SHALL 使用可滚动内容并保持关闭、筛选、视图及模板编辑控件可达。

应用内带 `data-tooltip` 的操作控件 SHALL 使用共享提示浮层，在鼠标悬浮或键盘聚焦时显示完整帮助文本。该浮层 SHALL 位于浏览器 top layer 或等效的应用最高显示层，不得被参数面板、Prompt Kit、其他应用弹层、祖先滚动容器或裁剪边界遮挡；其位置 SHALL 受当前可视视口约束。提示文本遇到中文句号 `。` 或中文分号 `；` 时 SHALL 保留该标点，并从后续内容开始新行；末尾标点不得产生额外空白行。控件的可访问名称、焦点状态和原有命令 SHALL 保持可用。

#### Scenario: 桌面提示词模式打开模板面板

- **WHEN** 用户点击提示词模板入口
- **THEN** Prompt Kit 填满主预览内容区
- **AND** 左侧生图表单、底部预览工具栏及胶片条不被遮挡且可操作

#### Scenario: 窗口尺寸或缩放变化

- **WHEN** 模板库打开时窗口、页面缩放或工作台列宽变化
- **THEN** 模板库继续贴合主预览内容区，不溢出到左侧生图表单

#### Scenario: 受限视口打开模板面板

- **WHEN** 用户在受限宽度打开提示词模板面板
- **THEN** 面板保持在预览内容区，内部内容可滚动
- **AND** 关闭、分类、视图、模板应用及编辑表单保持可达

#### Scenario: 提示悬浮在应用最上层

- **WHEN** 用户悬浮或键盘聚焦提示词模式中带帮助文本的清空、模板或添加参考图控件
- **THEN** 完整提示文本显示在浏览器 top layer 或等效的应用最高显示层
- **AND** 提示不被参数面板、Prompt Kit、其他应用弹层或祖先裁剪边界遮挡
- **AND** 提示保持在当前可视视口以内且不改变控件的点击或键盘行为
- **AND** 文本中的中文句号 `。` 或中文分号 `；` 后续内容从新行开始，标点保留且末尾没有额外空白行

### Requirement: 上游静默间隔不得由 HTTP 客户端默认值决定

上游图片流在宣告渲染完成与真正下发图片数据之间可能静默数分钟。系统读取上游流时 SHALL NOT 让底层 HTTP 客户端的默认空闲上限先于应用自身的上游超时生效；读取上游图片流所用的空闲上限 SHALL 不低于应用配置的上游请求超时。静默间隔内 SHALL NOT 主动断开仍在推进的上游任务。无法调整底层客户端时 SHALL 退回默认行为而不是使请求失败。

#### Scenario: 上游在宣告完成后静默数分钟才下发图片

- **WHEN** 上游宣告图片渲染完成，随后静默超过底层 HTTP 客户端的默认空闲上限，才下发图片数据
- **THEN** 连接在该静默期间保持打开
- **AND** 图片到达后按正常成功路径交付
- **AND** 不因为该静默间隔进入回查或自动重试

#### Scenario: 上游静默超过应用自身的上游超时

- **WHEN** 上游静默时间超过应用配置的上游请求超时
- **THEN** 由应用自身的超时终止请求并给出应用的超时说明
- **AND** 用户可见信息不是底层客户端的连接终止原文

#### Scenario: 运行环境不支持调整底层客户端

- **WHEN** 运行环境无法调整底层 HTTP 客户端的空闲上限
- **THEN** 请求按该环境的默认行为继续执行
- **AND** 不因为无法调整而使请求失败

### Requirement: 完成信号不得早于图片交付

上游工具级的"渲染完成"事件 SHALL NOT 被当作本次生成的完成信号，除非该次生成已经取得图片数据。系统 SHALL 在交付图片之后才发出完成信号，使调用方的耗时统计覆盖到图片实际到达为止。上游的整体响应结束事件 SHALL 仍然按终止事件处理，即使此时没有图片，以便既有的回查与重试阶梯继续判定。

#### Scenario: 工具宣告渲染完成但图片尚未下发

- **WHEN** 上游发出工具级渲染完成事件，且此时尚未下发任何图片数据
- **THEN** 系统不发出完成信号
- **AND** 待图片实际到达后先交付图片再发出完成信号
- **AND** 调用方显示的生成耗时覆盖到图片到达为止

#### Scenario: 工具完成事件自身携带图片

- **WHEN** 上游的工具级完成事件本身就携带图片数据
- **THEN** 系统先交付该图片再发出完成信号

#### Scenario: 整体响应结束但没有图片

- **WHEN** 上游发出整体响应结束事件且全程没有图片数据
- **THEN** 该次读取仍按已终止处理
- **AND** 由既有的回查与自动重试阶梯判定后续行为

### Requirement: 上游流末截断按连接中断处理并保留回查阶梯

服务端消费上游 Responses 流时，流结束后残留的不完整缓冲解析失败 SHALL 按连接中断处理，SHALL NOT 把底层 JSON 解析错误原文作为用户可见错误。该中断 SHALL 保留此前已收到的最终图与全部中途图，并 SHALL 继续执行既有的原任务回查与一次自动重试阶梯，SHALL NOT 因为解析失败而跳过该阶梯。上游下发的完整事件本身格式非法时 SHALL 继续按解析失败处理，不得被中断提示掩盖。

#### Scenario: 上游在一个大事件传输中途断开

- **WHEN** 上游流在某个事件传输过程中断开，留下不完整的残留缓冲
- **THEN** 服务端按连接中断处理该残留缓冲，不抛出 JSON 解析错误原文
- **AND** 已收到的最终图与中途图被保留
- **AND** 系统继续回查原任务结果并在需要时执行一次自动重试
- **AND** 用户可见错误不包含 JSON 语法错误原文

#### Scenario: 截断发生时已经拿到最终图

- **WHEN** 上游已下发完整最终图，随后流在尾部事件中途断开
- **THEN** 该次生成按成功处理并使用已收到的最终图
- **AND** 不因为尾部截断而报错

#### Scenario: 上游下发完整但格式非法的事件

- **WHEN** 上游下发了一个完整但格式非法的事件
- **THEN** 该解析失败按原有错误路径抛出
- **AND** 不被连接中断提示替换

### Requirement: 上游结果无法确认时中途图作为该套图项结果落盘

套图某条目在上游无法确认最终结果、且该任务已收到过至少一张中途图时，系统 SHALL 把最后一张中途图作为该条目的结果落盘。落盘元数据 SHALL 标记该图来源为中途预览兜底，卡片与活动记录 SHALL 标注该图未完全渲染，使其在正式产出中可追溯。该条目从未收到过任何中途图时 SHALL 保持现有报错与手动重试语义，SHALL NOT 落盘任何图片。

#### Scenario: 回查与自动重试都无法确认结果但已有中途图

- **WHEN** 套图某条目的上游回查与一次自动重试都未能确认最终图，且该任务已收到过中途图
- **THEN** 最后一张中途图作为该条目结果落盘
- **AND** 落盘元数据标记来源为中途预览兜底
- **AND** 卡片标注该图未完全渲染
- **AND** 该条目不再显示为失败

#### Scenario: 上游无法确认结果且从未收到中途图

- **WHEN** 套图某条目的上游结果无法确认，且该任务从未收到任何中途图
- **THEN** 该条目按失败处理并提示手动重试
- **AND** 不落盘任何图片

### Requirement: 套图中途预览分片下发

套图生成、套图补图和套图 Logo 批量路由 SHALL 以分片方式下发每个条目的中途预览，单个 SSE 事件携带的 base64 载荷 SHALL NOT 超过 48 KB。分片事件 SHALL 携带所属 `setId`、`itemId`、`index`、`total` 和 `mimeType`，使客户端能按条目独立装配。客户端 SHALL 在收齐某张中途预览的全部分片后更新该条目预览，且后续更清晰的中途预览 SHALL 替换先前的中途预览而不与其混合。套图 SHALL NOT 在单个 SSE 事件中下发完整中途预览数据。

#### Scenario: 一张中途预览分片到达

- **WHEN** 套图某个条目在生成过程中产生一张中途预览
- **THEN** 服务端按不超过 48 KB 的分片下发该预览
- **AND** 每个分片事件标明所属条目和分片序号、总数
- **AND** 客户端集齐全部分片后显示该中途预览
- **AND** 单个 SSE 事件不携带完整中途预览数据

#### Scenario: 同一条目连续产生多张中途预览

- **WHEN** 同一个套图条目先后产生多张中途预览
- **THEN** 后一张预览集齐分片后整体替换前一张
- **AND** 两张预览的分片数据不相互混合

#### Scenario: 一张中途预览只收到部分分片

- **WHEN** 某张中途预览只收到部分分片，随后该条目产生新预览或结束
- **THEN** 不展示由不完整数据拼成的中途预览
- **AND** 该条目已展示的上一张预览不被清除

### Requirement: 合并服务端套图清单不清除本地已有预览

客户端用服务端套图清单更新本地状态时，清单中某条目没有可用图片资产时 SHALL 保留该条目本地已有的预览地址，SHALL NOT 因为整套替换而清除已经展示过的中途预览。自动补图重新进入生成态时 SHALL 保留上一轮预览直到该条目的新图到达。

#### Scenario: 条目失败时服务端清单不含该条目图片

- **WHEN** 某个套图条目失败，服务端随失败事件下发的清单中该条目没有图片资产
- **THEN** 该条目本地已展示的中途预览继续保留
- **AND** 页面同时显示该条目的失败原因

#### Scenario: 自动补图重新生成已有预览的条目

- **WHEN** 整套生成结束后自动补图重新生成某个已展示过预览的条目
- **THEN** 该条目在新图到达前继续显示上一轮预览
- **AND** 页面说明该条目正在补图而非首次生成

#### Scenario: 服务端清单带来该条目的正式成图

- **WHEN** 服务端清单中某条目携带已落盘的正式图片资产
- **THEN** 该条目预览更新为正式成图
- **AND** 不再保留此前的中途预览

### Requirement: 套图生图提示词避免冗余上下文

普通 Creation 轮播图与 SKU 项的模型提示词 SHALL 使用简洁、可执行的控制文字。系统生成的角色、通用电商、类别、视觉风格和比例描述 SHALL 使用简洁英文或省略无动作含义的默认显示标签；Creation Mode 比例提示 SHALL 只说明所选比例值，不包含用途标签或冗长构图解释。用户提供的商品事实与参考图备注 SHALL 保持原文。

规划提示词与运行时组装 SHALL 不重复表达商品身份锁、商品表面内容保护或新增画布文案语言边界。运行时仍 SHALL 为缺少必要保护的历史冻结提示词补上相应约束。参考图标签 SHALL 标识所附图片与角色，并保留分配给该角色的必要说明；主体身份说明 SHALL 不以多段近义文字重复出现，支撑参考图 SHALL 只贡献其分配角色的证据。

精简 SHALL 通过删除重复或仅复述界面设置的文字完成，不得设置提示词字符数上限，也不得按总长度截断提示词。精简 SHALL 保留商品事实、画面角色、保留的历史硬约束、参考图归属、主体身份与表面内容保护及目标语言边界。infographic-rebuild SHALL 继续使用其独立来源事实与翻译规则。

新增文案的目标语言规则 SHALL 只作用于新创作的画布文案。商品或包装本体上已有的图案、标记、表面文字和字符 SHALL 保持原样；角色、构图、场景和保留的历史约束 SHALL 不因措辞精简而改变其画面含义。

#### Scenario: 英语通用首图只传递比例值

- **WHEN** Creation Mode 以英语目标语言、1:1 比例和 1K 分辨率生成通用首图
- **THEN** 比例提示只包含 Aspect ratio: 1:1. 等简短比例值说明
- **AND** 提示词不包含比例用途、中文 UI 名称或重复的构图解释
- **AND** 规划和运行时不会重复添加主体身份、表面内容保护或目标语言边界

#### Scenario: 商品事实含有中文

- **WHEN** 用户输入的商品名称、描述、卖点或参考图备注包含中文
- **THEN** 系统保留这些用户提供的原文，不猜测翻译或删除商品事实
- **AND** 系统生成的角色、通用电商、类别、视觉风格和比例控制文字使用简洁英文或省略默认标签

#### Scenario: 商品主体约束只表达一次

- **WHEN** 生成普通轮播图或 SKU 项
- **THEN** 最终提示词清楚保留商品身份、商品表面内容和目标语言边界
- **AND** 规划提示词与运行时拼接不重复附加近义保护段落
- **AND** 每张参考图标签仍能确定该图的角色和必要来源证据，且不重复主提示词已有的主体身份规则
- **AND** 辅助参考图不能覆盖主体锚点身份

#### Scenario: 历史提示词补齐缺失约束

- **WHEN** 运行时执行缺少主体内容或目标语言保护的历史冻结提示词
- **THEN** 运行时仍补齐缺失的必要约束
- **AND** 已含相同语义的提示词不会再收到重复保护段落

#### Scenario: 信息图重构保持独立

- **WHEN** 生成 infographic-rebuild 项
- **THEN** 系统继续使用该模式的来源事实和翻译提示词
- **AND** 普通轮播图与 SKU 的提示词压缩规则不会移除其必要的来源保真或翻译约束

### Requirement: Creation Mode uses one product information field

Creation Mode SHALL present one 商品描述 textarea for product description, selling points, and size specifications. The textarea SHALL retain the existing product-description height and placeholder, and controls below it SHALL follow the normal document flow. New plans SHALL use the complete textarea value as product description and SHALL continue extracting supported measurements from that value for dimension and specification roles. Reusing a historical set SHALL place its saved product description, selling points, and dimension specifications in the textarea without losing non-empty values.

#### Scenario: User enters combined product information

- **WHEN** the user submits a product description containing product facts, selling points, or supported measurements
- **THEN** the complete text is used as product information for planning
- **AND** supported measurements continue to populate the planned dimension specifications

#### Scenario: User reuses a historical set

- **WHEN** the user reuses a set that has separate saved product description, selling points, or dimension specifications
- **THEN** each non-empty value appears in the single 商品描述 textarea
- **AND** the original saved set remains unchanged

### Requirement: 套图工作区结果预览展示复现信息

套图工作区 SHALL 在打开已生成结果图片时展示实际发送给上游图片请求的逐图提示词和已保存的请求参数快照。若旧记录没有实际生成提示词，界面 SHALL 回退显示该单张已保存的规划提示词。缺失的历史参数 SHALL 显示“未记录”，不得使用当前全局配置推测。Creation 灯箱 SHALL 提供复制当前提示词的操作。

#### Scenario: 用户查看套图结果图片

- **WHEN** 用户在套图工作区打开一张已生成的结果图片
- **THEN** 灯箱显示该图片的实际生成提示词和已保存的逐图请求参数
- **AND** 用户可以复制灯箱中显示的提示词
- **AND** 缺失的历史参数显示“未记录”而不是当前配置值

#### Scenario: 用户查看 Logo 批处理图片

- **WHEN** 用户在套图工作区的 Logo 批处理分支打开一张结果图片
- **THEN** 图片继续使用纯图片预览

### Requirement: Universal sets favor scene-fit images over overlapping information images

通用电商自动套图 SHALL 按可用事实平衡场景、信息解释、产品视角和细节任务。`scene-fit-1`、`scene-fit-2`、`scene-fit-3` SHALL 保留为兼容图型，但 MUST NOT 无条件占用三张场景任务；独立用途不足时，规划器 SHALL 使用有来源的其他信息任务，或明确显示缺口，不循环同一场景凑图。替换项 SHALL 使用实际图型、角色和标题，并维持槽位身份的稳定对位。用户显式选择的图型、逐图提示词及平台硬约束 SHALL 优先，旧冻结计划 SHALL 保持原样。

#### Scenario: Universal 18-image set uses scene-fit slots

- **WHEN** 用户根据有效商品分析预览 18 张通用自动套图
- **THEN** 计划按不同的实际用途分配场景任务，并按依据安排独立信息图
- **AND** 三个兼容的 scene-fit 图型可以在没有独立用途时被其他有依据的任务替换或标记缺口

#### Scenario: Scene facts are distributed across scene-fit items

- **WHEN** 商品资料支持露营、车内与办公室三种不同的核心操作
- **THEN** 场景项分别分配不同操作，而非只换背景
- **AND** 如果三个地点仍是同一手机操作，则只使用该核心操作一次

#### Scenario: Legacy marketplace slots remain frozen

- **WHEN** a saved legacy plan contains marketplace-specific hard constraints or frozen slots
- **THEN** current automatic task allocation does not rewrite those saved constraints or slots

#### Scenario: One scene reference does not repeat across lifestyle images

- **WHEN** 一张场景参考只证明一种核心操作
- **THEN** 自动方案不把它循环用于多个完整的同类操作画面
- **AND** 其他图只使用自己分配的事实，不复制整张场景的构图与全部备注

#### Scenario: 三个手机近义候选不成为三种用途

- **WHEN** 候选包含通勤查看手机、查看手机地图和拍摄间隙点按手机屏幕
- **THEN** 自动方案将它们视为同一核心操作组
- **AND** 该组只作为一张普通轮播图的主要动作，其余自动位置改用有依据的不同任务或显示缺口

#### Scenario: 手动选择保留

- **WHEN** 用户明确选定多个场景图或填写逐图提示词
- **THEN** 系统保留用户选择与内容
- **AND** 显示重复操作或信息覆盖不足的提示，不静默替换

### Requirement: Creation set items use distinct visual formats, casts, and reference sources

普通轮播图 SHALL 明确本图的可见任务与表达形式。具有有效商品事实分析的自动方案 SHALL 按不同信息任务和核心操作区分画面；同一套可以保持统一摄影风格，但 MUST NOT 只换标题、背景或镜头来重复同一任务。信息图 MAY 用于功能、参数、尺寸和卖点等有来源的解释；功能图 MUST NOT 因模板强制而虚构内部结构或爆炸剖面。人物 SHALL 只服务真实动作或穿戴尺度，不强制年龄、性别和正脸。辅助参考 SHALL 按本图分配的事实选择，其备注 MUST NOT 重新引入未分配的卖点或辅助商品外观。未分析的兼容调用与历史冻结记录 SHALL 继续可用。

#### Scenario: Universal set declares distinct formats

- **WHEN** 规划器根据有效商品分析生成通用套图
- **THEN** 每个非手动、可生成的任务明确自身的表达形式
- **AND** 信息任务与核心操作分工明确，不依靠提示词同义改写判断多样性

#### Scenario: People differ across person-led images

- **WHEN** 套图包含多个需要人物参与的动作
- **THEN** 人物与裁切服务各自分配的核心操作
- **AND** 不固定要求年龄、性别、正脸或举物摆拍

#### Scenario: Supporting references are spread out

- **WHEN** 计划有多张功能、材质、使用、尺寸或包装参考
- **THEN** 每张轮播图仅选择其分配事实所需的辅助参考
- **AND** 同一参考可以提供不同事实，但未分配的完整备注不进入本图提示词

#### Scenario: 资料只支持外部功能

- **WHEN** 资料标注功能和电池参数，但没有内部构造证据
- **THEN** 功能信息图只使用完整外部产品、文字标注和连接关系
- **AND** 不因为旧功能渲染模板而生成拆开的电芯、内部层或加热组件

#### Scenario: 辅助图备注包含其他卖点

- **WHEN** 本图仅分配到一项功能，而对应参考图备注还包含其他步骤和参数
- **THEN** 生成请求只携带本图分配的辅助事实
- **AND** 不把完整旧备注重新追加到本图提示词

### Requirement: Creation set divergence stays anchored to the product

Every ordinary Creation carousel item that is not governed by a preserved legacy blocking policy SHALL instruct the image model to extend ideas from the product's own category, function, visible features, and likely buyer, SHALL require every added prop, person, setting, or line of text to serve that product's real use, and SHALL keep product features, accessories, and claims within the supplied facts.

#### Scenario: Universal item carries grounded creative range

- **WHEN** the planner builds a universal 18-image set
- **THEN** every carousel prompt contains the product-anchored creative range guidance

#### Scenario: Preserved legacy policy stays strict

- **WHEN** the planner rebuilds a preserved legacy slot with a sourced blocking policy
- **THEN** that prompt does not contain the creative range guidance

### Requirement: Creation prompts are free of internal planning labels and translated to the target language

Creation item prompts SHALL NOT contain internal planning metadata labels, including `Category template:`, `Ecommerce category path:`, a `Product category:` line naming a category code, `Scenario:` labels, and `Role focus:` or `Role category focus:` labels. Selected category and scenario values SHALL remain available in the plan parameters. For a fourth-level category template, each role SHALL contribute only its most specific category guidance once.

The dimension and size-capacity image SHALL render only the listed specification values as canvas labels; other wording printed on the reference images SHALL stay off that canvas.

When a Creation set is submitted for generation and an item's target language is not Chinese, the system SHALL translate the Chinese segments of that item's prompt into the target language with the configured text model in one request per language before generation. Infographic rebuild items and Chinese-target items SHALL keep their prompts unchanged. When no text model is configured or translation fails, generation SHALL continue with the original prompts and the client SHALL show a translation warning.

#### Scenario: Category template metadata stays out of prompts

- **WHEN** the user plans a set with a fourth-level category template
- **THEN** no item prompt contains the category template name label, the category path label, the category code, or a role category focus label
- **AND** each role prompt still contains that role's category-specific visual guidance

#### Scenario: Scenario labels stay out of prompts

- **WHEN** the user plans a set for any marketing scenario
- **THEN** no item prompt contains a `Scenario:` label

#### Scenario: English set translates Chinese prompt segments at generation

- **WHEN** the user submits an English-target set whose prompts contain Chinese product name, description, selling points, or reference notes
- **THEN** the server sends one translation request to the configured text model
- **AND** generation uses prompts with those segments replaced by English translations

#### Scenario: Translation is unavailable

- **WHEN** the user submits an English-target set with Chinese prompt segments and no text model is configured or the translation request fails
- **THEN** generation continues with the original prompts
- **AND** the client shows a prompt translation warning

### Requirement: 套图参考图按可售单位计数

套图参考图分析 SHALL 以可售单位而不是可见件数计数 `subject_unit_count`。对成对售卖的左右套装（手套、鞋、袜、拖鞋、耳环、耳机、护腕、护膝、滑雪杖等），当图像或说明中存在成对表述（一双、一对、成对、左右各一只、a pair of）时，左右两只合起来 SHALL 计为 1 个完整产品单位。

彼此独立可单卖的重复商品（例如上下或左右并列的路亚、鱼饵）SHALL 继续按件计数，不得因为并列或成组出现在同一张图里就合并为 1 个单位。

成对商品的双数有明确写法时（例如"两双""2 pairs"）SHALL 直接采用该双数；只有件数时 SHALL 按件数折算为双数。缺少成对表述时，计数逻辑 SHALL 与既有实现一致，不得自行折算。

#### Scenario: 一双手套计为 1 个完整产品单位

- **WHEN** 一张白底商品主体图展示左右两只黑色加热手套，说明写明"两只手套组成一双"
- **THEN** 该参考图与对应 SKU 主体的 `subject_unit_count` 为 `1`
- **AND** 角色说明不再出现"2 个完整产品单位"

#### Scenario: 两个独立单卖的路亚仍为 2 个单位

- **WHEN** 一张白底商品主体图上下并列展示两个可单独售卖的路亚，说明写明"two complete visible lure bodies"
- **THEN** 该主体的 `subject_unit_count` 为 `2`
- **AND** 角色说明写明"2 个完整产品单位"

#### Scenario: 两双手套计为 2 个完整产品单位

- **WHEN** 一张商品主体图展示四只手套，说明写明"四只手套组成两双"
- **THEN** 该主体的 `subject_unit_count` 为 `2`
- **AND** 角色说明按双计数

### Requirement: 成对主体的颜色标签与生成约束

成对商品计为 1 个单位时，`color_names` SHALL 只输出一条标签：左右同色合并为单色标签，左右异色合并为一条多色标签。该标签 SHALL 与既有"一个单位一条标签"的边界保持一致。

SKU 生成提示词 SHALL 为成对主体声明左右两只同图保留，不得拆分其中一只或复制出多余的一双。

#### Scenario: 一双黑色手套只输出一条颜色标签

- **WHEN** 参考图分析为一双左右同色的黑色手套返回两个单位颜色标签
- **THEN** 归一化后的 `color_names` 只有一条 `black`
- **AND** SKU 项颜色名称不出现重复的 `black black`

#### Scenario: 成对主体进入 SKU 生成提示词

- **WHEN** 一个 SKU 主体的 `subject_unit_count` 因成对口径为 `1`，且说明写明"两只手套组成一双"
- **THEN** 该 SKU 提示词包含左右两只同图保留的约束
- **AND** 提示词不把该主体描述为多个完整产品单位

### Requirement: Product insights distinguish evidence from creative inference

智能识别 SHALL 在同一次视觉请求中提供带参考来源的外观及商品事实、买点、痛点、使用场景、未知项和冲突项，MUST NOT 请求或生成独立的分析外观锁。使用场景 SHALL 作为创意建议，MUST NOT 自动转化为参数或性能承诺。没有来源的温度、档位、续航、材质成分、认证和防护等级 MUST NOT 进入画布文案。

同一商品不同参考图提供的可读事实 SHALL 作为互补信息保留。冲突 SHALL 仅指同一商品、同一属性、相同条件存在互斥值；新分析 SHALL 为冲突提供商品、属性、条件和值的可比较项。无法独立核实、信息分布在不同图片、属性不同、变体不同或操作条件不同 MUST NOT 单独成为排除事实的理由。无法确认的关联 SHALL 保留为非阻断待确认项，MUST NOT 由独立事实合成未提供的性能承诺。

#### Scenario: 手套用途分析不虚构性能

- **WHEN** 主图只清晰显示卡其手套、掌心纹理和手背控制器
- **THEN** 分析保留这些外观依据，并可以提出与用途相符的冬季通勤、摄影或垂钓场景
- **AND** 不从这些场景推断防水等级、续航、温度或加热档位

#### Scenario: 辅助资料有矛盾

- **WHEN** 同一商品同一条件的辅助图同时出现三档与五档说明
- **THEN** 分析把差异列为冲突并要求补充确认
- **AND** 不同时或随机把两种档位写入新图片

#### Scenario: 跨图参数补充

- **WHEN** 图1和图2标示3000mAh，图3标示45°C续航6小时，且没有相反的同属性信息
- **THEN** 分析和计划保留电池容量、温度和续航及其各自来源，不产生商品资料冲突警告
- **AND** 不要求每张图重复所有参数，也不从这些信息推算额外性能

#### Scenario: 不同条件的参数并存

- **WHEN** 资料分别标示45°C续航6小时和55°C续航3小时，或不同款式分别标示不同电池容量
- **THEN** 分析按条件或款式保留各自事实，不将差异视为同一属性在相同条件下的冲突

#### Scenario: 旧分析仅表示无法核实

- **WHEN** 旧分析因资料位于不同图片、对应关系无法独立核实而报告冲突，且没有明确的互斥值说明
- **THEN** 规范化将该提示保留为非阻断待确认项，并保留已识别的独立事实
- **AND** 旧分析中明确的真实矛盾继续排除相关宣称

### Requirement: User selected product identity remains authoritative

用户明确指定的主主体 SHALL 在识别应用、预览、队列、生成和补图中保持为最高优先级外观依据。辅助参考 MAY 提供可靠文字事实，MUST NOT 改写主体颜色、结构、手指开口/翻盖、控制器位置或可售单位数量。

#### Scenario: 识别不取消手动指定主主体

- **WHEN** 用户已指定主主体，随后执行智能识别
- **THEN** 应用识别结果后仍保留同一主主体
- **AND** 后续所有普通轮播图都附带该主体参考并明确其外观优先级

### Requirement: Evidence gates apply before billable image work

多 SKU 选择图 SHALL 要求至少两个不同且有来源的可售变体；尺寸图和参数图 SHALL 要求可解析的尺寸/规格数值。缺少依据的项 SHALL 标记为跳过，MUST NOT 进入生图、自动重试、补图或专属参考上传。服务端 SHALL 根据商品资料重新校验冻结计划。

#### Scenario: 单一手套 SKU

- **WHEN** 商品只有一个卡其 SKU，包括左右一双或同一 SKU 的多个视角
- **THEN** 多 SKU 选择图被跳过
- **AND** 不产生其他颜色、款式或上游生图请求

#### Scenario: 无尺寸资料

- **WHEN** 没有可解析的尺寸数值，或只写了均码、图片角色为尺寸
- **THEN** 尺寸图和参数图都被跳过
- **AND** 其他有依据的商品图正常生成

#### Scenario: 冻结计划不能绕过拦截

- **WHEN** 提交的冻结计划删除或改写 `evidenceBlocked`，而商品仍只有单 SKU 或无尺寸
- **THEN** 服务端重新恢复对应拦截
- **AND** 生成与补图均不调用被拦截项的上游生图

### Requirement: Scene allocation follows product use and avoids repeated portraits

套图 SHALL 将有区别的环境、核心动作、买点／痛点和镜头分配到场景项，并优先使用商品环境静物、局部使用动作和手部近景。同一交互对象的同一核心操作 SHALL 使用相同操作组；只换背景、手机应用、标题、镜头或准备前后 MUST NOT 被视为独立用途。候选耗尽后 MUST NOT 通过循环分配来补足场景图。系统 MUST NOT 为所有商品固定分配人物年龄、性别或多张举着商品的正脸照。每张提示词 SHALL 对应一项已分配任务及其事实集，保留统一商品身份。

#### Scenario: 手套场景各有用途

- **WHEN** 分析得到摄影操作、通勤握把与岸边垂钓等不同用途
- **THEN** 不同的核心操作分配给不同场景项
- **AND** 不只更换背景来重复同一模特举物动作

#### Scenario: 场景不足不循环

- **WHEN** 9 个自动位置可能使用场景，但只有 6 个候选且其中 3 个属于同一核心操作
- **THEN** 规划器不使用余数循环重复候选
- **AND** 不用“准备前／收纳后”加旧动作来伪造新的用途

#### Scenario: 共享事实仍可能支持不同动作

- **WHEN** 两种不同操作都引用同一个有来源的手部灵活性事实
- **THEN** 系统不只因为事实 ID 相同就认定两种动作重复
- **AND** 仍需分别核对交互对象、核心操作和真实用途

### Requirement: Product insights survive the creation lifecycle

商品分析及来源 SHALL 贯穿识别结果、计划预览、冻结快照、队列和保存记录。旧记录缺少分析字段时 SHALL 保持可读。参考图或商品资料变化后，旧分析 MUST NOT 静默作为新计划的事实依据。

#### Scenario: 参考图变化使分析失效

- **WHEN** 用户替换商品参考图或关键商品资料
- **THEN** 之前的分析标记失效且不用于新图提示词
- **AND** 用户能重新识别生成与当前资料对应的分析

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

### Requirement: Per-frame facts match the visual task

逐图提示词 SHALL 使用同一份整套分配中的任务、事实来源和表达形式。卖点总览 MAY 聚合多个有来源的不同卖点，MUST NOT 被固定的单买点取模分配削成一项；操作步骤版式 SHALL 要求有来源的步骤及顺序。事实与版式不匹配时 SHALL 选择适合该事实的形式或显示缺口，MUST NOT 借用其他模板重新引入未分配的信息。分配 SHALL 随预览、冻结计划、队列、保存和补图保持一致，旧记录仍可读取。

#### Scenario: 尺寸事实不变成充电步骤

- **WHEN** 本图分配的事实只有宽度、高度和尺码
- **THEN** 采用尺寸标注或参数表达
- **AND** 提示词不再要求充电端口、连接步骤或充电时长

#### Scenario: 卖点总览使用多项真实内容

- **WHEN** 本图是卖点总览且分析提供多个不同的可靠买点
- **THEN** 分配覆盖适量的不同买点及对应事实
- **AND** 每个信息模块有明确内容，不用同一个尺寸事实填满多个卖点位置

### Requirement: 分析师营销建议可见且参与套图生成

套图参考图智能识别 SHALL 在现有请求中返回与当前商品事实关联的营销建议。每条建议 SHALL 使用简体中文说明具体营销重点及适合的画面表达，并引用至少一个有效事实 ID。资料充分时 SHALL 提供 3–6 条不同建议；资料不足时 SHALL 根据实际依据减少数量，MUST NOT 编造性能、参数、配件、认证或使用效果来凑足建议。

套图记录详情 SHALL 在“分析师分析”区域独占一行展示“分析师提供建议内容：”，读取该记录或其冻结计划中实际保存的建议。普通轮播生图 SHALL 使用与本图任务和已分配事实匹配的建议及对应证据。建议 MUST NOT 覆盖商品身份、逐图事实边界、用户手动提示词和平台图型规则。

建议 SHALL 随商品洞察贯穿预览、冻结计划、队列、保存记录与补图。旧记录缺少建议时 SHALL 保持可读，并显示重新识别提示；系统 MUST NOT 从平台默认买家语境伪造已完成的营销分析，MUST NOT 自动改写历史提示词和图片。

#### Scenario: 分析师给出具体商品营销建议

- **WHEN** 参考图确认商品有腕部调节带，并提供可引用的事实 ID
- **THEN** 智能识别可建议用调节带操作近景表达穿戴细节，并将建议绑定到该事实
- **AND** 建议不推断未提供的保暖温度、续航或防水等级

#### Scenario: 展示与生图采用同一建议

- **WHEN** 用户应用有效分析并预览或生成套图
- **THEN** “分析师提供建议内容：”一行展示计划中实际保存的营销建议
- **AND** 匹配的普通轮播图提示词包含对应建议及已分配事实，而不是只有界面展示

#### Scenario: 建议服从逐图分工

- **WHEN** 套图包含调节带细节图、尺寸图、SKU 图以及独立信息图重构
- **THEN** 调节带营销建议可以进入对应的细节任务
- **AND** 不能把该建议及其额外事实强塞进仅有尺寸任务的图、SKU 白底图或只依源图的信息图重构

#### Scenario: 建议缺少有效依据

- **WHEN** 某条建议未引用有效事实，或仅引用已排除的真实冲突事实
- **THEN** 规范化排除该建议
- **AND** 该建议不出现在分析师内容或后续生图提示词中

#### Scenario: 查看没有建议的历史记录

- **WHEN** 用户查看缺少营销建议的旧记录
- **THEN** “分析师提供建议内容：”一行显示暂无营销建议及重新智能识别的提示
- **AND** 旧记录的图片、提示词与补图依据保持可读，不混入当前其他商品的分析

#### Scenario: 商品资料改变

- **WHEN** 用户更换参考图或修改使现有分析失效的商品资料
- **THEN** 营销建议随商品洞察一起失效
- **AND** 新计划不使用旧资料对应的建议

### Requirement: 电商视觉营销分析覆盖具体受众卖点与痛点

套图智能识别 SHALL 以电商视觉营销专家职责分析当前商品，提供结构化的主次受众分组、独立卖点、独立痛点及营销建议。受众 SHALL 描述具体使用或购买语境、核心需求、购买触发点和主要顾虑，而不是只返回“此类商品的买家”。资料充分时 SHALL 提供 3–6 个不同受众群体；卖点 SHALL 关联商品依据与买家价值，痛点 SHALL 描述具体使用或购买阻碍及有依据的回应。数量 SHALL 服从实际资料，不通过近义改写或虚构商品能力凑数。

分析区 SHALL 展示各个有效群体及其需求，同时保留卖点和痛点栏目。缺少内容时 SHALL 显示明确空态或资料缺口，MUST NOT 静默隐藏整栏或把平台默认内容当作实际分析。新分析 SHALL 兼容旧的买家摘要和商品洞察字段，并保留事实来源。

#### Scenario: 商品有多个具体需求群体

- **WHEN** 商品用途与资料支持多种不同的使用任务
- **THEN** 分析分别给出对应的主次受众群体、需求、动机和犹豫点
- **AND** 不把所有人合并成一个泛泛标签，也不以近义标签重复同一群体

#### Scenario: 卖点和痛点分别回答购买问题

- **WHEN** 资料支持某项商品功能或结构及其真实使用方式
- **THEN** 卖点说明该依据如何形成买家价值，痛点说明相关的具体困扰或购买阻碍
- **AND** 这些分析可以用于图片创作，但不能新增资料未提供的性能或参数

#### Scenario: 旧分析缺少痛点

- **WHEN** 用户查看没有痛点或受众分组的旧记录
- **THEN** 界面仍保留对应栏目并显示重新识别或补充资料提示
- **AND** 旧记录的图片与提示词保持可读

### Requirement: 可选 AI 整套营销提示词一次规划全部图片

套图 SHALL 提供默认开启且可记忆的“AI 整套营销提示词”开关。开启后 SHALL 由电商视觉营销专家在正常成功路径的一次规划请求中返回全部 N 条可直接用于生图的提示词，并提供每项的图片类型、营销目标、受众、卖点/痛点、营销建议和参考图分配。缺少有效分析时 SHALL 在同一次请求中按现有契约补齐商品分析与参考用途。系统 MUST NOT 为每张图单独发出一次提示词规划请求。

AI 模式普通营销轮播 SHALL 支持 1–20 张，并以独立 ID 标识同一图型下不同的营销任务，MUST NOT 被现有 18 个固定槽位裁剪。SKU 与独立源图重构 SHALL 保持现有单独计数和执行规则。开关关闭时 SHALL 使用原有本地规划，0 张普通轮播 MUST NOT 发起空的 AI 规划请求。

系统 SHALL 在图片生成前校验返回数量、ID、图型、非空提示词、策略与事实引用、参考图编号和商品主体绑定。对于商品分析已确认的主主体和事实来源，若模型仅漏写其参考编号，系统 SHALL 将对应的可信原始上传编号补入逐图分配，再执行字节预算校验。单项参考图 SHALL 不设固定八张数量上限。用户手动锁定的主体优先；否则主体索引 SHALL 在分析请求前确定，分析响应 MUST NOT 通过重排或修改辅助图角色悄然更换全套主体。MUST NOT 猜测未知来源、静默丢弃无效编号，或在补齐后超过字节预算。真正缺少来源或无效的结果 MUST NOT 进入图片生成。

营销规划响应 SHALL 包含有事实依据的 `suite_strategy` 和非空的顶层 `items`；已有有效分析时只返回这两个字段。正常合格初稿仍为一次整套请求；初稿存在质量问题时 MAY 按有界审核修复循环对指定条目追加最多两轮局部修复。系统 MUST NOT 将截断的整套对象解析为其内部的任意 JSON 子对象。首次响应缺少整套条目时，系统 MAY 对全套做一次携带完整规划 schema 和所需条目数量的重试；若重试仍不完整，SHALL 显示明确错误，MUST NOT 把它报告为成功的零条计划或发出图片请求。

预览 SHALL 使用户能够核对逐图营销任务、最终提示词和参考分配。生成、队列、保存和补图 SHALL 使用同一份冻结的最终提示词与参考分配。系统生成的 `PRODUCT FIDELITY` SHALL 在新预览最终提示词中只出现一次，不附加分析外观锁；同一有效计划提交生成时 MUST 保持提示词字节内容不变。已有有效预览、普通重试和补图 MUST NOT 自动重新规划整套提示词；输入发生相关变化后 SHALL 使新草稿计划失效，并拒绝陈旧响应覆盖当前结果。

#### Scenario: AI 遗漏主体和事实来源编号

- **WHEN** 20 条完整计划已引用有效商品事实，但部分条目的参考索引遗漏事实来源图或预先确定的主主体图
- **THEN** 系统将分析已确认的来源编号补入逐图参考分配并保留原始上传编号
- **AND** 相同参考分配进入预览与后续图片请求
- **AND** 超过八张的有效来源仍完整保留；若补齐会超过现有字节预算，系统明确拒绝，不静默删图

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

### Requirement: Creation Mode 图片使用按角色区分的信息层级

Creation Mode SHALL 根据分配给当前图片的商品和证据构建信息丰富的角色布局。首图 SHALL 请求一个占主导位置且与来源一致的商品、相关背景、在有依据时使用的两个至四个圆形使用场景小窗，以及由已提供的卖点、控制部件、材质或规格组成的紧凑底部功能区。卖点、功能、规格、尺寸、场景、包装、多角度和细节角色 SHALL 请求与其分配事实匹配的简洁辅助面板、标签、标注线或视图结构。所有视觉面板 SHALL 保持同一个商品身份，并且 SHALL 只使用分配给当前图片的事实。来源不支持某个面板或声明时，提示词 SHALL 留出该内容而不自行补充。

#### Scenario: 首图具备商品与证据层级

- **WHEN** 规划集合拥有商品参考图以及已确认的功能或场景证据
- **THEN** 首图提示词请求大尺寸商品主体、相关背景、圆形场景小窗和底部功能区
- **AND** 画面标签只使用选定语言中的已提供事实
- **AND** 每个小窗都展示同一个已提供商品

#### Scenario: 功能图和场景图使用信息化布局

- **WHEN** 当前角色拥有功能、卖点、规格、场景、包装、细节或产品视图证据
- **THEN** 提示词请求与角色匹配的面板、标签、标注线或视图，让分配事实易于比较
- **AND** 商品身份、部件数量和实体文字继续绑定到主商品来源
- **AND** 未确认事实和场景道具不会被当作商品功能或包装内物品

#### Scenario: 提示词压缩保留必要约束

- **WHEN** Creation Mode 组装一张规划图片的提示词
- **THEN** 重复的主体、场景、参考图或语言说明被合并
- **AND** 商品身份、来源事实、分配参考图、实体表面文字和目标语言要求仍保持明确
- **AND** 系统不会为了满足字符长度上限而截断事实

### Requirement: 配对商品的表面与位置锁定

套图智能识别 SHALL 将可售单位计数与可见表面分开表达。对已确认按双售卖的手套等配对商品，一双计为1个完整产品单位；每个画面位置的掌面、手背、侧面、开口、纹理、缝线、文字、控制器和按键 SHALL 绑定到其实际出现的表面。画面左/右、上/下只表示图像位置，MUST NOT 单独作为左手/右手或额外商品件数的证据。

#### Scenario: 一双手套同时展示掌面与手背

- **WHEN** 参考图画面左侧展示一只手套的掌面蜂窝纹理，画面右侧展示另一只手套的手背 HOT 字样、显示窗和按键
- **THEN** 识别说明保留一双手套为 1 个完整产品单位
- **AND** 识别说明分别记录左侧为掌面、右侧为手背及各自可见细节
- **AND** 生成约束禁止把掌面蜂窝纹理与手背HOT字样、显示窗和按键错误融合到同一可见表面，或复制到没有相应细节的另一表面

#### Scenario: 多角度只能使用已有表面

- **WHEN** 只有掌面和手背的清晰参考，缺少独立侧面或内部证据
- **THEN** 多角度图只使用已见视角与细节裁切
- **AND** 角色指令、视觉变体与图型元数据不强制补造四个视角或未知内部

### Requirement: 套图提示词使用分层事实预算

新套图计划 SHALL 按图片任务向每张提示词提供主参考图保真约束、本图任务和已分配事实。每张图 SHALL 保留本图所需的保真约束、事实、数值条件、平台边界和用户手写提示词，MUST NOT 额外注入分析外观锁；不得因字符长度而拒绝或截断已通过来源校验的 AI 营销提示词。模板首图、普通图及 SKU SHALL 完整保留已选提示词段落，去除空段和重复段落；MUST NOT 使用整条提示词字符压缩目标省略段落或产生长度超标警告。其它整套分析 MUST NOT 因为已被识别就重复注入每张图或附图标签。

#### Scenario: 长分析不淹没参考图保真约束

- **WHEN** 商品分析返回多个事实、场景、卖点和营销建议
- **THEN** 首图和普通图只携带与本图任务匹配的有限事实
- **AND** 每张提示词仍保留以主参考图为准的 `PRODUCT FIDELITY`
- **AND** 已选的保真约束、逐图事实、数值条件和辅助段落完整保留，仅合并重复段落

#### Scenario: 必需内容较长

- **WHEN** 保真约束或完整规格使 AI 营销提示词较长
- **THEN** 系统保留其完整内容，并继续执行来源、主体和图型校验
- **AND** 系统不得仅因字符长度拒绝该计划或截断未知语义

#### Scenario: 模板提示词超过旧字符目标

- **WHEN** 模板首图超过 1200 字符，或普通图及 SKU 超过 1000 字符
- **THEN** 系统保留已选的完整段落，包括购买理由和 SKU 系列一致性要求
- **AND** 新计划不产生 `creation-prompt-budget` 警告

#### Scenario: SKU外观不得串到另一款式

- **WHEN** 主主体是黑色手套，另一个有来源的SKU是红色手套
- **THEN** 每个SKU的保真约束只绑定自身参考图，不注入分析外观锁
- **AND** 红色SKU使用自身来源的外观说明，不复制黑色款的控制器或表面标识

#### Scenario: 已冻结记录保持兼容

- **WHEN** 新计划经过预览、冻结、保存和补图
- **THEN** 实际提示词和参考图保真约束保持一致
- **AND** 缺少新版本标记的旧冻结计划仍可读取，读取时不重写历史提示词

### Requirement: Batch generation fills missing Listing records

The suite records view SHALL provide a batch command that generates Listing only for records without existing Listing drafts. The command SHALL process records sequentially, skip records with existing drafts or an active Listing request, and continue after an individual failure. While the batch runs, record refresh, deletion, Temu export, and separate Listing generation SHALL be unavailable.

#### Scenario: Batch generation skips existing Listing

- **WHEN** the user activates batch Listing generation
- **THEN** records with one or more existing `listingDrafts` are skipped
- **AND** records without Listing are processed in sequence
- **AND** a failed record does not prevent later missing records from being attempted

#### Scenario: Record actions stay stable during batch generation

- **WHEN** a batch Listing operation is running
- **THEN** refreshing or deleting records, starting a Temu export, and starting another Listing generation are disabled
- **AND** completion reports the numbers of successful and failed records

### Requirement: Select all filtered Creation records

The Creation records view SHALL provide a select-all control that selects every record in the current complete filtered result set, including records beyond the current rendered page. Toggling the control off SHALL remove only matching filtered record IDs and preserve selections outside the current filter.

#### Scenario: Select all records across pages

- **WHEN** the user activates select all while the current filter matches more records than are currently rendered
- **THEN** every record matching the current search and time filters is selected
- **AND** matching records beyond the current page are included

#### Scenario: Clear only the current filtered selection

- **WHEN** every record in the current filtered result set is selected and the user activates the control again
- **THEN** the current filtered records are deselected
- **AND** selections outside the current filter remain selected

### Requirement: AI 营销图不受本地图型依据门槛拦截

AI 整套营销计划的普通轮播项 SHALL 在预览、冻结提交、直接生成及补图阶段跳过本地图型依据禁用规则。缺少本地识别的多款式、尺寸参数或包装清单 MUST NOT 导致这些营销项被禁用、跳过或使整套计划报错。系统 SHALL 清除营销项已有的依据禁用标记，并保留最终提示词与参考分配。此规则 SHALL 仅适用于 AI 营销普通轮播项；独立 SKU、源图重构和本地模板规划 SHALL 保持现有规则。

#### Scenario: 营销计划采用本地认为缺少依据的图型

- **WHEN** AI 返回完整营销计划，包含款式对比、尺寸适配、到手清单或规格图，但本地未识别对应数据
- **THEN** 预览仍返回这些营销项，且全部可生成
- **AND** 直接生成、冻结提交及补图不再按该图型依据规则拦截
- **AND** 提示词与参考分配保持一致

#### Scenario: 营销计划保留旧依据禁用标记

- **WHEN** 有效 AI 营销普通轮播项带有旧的依据禁用状态
- **THEN** 重新检查时清除其依据禁用标记并恢复启用
- **AND** 独立 SKU 和本地模板图仍遵循原有依据校验

### Requirement: Creation canvas text follows the selected target language
Creation Mode SHALL render newly authored text outside the supplied product or packaging only in the selected target language. Supplied facts, role titles, content-assignment titles, filenames, and reference annotations SHALL be translated before use as canvas text or omitted when they are internal metadata. Existing text physically present on the product or packaging SHALL remain unchanged in its original language. Stricter platform no-text constraints SHALL remain authoritative.

#### Scenario: English is selected with Chinese source facts and planning labels
- **WHEN** a Creation Mode item uses English and its assigned facts, task title, or reference notes contain Chinese
- **THEN** newly authored canvas text uses English only
- **AND** Chinese planning labels, filenames, and reference annotations are not copied onto the canvas
- **AND** physical Chinese product or packaging text remains unchanged

#### Scenario: Platform forbids added text
- **WHEN** a current or preserved legacy image type has a no-text policy
- **THEN** that image-type policy remains authoritative and no translated marketing labels are added

### Requirement: AI 营销规划在套图产物标题区展示真实进度

系统 SHALL 在“套图产物”标题区的“补齐未完成项”左侧提供可展开的 AI 营销规划状态入口，显示当前真实执行阶段和耗时。展开面板 SHALL 展示阶段事件与本次模型已明确返回的规划摘要。系统 MUST NOT 根据定时器伪造模型思考步骤、条目数量或百分比，MUST NOT 请求或展示模型私密思维链。

#### Scenario: 首包尚未返回

- **WHEN** AI 营销规划请求已经发出而模型尚未返回文本
- **THEN** 标题区显示等待模型和已等待时间
- **AND** 不声称受众分析、卖点提炼或逐图规划已经完成

#### Scenario: 查看规划依据

- **WHEN** 用户展开状态入口且本次响应已返回完整的商品分析或条目字段
- **THEN** 面板展示已返回的受众、卖点、痛点或逐图营销目标与参考编号
- **AND** 所有模型内容按普通文本安全渲染，未返回内容不以预写分析填充

#### Scenario: 标题区空间不足

- **WHEN** 用户在窄屏打开套图产物
- **THEN** 规划状态和补齐按钮可换行且可操作，展开面板不造成水平溢出
- **AND** 状态入口可通过键盘展开、收起并暴露展开状态

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

### Requirement: 规划进度保持接口兼容与任务隔离

套图预览接口 SHALL 在客户端显式请求事件流时提供规划进度与最终计划，并 SHALL 为默认调用保留既有 JSON 契约。直接生成 SHALL 通过现有生成流展示实际发生的营销规划。新增进度 MUST NOT 引入额外模型请求、逐图重复规划或冻结提示词变化。进度 SHALL 绑定当前预览请求版本或对应队列任务，陈旧事件 MUST NOT 覆盖另一商品或另一任务。

#### Scenario: 默认客户端读取预览

- **WHEN** 快速套图或既有客户端未请求事件流
- **THEN** 预览接口继续返回原有 JSON 结果及错误结构

#### Scenario: 直接生成需要先规划

- **WHEN** 用户直接生成且没有有效 AI 营销预览计划
- **THEN** 现有生成流先展示真实规划阶段，成功后再进入图片生成
- **AND** 正常成功路径仍仅调用一次整套提示词规划

#### Scenario: 生成复用预览或历史补图

- **WHEN** 用户使用有效冻结预览生成或对历史套图补图
- **THEN** 系统继续复用既有最终提示词和参考分配，不重新请求营销规划
- **AND** 不把复用过程伪装成新一轮模型分析

#### Scenario: 输入变化或切换队列任务

- **WHEN** 商品输入改变、用户开始新预览或切换所查看的队列任务
- **THEN** 进度面板仅显示对应请求或任务的状态
- **AND** 旧响应、旧条目计数与旧分析摘要不能覆盖当前商品

### Requirement: AI 营销规划隔离不可用条目并同步有效数量

系统 SHALL 在完整营销规划响应解析成功后独立校验每条任务。普通条目的事实失效、分析引用错误、无效或重复 ID／提示词／营销目标、空提示词或标题、图型错误、用户所选普通图型不匹配、参考图编号错误、单图参考数量或字节超限 SHALL 标记为条目错误并从生图计划移除。系统 SHALL 保留原始序号、可用的 ID／标题和原因，将请求范围内的被拒位置和未返回位置纳入现有最多两轮局部修复。修复 SHALL 复用服务端已确认分析，缺乏证据的方向 SHALL 重写为有依据的任务，MUST NOT 仅删除未知引用、替换事实 ID 或虚构证据来放行原有无依据画面。合格条目、选型、锁定内容和平台硬约束 SHALL 保留。修复仍未通过的条目 MUST NOT 排队、补图或计入未完成数量；失败条目 MUST NOT 占用有效条目的去重键，也 MUST NOT 任意裁剪依据图来绕过预算。

系统 SHALL 显示请求数、最终实际可用数和移除／缺少数量。完整 JSON 少条 SHALL 先修复未返回位置，再保留有效条目并标记剩余缺少数量；多条 SHALL 将原请求范围外的任务标记为超范围并移除，MUST NOT 为超范围位置补规划或生成。当前表单的“套图数量” SHALL 保持用户选择，不因资料不足、少返回或移除无效条目而自动减少；显式平台数量覆盖、普通轮播计数、有效总数、队列和保存记录 SHALL 与保留的启用任务一致。SKU 和源图重构 SHALL 继续独立计数。

#### Scenario: 第十三条事实失效
- **WHEN** 用户请求 18 条且模型完整返回 18 条，其中只有第 13 条引用失效事实
- **THEN** 系统保留其它 17 条，并局部请求修复第 13 条，成功时返回 18 条有效任务
- **AND** 最多两轮后仍失败时，第 13 条显示“缺失”及具体原因，实际可生成数量为 17
- **AND** 当前表单数量保持 18，不重新请求整套规划，不创建无效项的补图任务

#### Scenario: 无效条目不占用独立任务标识
- **WHEN** 被拒条目复用了其它有效条目的 ID
- **THEN** 系统使用不冲突的修复 ID 和原始位置修复被拒条目
- **AND** 保留已有有效条目的 ID、位置、提示词和参考分配

#### Scenario: 完整响应少条或多条
- **WHEN** 请求 18 条但完整响应仅返回 16 条，或返回 20 条
- **THEN** 少条时系统仅修复第 17、18 个位置，失败后显示剩余缺少数量
- **AND** 多条时系统标记并移除第 19、20 条，不为它们修复或生成

#### Scenario: 单图参考预算超限
- **WHEN** 只有一个普通条目所需的可信参考图超过单图数量或字节预算
- **THEN** 系统在现有局部修复预算内要求有据的替代任务，仍超限时移除该条目
- **AND** 不随意丢弃该条目的依据参考图来绕过预算，其余有效任务保持不变

#### Scenario: 独立追加任务不影响轮播减量
- **WHEN** 18 条普通轮播最终移除 1 条，同时存在启用的 2 条 SKU 和 1 条源图重构
- **THEN** 普通轮播数为 17、SKU 数为 2、重构数为 1、总数为 20

#### Scenario: 用户选择二十张但仅十五张有效
- **WHEN** 用户选择 20 张，局部修复结束后只有 15 条有效普通任务
- **THEN** 数量选择框保持 20，预览显示实际可生成 15 张及缺失原因
- **AND** 再次规划仍请求 20 张，确认生成仅提交这 15 条有效任务
- **AND** 加入队列不修改当前表单的数量选择

### Requirement: 部分可用计划保持冻结与进度一致

存在可用任务且未破坏整套硬约束时，规划 SHALL 以部分可用终态展示通过数量，并在对应图片框直接展示缺失及原因，MUST NOT 报告为整套失败。预览、冻结提交、服务端复验、队列、保存和补图 SHALL 保留相同的有效条目 ID、最终提示词、参考分配和问题诊断；原始位置 SHALL 可用于锁定／平台约束复验。实际任务减量 SHALL 保留用户的数量选择；冻结生成提交 SHALL 使用实际轮播数量匹配有效输入指纹，MUST NOT 导致刚确认的计划因所选数量与有效数量不同而失效，MUST NOT 触发额外规划请求。后续真实输入变更及陈旧响应隔离 SHALL 继续有效。

#### Scenario: 部分可用计划进入队列

- **WHEN** 18 条规划保留 17 条后，用户确认预览并加入队列
- **THEN** 队列和生图复验采用同一份 17 条冻结计划，进度分母与保存结果一致
- **AND** 17 条最终提示词与参考分配保持不变，不因数量调整要求重新规划

#### Scenario: 图片框直接展示缺失

- **WHEN** 本次规划移除了一个或多个条目
- **THEN** 状态入口显示部分可用，对应原始位置的图片框直接显示“缺失”、原标题及原因
- **AND** 诊断按普通文本渲染，展示框没有加载动画或重试按钮，不写入任务数组，不影响生图、补图或未完成计数
- **AND** 少返回的任务同样显示缺失框，超出请求范围的额外任务不增加图片框

#### Scenario: 生图失败后显示缺失

- **WHEN** 已接受的图片任务在生图阶段失败且没有可展示的图片
- **THEN** 图片框显示“缺失”和具体错误原因
- **AND** 该真实任务保留现有重试机制，已生成或保留的图片不会被缺失框覆盖

### Requirement: 错误隔离保留整套阻断边界

无法完整解析的响应、缺少非空顶层 items 且已有协议修复仍失败、全部普通营销任务在最多两轮局部修复后仍无效、共享主体无效、用户锁定项被更改／遗漏／移除或平台必需项被破坏时，系统 SHALL 明确报告整套阻断原因且不提交图片请求。初稿全部普通条目被拒但整套硬约束未被破坏时 SHALL 允许局部修复，不在修复前直接终止。部分接收的流式内容 MUST NOT 作为最终计划生图。已确认的账号级错误 SHALL 沿用现有停止规则；单张上游暂时性失败 SHALL 沿用现有单张失败和重试机制，MUST NOT 因本次规划剔除策略删除已生成结果。

#### Scenario: 全部条目无效
- **WHEN** 完整响应中所有普通营销条目均未通过校验
- **THEN** 系统使用已确认事实和原始位置进行最多两轮局部修复
- **AND** 仍无有效条目时显示零条可用及错误原因，不报告成功，也不发出生图请求

#### Scenario: 必需或锁定条目不可用
- **WHEN** 待移除或遗漏条目破坏平台必需图要求或用户锁定内容
- **THEN** 系统阻止本次生图并解释受影响约束，不静默缩减成不符合要求的计划

#### Scenario: 响应截断或账号级错误
- **WHEN** 规划响应中途截断，或生图确认发生账号级认证／计费错误
- **THEN** 截断规划沿用完整解析与已有重试边界，账号级错误沿用既有停止规则
- **AND** 系统不把半份响应当作成功计划，也不删除已完成图片

### Requirement: AI 营销规划摘要使用可折叠悬浮面板

AI 营销规划摘要 SHALL 通过套图产物区的状态按钮展开为固定悬浮面板，并可从按钮或面板标题区收起。分析师分析 SHALL 同样通过标题区按钮展开为独立悬浮面板，两个面板 SHALL 互斥展开并在切换板块后隐藏。悬浮面板 MUST NOT 参与产物区布局或改变图片网格的尺寸。面板 SHALL 将受众、卖点、痛点和逐图任务以紧凑、可滚动的层级呈现；窄屏下 MUST 保持视口内可操作且不产生水平溢出。

“分析师分析”和“AI 营销规划”按钮 SHALL 常驻套图产物标题区，沿用“补齐未完成项”的禁用样式。有可查看的分析内容、分析流或规划进度时，对应按钮 SHALL 可点击；无对应数据时 SHALL 置灰禁用，MUST NOT 隐藏按钮。

#### Scenario: 数据清空后保留禁用入口

- **WHEN** 当前记录没有分析或规划数据，或已有数据被清空
- **THEN** 两个按钮仍在标题区显示，并按各自数据可用性置灰禁用
- **AND** 无数据的浮层收起，规划按钮恢复“AI 营销规划”文案，不保留旧记录的进度

#### Scenario: 展开和收起分析师分析

- **WHEN** 用户点击分析师分析按钮
- **THEN** 分析内容浮在页面上方且不挤占图片网格的空间
- **AND** 营销规划面板收起，分析面板可通过标题区按钮或 Escape 收起并恢复按钮焦点
- **AND** 切换到其它板块后两个悬浮面板均不再显示

#### Scenario: 展开规划摘要

- **WHEN** 用户打开 AI 营销规划状态按钮
- **THEN** 规划摘要显示在独立悬浮面板中
- **AND** 图片网格的布局尺寸不因展开而改变
- **AND** 用户可从状态按钮或面板标题区收起面板

#### Scenario: 定位到有效任务图片

- **WHEN** 用户选择一条已通过校验的逐图营销任务
- **THEN** 系统按稳定任务 ID 定位并聚焦对应图片卡片
- **AND** 对应图片卡片短暂高亮，悬浮面板收起

#### Scenario: 定位到缺失任务图片

- **WHEN** 用户选择一条因校验移除或模型未返回的逐图任务
- **THEN** 系统按任务原始序号定位到对应缺失占位卡片
- **AND** 不创建生图任务或改变有效任务数量

#### Scenario: 规划图片框尚未渲染

- **WHEN** 用户在规划卡片尚未出现时选择一条逐图任务
- **THEN** 系统说明对应图片框尚未显示并保持面板展开
- **AND** 不定位到无关图片卡片

\n

### Requirement: 分析和营销面板提供生图区大尺寸阅读视图

分析师与营销面板 SHALL 利用生图区的主要可视空间展示内容，使用清晰的正文尺寸、行距和留白，将分析概览与逐图任务分区呈现。面板 SHALL 具有可见的收起操作并适配窄屏，SHALL 保留互斥展开、Escape 收起、焦点恢复及点击任务定位。展开浮层 MUST NOT 改变图片网格尺寸。

#### Scenario: 桌面查看二十项营销规划
- **WHEN** 用户展开二十项规划的营销面板
- **THEN** 面板利用生图区的大部分宽度与可用高度，逐图任务可清晰阅读和滚动
- **AND** 标题与收起操作保持可操作，接收新内容不会抢走当前阅读位置

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

### Requirement: 营销规划与分析师浮层保持适度通透且文字清晰

AI 营销规划和分析师分析浮层 SHALL 采用主题设置指定的不透明度渲染背景，默认 90%，范围 70%–98%，并使用 16px 背景模糊弱化底层图片与文字干扰。背景底色 SHALL 跟随当前配色和深浅主题。系统 MUST NOT 对整个浮层应用透明度，也 MUST NOT 因该设置改变图片网格布局或浮层既有开关、互斥、滚动及卡片定位行为。

#### Scenario: 在图片网格上方查看规划

- **WHEN** 用户在有图片和文字的套图产物区打开营销规划浮层
- **THEN** 浮层使用当前设置的背景不透明度并弱化底层内容
- **AND** 浮层文字和按钮保持清晰，吸顶标题不会与滚动正文叠字

#### Scenario: 切换分析师浮层或主题

- **WHEN** 用户打开分析师分析浮层，或切换配色、深浅主题
- **THEN** 浮层沿用当前背景不透明度并匹配当前主题底色
- **AND** 两个浮层继续互斥展开且图片网格尺寸不变

#### Scenario: 浏览器不支持背景模糊

- **WHEN** 当前环境不支持背景模糊
- **THEN** 浮层仍使用设置的不透明度提供背景遮挡
- **AND** 浮层内容与操作继续可用

### Requirement: Platformless AI marketing plans enforce confirmed restricted terms

Creation Mode SHALL include confirmed restricted terms in the existing AI marketing request and SHALL validate generated ordinary marketing items locally before generation. Because Creation Mode has no marketplace selector and new plans use the universal ecommerce profile, these restrictions SHALL apply regardless of legacy platform metadata. The current confirmed list SHALL include the standalone English word `safe`, based on user feedback about SHEIN. Matching SHALL be case-insensitive in the final prompt, title, marketing goal, and creative brief fields, after system subject-lock text is assembled. A matching ordinary item SHALL be removed with a diagnostic naming its source index, field, and matched term; it MUST NOT be submitted for image generation. This check MUST NOT add a model request. Existing user-locked and required-item failure behavior SHALL remain authoritative.

#### Scenario: Restricted term is filtered in the universal plan

- **WHEN** an AI marketing item contains standalone `safe` in any letter case
- **THEN** the server removes that item before generation
- **AND** the diagnostic identifies the source item, field, and matched term
- **AND** the planner does not issue an automatic repair request

#### Scenario: Match boundaries avoid unrelated words

- **WHEN** a marketing item contains `unsafe` or `safely` but not standalone `safe`
- **THEN** the restricted-term validator does not remove it for this rule

#### Scenario: Legacy platform metadata does not change filtering

- **WHEN** a request contains legacy marketplace metadata or the normal `universal` value
- **THEN** the same confirmed restricted terms are included and enforced

### Requirement: Creation Mode grounds product fidelity in the primary reference

Newly planned Creation Mode prompts SHALL express product appearance through one `PRODUCT FIDELITY` instruction grounded in the reference applicable to the image task. Ordinary single-product carousel items SHALL follow the selected primary product reference. Independent SKU items SHALL follow their own exact source references. Variant comparison and grouped size or specification items SHALL preserve each assigned variant from its matching source rather than copying the default product over all groups. The system MUST NOT request, normalize, inject, or display analysis-derived `APPEARANCE LOCK` text as an independent instruction. Legacy analysis payloads containing `appearance_locks` SHALL be accepted without allowing that field to affect new plans. Supporting references MAY contribute facts assigned to their roles, but MUST NOT replace the applicable product reference as the visual authority. Appearance facts assigned to ordinary detail tasks SHALL be scoped using the explicit primary-reference role, not analysis-derived appearance locks.

识别成功并应用当前参考图建议时，系统 SHALL 用有效的识别商品主体名称直接覆盖当前商品名称，包括手动名称和上一轮自动名称；直接名称缺失时 MAY 使用有效的 SKU 主体名称。类目标签、类目路径、文件名、“商品”等泛称及 F2J14 这类独立货号、型号或纯数字编码 SHALL NOT 单独用于自动填写。含有具体商品描述的名称 MAY 保留其型号信息。没有有效新名称时 SHALL 保留当前名称。修改参考图 SHALL 保留当前名称直到新的有效识别结果替换，旧自动名称 SHALL NOT 作为下一次识别的用户事实。修改商品名称或描述 SHALL 使规划草稿失效，但 SHALL NOT 单独取消当前参考图识别、剔除已应用的参考图分析或阻止当前文件批次的新识别结果覆盖名称。系统 SHALL 继续按当前输入校验用户来源事实；文件、平台或请求版本已变化的过期响应 SHALL NOT 修改名称或发布成功反馈。显式清空参考图仍 SHALL 沿用原有重置流程。

#### Scenario: Analysis returns an incorrect appearance lock

- **WHEN** a legacy or upstream analysis payload includes an `appearance_locks` entry that conflicts with the applicable product reference
- **THEN** normalization and newly planned prompts ignore that entry
- **AND** the generated prompt retains `PRODUCT FIDELITY` grounded in the task's product reference

#### Scenario: AI marketing planning uses primary-reference fidelity

- **WHEN** Creation Mode builds an AI marketing plan with a primary product reference
- **THEN** the planner context does not include an analysis-derived subject-lock contract and identifies the default fidelity contract as applying to ordinary single-product images
- **AND** each unlocked final item prompt contains a task-scoped `PRODUCT FIDELITY` instruction without a separate `APPEARANCE LOCK`

#### Scenario: SKU and generation reference labels omit analysis locks

- **WHEN** a new SKU item or carousel item is planned from product analysis containing legacy appearance locks
- **THEN** its prompt context and generation reference labels contain no analysis-derived subject lock
- **AND** the SKU's own selected references and product-fidelity instruction remain in effect

#### Scenario: Evidence-chain preview omits the separate lock row

- **WHEN** the user opens an AI-planned item's evidence chain
- **THEN** the preview shows its task, facts, recommendations, and sources without a separate subject-lock value

#### Scenario: Primary-reference appearance facts remain scoped

- **WHEN** primary and supporting references contain different appearance facts
- **THEN** ordinary detail-task appearance facts are selected by the explicit primary-reference role index
- **AND** removing `appearance_locks` does not promote supporting-reference appearance facts to primary-reference facts

#### Scenario: Visually inferred product name remains a suggestion

- **WHEN** reference analysis offers only a category label as a name suggestion without a valid identified product or SKU subject name
- **THEN** applying reference roles and category recommendations leaves the product-name field unchanged
- **AND** the inferred category label remains available as a suggestion for the user to review

#### Scenario: 新识别直接覆盖已有名称

- **WHEN** 当前参考图识别返回有效名称，当前字段已有手动名称或上一轮自动名称
- **THEN** 成功应用识别结果直接覆盖名称，并显示已自动填写的成功反馈
- **AND** 识别期间修改名称或描述不会仅因此丢弃当前文件批次的识别结果

#### Scenario: 自动补全空商品名称

- **WHEN** 当前名称为空或只含空白，识别返回有效的商品主体名称或 SKU 主体名称
- **THEN** 名称输入框自动填入该名称，成功反馈显示已自动填写并提醒核对

#### Scenario: 缺少有效名称或识别已过期

- **WHEN** 识别只有类目、文件名或泛称，或者文件、平台或请求版本在异步识别期间发生变化
- **THEN** 无效名称不覆盖或清空已有名称，过期响应不修改名称或发布成功反馈

#### Scenario: 识别名称只有货号或型号

- **WHEN** 识别直接名称或 SKU 名称为 F2J14、SKU-001、纯数字或带货号／型号前缀的独立编码
- **THEN** 系统不把该编码自动填写为商品名称，也不提示该编码已自动填写
- **AND** 若其它 SKU 提供有效的商品描述名称，则使用该有效名称；仅有编码时字段保持原值
- **AND** 无有效识别名称时用户已有输入保持原文，带具体商品描述的有效新名称仍覆盖当前名称

#### Scenario: 修改参考图不清空商品名称

- **WHEN** 参考图变更使旧分析失效，但新的识别尚未成功
- **THEN** 商品名称保持现值，旧自动名称不作为新识别的用户事实
- **AND** 新的有效名称成功返回后覆盖现值；识别失败或没有有效名称时继续保留现值

#### Scenario: 编辑商品文字保留参考图分析

- **WHEN** 用户在同一参考图批次下修改商品名称或描述
- **THEN** 规划草稿失效，参考图分析仍保留并进入下次规划载荷
- **AND** 当前用户文字不再支持的用户来源事实仍被原有来源校验过滤

### Requirement: 图片卡片提供唯一的全套主体锁

套图 SHALL 仅通过图片卡片已有的参考用途下拉框选择全套主体，不显示独立的“主体锁”按钮或遮挡缩略图的锁定控件。用户指定的 `reference-product`（参考主体）SHALL 优先于所有普通 `product`（商品主体）；未指定参考主体时，系统 SHALL 使用当前排列顺序中最靠前的商品主体。其余商品主体 SHALL 继续保留为普通商品或 SKU 参考，不成为第二个全套主体。

多 SKU 输入 SHALL 同样最多存在一个参考主体；选择新参考主体 SHALL 将旧参考主体恢复为普通商品主体。修改参考用途或拖动商品图顺序 SHALL 沿用压缩配置刷新、分析失效与草稿计划失效机制。系统 SHALL 在参考用途控件提供优先级和排序提示，MUST NOT 为主体选择要求或自动生成额外主体描述。没有可用商品主体时 SHALL 保持既有兼容回退及错误边界；SKU 款式来源和信息图重构 SHALL 保持现有规则。

#### Scenario: 多 SKU 中更换唯一主体图

- **WHEN** 用户在多张商品图的用途下拉框中依次将两张设为参考主体
- **THEN** 仅最后一张为参考主体，原参考主体恢复为商品主体
- **AND** 卡片不出现独立主体锁按钮，也不增加主体描述

#### Scenario: 取消主体锁

- **WHEN** 用户在用途下拉框中将参考主体改回商品主体
- **THEN** 该图恢复为普通商品参考，系统按当前商品图顺序选择全套主体
- **AND** 旧分析与草稿失效，不要求使用独立锁定按钮

#### Scenario: 没有参考主体时按商品图顺序选择

- **WHEN** 没有图片设为参考主体，当前列表包含辅助图和多张商品主体
- **THEN** 全套使用排列最靠前的商品主体，忽略排在它前面的辅助图
- **AND** 拖动另一商品图至其前方后，新草稿使用新的首个商品主体

#### Scenario: 参考主体始终优先于更早的商品主体

- **WHEN** 参考主体排在一个或多个普通商品主体之后
- **THEN** 压缩优先级、普通套图规划和实际附件仍优先使用参考主体
- **AND** 将该图用途改回商品主体后，按当前商品图顺序选择

### Requirement: 紧凑生成参考标签只有一个主体身份依据

普通单款套图的紧凑参考标签 SHALL 按实际所选参考图与角色元数据确定唯一主体，其它商品图 SHALL 仅为辅助证据。独立 SKU 的主体身份 SHALL 由该 SKU 精确匹配的自身原图定义，全套默认参考 MUST NOT 替换另一 SKU。

多款式、尺寸分组和参数分组任务 SHALL 按本图实际分配保留各款来源。商品附件标签 SHALL 明确该款自身的配色、结构、完整可售单位和所属分组，MUST NOT 要求所有款式复制默认主参考图。辅助参数、数量与事实 SHALL 保持各自款式归属。标签 MUST NOT 从分析另造主体描述。信息图重构 SHALL 保持既有单一来源和无角色装饰行为。

#### Scenario: 主体图与另一 SKU 图同时作为参考

- **WHEN** 普通单款场景图的紧凑标签包含指定主体图和另一张商品图
- **THEN** 仅指定主体图声明为本图主体，另一商品图只提供辅助证据

#### Scenario: 多款图展示黑色与卡其两款

- **WHEN** 多款式图使用黑色与卡其两张已提供的商品图
- **THEN** 两张图分别为对应款式提供身份依据
- **AND** 不会要求卡其款改成黑色或把多款图缩减成默认单款

### Requirement: 主体选择遵循逐图任务的来源边界

用户选择的全套参考主体 SHALL 决定普通单款轮播的默认商品；独立 SKU SHALL 继续使用自身准确来源。模板与 AI 规划的多款式、尺寸和参数分组任务 SHALL 保留实际分配的不同款式及其配色、件数、尺寸和型号条件，MUST NOT 套用普通单款图的跨面板统一配色与件数约束。

有至少两个独立商品来源但缺少可靠颜色名称时，模板多款式任务 SHALL 仍保留这些来源，MUST NOT 将缺少名称误报为缺少多款资料。分析路径的多款式任务 SHALL 保留已提供的商品附件，不因该任务未分配普通事实而过滤其它款式。系统 SHALL 保持参考数量与字节预算、普通单款主体选择、信息图单源规则和历史冻结内容。

#### Scenario: 参考主体为卡其但独立 SKU 为黑色

- **WHEN** 全套参考主体是卡其款且当前生成项为有来源的黑色 SKU
- **THEN** 普通主图以卡其参考为准，黑色 SKU 的提示词和实际附件只使用黑色 SKU 来源及允许的规格辅助图
- **AND** 黑色 SKU 补图沿用同一款式来源

#### Scenario: 有分析的多款式任务没有普通事实分配

- **WHEN** 用户提供两张商品主体图，而自动分工中的多款式任务未分配普通事实
- **THEN** 实际生成请求仍附加两张已提供的商品图
- **AND** 不因空事实来源而只发送全套默认主体

#### Scenario: 历史套图不被当前下拉选择回写

- **WHEN** 用户在生成后将当前参考主体从黑色改为卡其
- **THEN** 新草稿须重新规划，已保存图像、冻结提示词和已入队任务保持原有快照
- **AND** 查看历史生成结果时以该套保存的参考角色为准

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

系统 SHALL 在初稿逐图事实与引用校验后审核整套策略缺失或无效、功能遗漏、购买问题和证据重复及明显的版式同质化。存在可修复问题时 SHALL 最多进行两轮局部 AI 修复，每轮重新校验。合格项、用户锁定项、平台强制项和已确认分析 SHALL 保持不变。普通质量建议在修复后仍未解决或没有可调整位置时 SHALL 作为可见警告保留，MUST NOT 阻断通过逐图事实与来源校验的图片；合格初稿 SHALL 不增加修复请求。真实来源失效、无可用轮播项及平台必需项无法满足时 SHALL 保留明确错误。

初稿中缺少购买理由、无效事实引用或功能证据不合格的整套策略 SHALL 进入该有界修复。只需修复策略时 SHALL 保留全部已通过图片及其提示词和参考分配，复用已确认分析，只返回修复后的策略与空 `items`。仅明确的策略修复请求 MAY 接受空 `items`，普通初稿 SHALL 继续要求非空图片任务。策略修复与图片修复 SHALL 共用最多两轮预算；策略元数据仍无效时 SHALL 不采用该元数据，并显示具体建议，MUST NOT 因此阻断图片事实与来源均有效的任务。无依据的单张功能表现 SHALL 单独排除并同步实际数量、冻结、生成和补图；MUST NOT 将无效引用写入最终提示词或伪造缺失内容。用户锁定提示词 MUST NOT 被静默改写。

#### Scenario: 修复缺失的功能任务
- **WHEN** 初稿遗漏已确认核心功能的可见表现
- **THEN** 系统选择可调整位置进行局部修复并重新审核
- **AND** 其余合格提示词与参考图分配保持原样

#### Scenario: 修复耗尽或用户约束冲突
- **WHEN** 两轮后仍有关键问题，或图片需要修改但所有可用位置都被用户或平台锁定
- **THEN** 系统明确展示优化建议，保留可用图片继续生成
- **AND** 不无限重试、不静默替换锁定提示词，不把功能覆盖、重复或版式建议当作整套失败条件

#### Scenario: 已确认预览与历史补图
- **WHEN** 用户提交修复后的冻结预览或补齐历史计划
- **THEN** 生成与补图复用最终提示词、来源与审核元数据
- **AND** 不再次发起整套审核修复请求

#### Scenario: 策略事实 ID 错误但图片任务有效
- **WHEN** 初稿策略引用不存在的事实而图片任务均已通过校验
- **THEN** 系统只修复策略，向模型提供已确认事实和具体错误
- **AND** 修复成功后保留原图片的最终提示词、数量和参考分配

#### Scenario: 全部图片受约束但策略缺少购买理由
- **WHEN** 策略缺少购买理由而合格图片被用户或平台锁定
- **THEN** 系统允许只修复策略，不因没有可改写图片而直接失败
- **AND** 不改写受约束图片

#### Scenario: 策略修复失败或返回了未请求图片
- **WHEN** 策略修复继续引用未知事实或试图返回已确认图片
- **THEN** 系统拒绝该次修复并在共享预算内重试
- **AND** 两轮后策略仍无效时不采用该元数据，显示具体建议，其余通过事实与来源校验的图片仍可生成

#### Scenario: 单张功能表现无依据
- **WHEN** 两轮后某张功能表现仍没有已确认功能依据，且该项不是平台必需项
- **THEN** 系统仅移出该项，列出原序号和具体原因，保留其余有效图片
- **AND** 实际张数、预览、冻结、生成重校验及补图采用相同的保留项

#### Scenario: 普通质量建议或局部优化服务不可用
- **WHEN** 图片事实和来源均有效，但缺少可见功能表达、任务相近、简报不完整或局部修复请求失败
- **THEN** 系统保留可用计划并在预览展示不影响生成的优化建议
- **AND** 用户可以直接生成，生成时复用该冻结计划而不再次触发整套审核

### Requirement: 视觉表达依据任务而非固定信息图配额

自动规则规划 SHALL 按有效内容分配信息图，SHALL NOT 因为图片数量达到固定阈值而强制插入信息图。主图与场景图 SHALL 按当前购买任务选择构图，不把圆框、拼图和卖点条作为通用必需元素。功能渲染 SHALL 在一个完整主体和统一构图中突出主要功能及其收益，并只保留与当前任务有关的辅助功能证据。

#### Scenario: 功能渲染与场景图具有不同任务和画面
- **WHEN** 同一套图包含功能表现、使用场景和规格说明
- **THEN** 各图交代独立新增信息并使用适合任务的视觉形式和文字密度
- **AND** 不把三者都组织为大商品周围的重复信息小框

### Requirement: 商业 CG 渲染替换冲动下单氛围图

系统 SHALL 在新规划中将原 atmosphere / ownership-atmosphere 图型显示为“商业 CG 渲染图”，保留既有角色、图型与槽位标识。该图 SHALL 以无新增文字的商业渲染呈现商品体积、真实材质区分、主光与轮廓光、接触阴影及空间反射；存在已确认功能时 SHALL 通过有依据的立体效果表达买家收益。系统 SHALL 沿用参考支持的商品结构、配色和视角，不以塑料质感或平面装饰光效代替渲染。该图 SHALL NOT 强制真人或生活操作场景，不消耗独立操作场景，不纳入真人角色配额。既有手动提示词、平台硬约束和历史冻结内容 SHALL 保持有效。

#### Scenario: 同时选择商业 CG 与功能图

- **WHEN** 用户选择 atmosphere 和 effect-comparison
- **THEN** 两个角色分别保留，前者用无字商业 CG 表达材质、体积与有依据的功能感受，后者解释有依据的功能作用
- **AND** 商业 CG 不因为缺少独立使用场景或不适合真人出镜而被跳过或替换

#### Scenario: AI 自主安排商业 CG

- **WHEN** AI 营销根据商品事实和整套任务策划图片
- **THEN** 系统允许自主选择 commercial-cg 视觉形式，不强制每套张数，并要求无新增文案和有依据的空间效果
- **AND** 纯外观 CG 不需要功能事实，也不自动视为核心功能覆盖；其他图型的文案仍自主安排

### Requirement: 功能渲染加强空间作用表现

系统 SHALL 保留 effect-comparison / comparison-proof 与“功能效果渲染图”，围绕一个完整商品呈现有依据的主要功能与买家收益。功能效果 SHALL 通过符合商品的流动、前后遮挡、纵深及合理局部光照表现空间关系，SHALL NOT 仅依靠平面箭头、装饰描边或暖色背景。系统 SHALL 保持参考支持的主体结构、材质、颜色、视角和可见数字，不补造内部元件、作用范围或参数。

#### Scenario: 功能与材质任务独立

- **WHEN** 同套图包含商业 CG 与功能效果渲染
- **THEN** 功能图继续以有据的作用、流动或结果为主要证据，CG 图以无字商业视觉表达材质、体积与有依据的功能感受
- **AND** 两者不能只替换背景、标题或重复同一购买信息

### Requirement: 商业 CG 采用无字且有依据的效果渲染

系统 SHALL 将新规划的 atmosphere / ownership-atmosphere 商业 CG 默认设为无新增画布文字的纯渲染，SHALL NOT 添加标题、卖点字、图标、参数卡、水印或标注，商品已有实物标记保持参考。规则规划与 AI 营销 SHALL 使用一致的渲染方向；AI commercial-cg 的 text_density SHALL 为 none。

存在已确认功能时，系统 SHALL 向 CG 分配相关功能事实，并用商品本体与空间效果直观表现该功能。已确认的加热可用橙金暖光、体积热流、前后遮挡和局部光照表达暖意，SHALL NOT 仅依靠暖色背景。功能示意 SHALL 保持实物结构、表面与配色，SHALL NOT 虚构内部线路、具体作用区域、数值或实测结论。没有已确认功能时 SHALL 继续表现材质与体积，不因商品名称补造性能。

#### Scenario: 加热手套的无字暖感 CG

- **WHEN** 用户规划商业 CG，且商品资料已经确认加热功能
- **THEN** CG 的事实链包含加热依据，画面指令包含可见的立体暖感效果和禁止新增文字的约束
- **AND** 不是普通棚拍配卖点文字或仅更换暖色背景

#### Scenario: 外观商品不虚构功能

- **WHEN** 商品仅有外观事实或没有商品分析
- **THEN** CG 保持无字材质与体积表现，所有功能效果仅限已提供依据

#### Scenario: AI CG 的文案和功能依据校验

- **WHEN** AI 提交 commercial-cg 视觉形式
- **THEN** 非 none 的文字密度被拒绝并提供可修复原因，有功能效果时检查已确认功能事实
- **AND** 原功能图继续独立存在，手动提示词、历史冻结内容和平台硬约束保持有效

### Requirement: 分析与营销延迟可按真实执行阶段核对

系统 SHALL 为同一逻辑分析或营销操作关联资料准备、每次上游请求、首包、首段回答、回答结束、本地校验和局部修复的可观测时长。系统 MUST NOT 把心跳当作回答，MUST NOT 把缓冲 JSON 伪装成实时增量，MUST NOT 记录凭据、原始图片或模型私密推理。

#### Scenario: 网关延迟或缓冲回答

- **WHEN** 上游连接已建立但尚未提供回答文本，或最终仅返回整包 JSON
- **THEN** 分析师和营销面板分别展示真实等待、可核对的时间及最终传输方式
- **AND** 不声称未知的模型内部步骤已经完成

#### Scenario: 分析后规划并发生局部修复

- **WHEN** 用户复用当前有效分析规划整套图，初稿需要局部修复
- **THEN** 同一操作内可区分初稿及每次实际修复调用的耗时与次数
- **AND** 当前 High 等用户选择、已校验事实 ID 和合格图片保持有效

### Requirement: 规划减少重复内容并保留完整事实约束

系统 SHALL 在已有有效分析时复用事实与 ID，减少重复分析、逐图元数据和修复上下文中的冗余。系统 MUST NOT 为缩短输出而截断提示词、事实、数值条件、主参考图保真或用户锁定内容，MUST NOT 自动降低思考等级或增加逐图规划请求。

#### Scenario: 对同一二十图输入比较优化结果

- **WHEN** 使用同商品资料、参考图、模型和思考等级比较输出
- **THEN** 验证报告列出实际请求数、输出体量、首段及总时长和有效图片数量
- **AND** 区分已实测收益与不能确认的上游延迟变化

### Requirement: Repair rejected marketing directions before returning a partial plan
The system SHALL include rejected or absent marketing image positions in the existing bounded local repair loop, using only confirmed product facts and preserving accepted tasks and user constraints.

#### Scenario: Invalid fact references in multiple directions
- **WHEN** a draft contains image directions referencing unavailable product fact IDs
- **THEN** the system SHALL request replacements for their original positions using the confirmed analysis
- **AND** unsupported directions SHALL be rewritten rather than having their fact IDs silently substituted
- **AND** accepted prompts SHALL remain unchanged

#### Scenario: Missing positions or no accepted images
- **WHEN** a parseable draft has missing positions or every optional image is rejected
- **THEN** the system SHALL allow those positions to be repaired within the same maximum of two repair rounds
- **AND** an exhausted plan without usable images SHALL fail with a specific diagnostic

#### Scenario: Bounded repair preserves constraints
- **WHEN** local repair replaces rejected positions
- **THEN** original positions, selected image types, locked content, platform requirements and factual source validation SHALL remain enforced
- **AND** invalid replacement responses SHALL NOT displace already accepted tasks

### Requirement: 批量营销方案使用两个独立规划槽位

系统 SHALL 按方案序号领取批量营销任务，并同时执行最多两个方案。任一方案完成规划及自身副本入队后 SHALL 立即补充下一方案，而不等待另一活动方案。每个方案 SHALL 使用独立变化种子、规划请求、SSE 进度与冻结结果；每个副本 SHALL 具有独立队列快照与任务标识。并行结果 MUST NOT 通过共享预览草稿交接或互相覆盖。

#### Scenario: 较快方案先完成
- **WHEN** 五个方案每个需要生成两套，方案 1 尚未完成而方案 2 已完成
- **THEN** 方案 2 的两个副本按自身顺序加入现有套图队列，并启动方案 3
- **AND** 任意时刻同时执行的方案数不超过 2，全部完成后共计 10 个不同队列任务

#### Scenario: 乱序结果不串用
- **WHEN** 方案 2 的结果先于方案 1 返回
- **THEN** 每个任务的提示词、变化种子、参考文件与营销进度均来自所属方案及批量启动快照
- **AND** 后续表单编辑不改变已开始批量操作的输入与图片质量设置

### Requirement: 并发规划暂停与取消保留可恢复进度

系统 SHALL 将不可恢复规划错误、重试耗尽和入队失败隔离到所属方案，标记失败并继续领取其余方案。另一活动方案的有效结果 SHALL 正常入队，不因同伴失败而暂停。所有方案处理完毕后 SHALL 结束批次，失败方案 MUST NOT 计为成功，也 MUST NOT 无限重试或重复提交已入队副本。仅用户主动暂停或停止 SHALL 阻止后续方案执行；主动暂停 SHALL 保留有效冻结计划，继续时仅补充尚未入队的副本。重试等待后 SHALL 再次检查暂停和取消状态。取消后迟到响应或异常 MUST NOT 恢复执行或覆盖取消状态。已实际入队任务 SHALL 继续保留。

#### Scenario: 同伴规划在失败后返回
- **WHEN** 方案 1 失败，方案 2 已发出且随后返回有效结果
- **THEN** 方案 1 标记失败，释放的槽位启动后续方案，方案 2 的副本正常入队
- **AND** 全部方案均处理后结束批次，成功与失败数量分别记录

#### Scenario: 规划重试耗尽
- **WHEN** 方案发生瞬时错误且已耗尽既有自动重试预算
- **THEN** 该方案标记失败，继续处理剩余方案，失败不暂停整个批次

#### Scenario: 部分副本入队后失败
- **WHEN** 某方案已有副本入队且后续副本提交失败
- **THEN** 保留已入队副本并将方案标记失败，其余方案继续处理
- **AND** 不将部分入队方案计为成功，不重复提交已有副本

#### Scenario: 取消发生在两个规划期间
- **WHEN** 用户取消剩余方案且两个规划随后分别成功或失败
- **THEN** 批量状态保持已取消，未入队副本不再创建，未开始方案不发请求

### Requirement: 套图队列支持两套同时生成

系统 SHALL 同时执行最多两个套图队列任务，并遵守启动时冻结的全局图片请求并发与提交间隔。全局图片请求上限为 1 时 SHALL 只运行一套。自动补图结束前 SHALL 保留所属套图槽位。任务和图片进度 SHALL 按各自队列标识隔离，当前选中套图 MUST NOT 被另一任务更新覆盖。

#### Scenario: 两套运行时补充下一套
- **WHEN** 两套已开始生成，第二套完成而第一套仍在生成或自动补图
- **THEN** 第三套可以开始，任意时刻运行套图数不超过 2
- **AND** 图片上游总请求仍受同一会话的全局上限与提交间隔限制

#### Scenario: 全局图片并发为一
- **WHEN** 批量快照中的全局图片请求并发为 1
- **THEN** 套图队列逐套执行，包括完成自动补图后才释放槽位

### Requirement: 批量营销功能显式开启且默认关闭

系统 SHALL 为“很多套 AI 提示词”提供明确的开启／关闭按钮，每次加载默认关闭。关闭时 SHALL 隐藏配置及启动、继续入口，并阻止程序调用启动或继续批量生成。开启后 SHALL 展示配置和适用操作，按钮文本与无障碍状态 SHALL 与启用状态一致。AI 营销提示词关闭时 SHALL 隐藏批量入口并重置启用状态。批量启动或运行期间 SHALL 禁用关闭按钮，剩余任务取消 SHALL 继续使用既有取消入口。运行中的批量配置因 AI 开关隐藏后，重新启用 AI SHALL 允许再次开启配置以查看状态和取消剩余任务。

#### Scenario: 初始默认关闭
- **WHEN** 用户首次加载 Creation 且 AI 营销提示词已勾选
- **THEN** 批量入口显示“开启”按钮，配置隐藏且按钮的按下状态为 false
- **AND** 未开启时调用启动或继续函数不发起规划或入队

#### Scenario: 开启与关闭
- **WHEN** 用户点击“开启”
- **THEN** 显示批量配置，按钮显示“关闭”且按下状态为 true
- **AND** 批量未执行时再次点击可关闭并隐藏配置

#### Scenario: 执行期间保护开关
- **WHEN** 批量正在启动或运行
- **THEN** 关闭按钮禁用，原有取消剩余入口继续可用
- **AND** 已入队任务的状态与生成流程不受影响

### Requirement: 批量配置展示三因子预计图片总数

系统 SHALL 用当前套图数量、方案数量和每方案生成套数的乘积展示预计营销图片总数，同时显示计算因子和方案数量 × 每方案生成套数得到的队列套数。修改任一数量 SHALL 立即更新预计值。预计值 SHALL 标明属于营销图片，SKU 图和信息图重构仍按现有独立任务规则追加，实际生成继续遵循冻结计划与校验结果。

#### Scenario: 二十张十个方案各两套
- **WHEN** 套图数量为 20、方案数量为 10、每方案生成套数为 2
- **THEN** 配置显示预计生成 400 张营销图片，计算因子为 20 × 10 × 2
- **AND** 配置显示预计加入 20 套队列任务

#### Scenario: 修改任一数量
- **WHEN** 用户修改套图数量、方案数量或每方案生成套数
- **THEN** 预计图片总数与队列套数按最新有效输入立即刷新
- **AND** 不改变每个方案只规划一次和套图队列的既有规则

### Requirement: 批量后续任务可主动暂停和继续

系统 SHALL 提供“暂停后续”和“继续”，供用户主动控制后续执行。方案失败 MUST NOT 自动暂停整个批次。主动暂停 SHALL 立即停止新方案、新重试及尚未入队副本的提交，已发出的规划请求 SHALL 完成收尾并保留有效冻结计划。收尾期间 SHALL 显示“正在暂停”，禁止继续；全部执行槽位退出后 SHALL 进入“已暂停”，允许继续且仅补充未完成工作。已入队任务 SHALL 保持执行，已完成方案、失败终态方案和已入队副本 MUST NOT 重复规划或入队。

#### Scenario: 两个规划请求收尾后续跑
- **WHEN** 两个方案正在规划且用户点击“暂停后续”
- **THEN** 批量进入正在暂停，不启动新方案，不新增副本入队，不允许提前继续
- **AND** 已发出的请求收尾后保留有效计划并显示已暂停
- **AND** 点击继续后复用已保留计划，只生成或入队剩余部分

#### Scenario: 一个方案部分入队后主动暂停
- **WHEN** 一个方案需要三套且第一套已入队后用户暂停后续
- **THEN** 第一套继续执行，剩余两套暂不入队，冻结方案保留
- **AND** 用户继续时不重新规划该方案，仅加入剩余两套

#### Scenario: 等待重试期间主动暂停
- **WHEN** 当前方案正在等待自动重试且用户暂停后续
- **THEN** 等待收尾后不再发起该次重试
- **AND** 显示用户暂停，后续可继续

### Requirement: 批量停止后续覆盖运行和暂停状态

系统 SHALL 在批量运行、正在暂停和已暂停时提供“停止后续”。停止 SHALL 将未完成方案及未入队副本标记为已停止并丢弃未入队的缓存计划；已失败终态方案 SHALL 保留失败状态，已入队任务 SHALL 保持执行。停止后的批次 SHALL 不可继续，迟到的规划成功或错误 MUST NOT 改写停止终态或追加队列任务。用户再次开始 SHALL 创建新批次。停止 SHALL 取消本轮仍在等待响应或读取 SSE 的规划请求，完成取消清理后 SHALL 释放开始入口的启动锁，不等待原规划请求自然结束；暂停 SHALL 保留当前规划请求以供后续恢复，取消规划 SHALL NOT 中断已入队的图片生成。

#### Scenario: 失败暂停后停止
- **WHEN** 用户对已有的失败暂停批次点击停止后续
- **THEN** 批量显示已停止，尚未处理的方案不再发起请求
- **AND** 继续入口不可用，已入队任务不变；新批次仍遵循方案失败不自动暂停的规则

#### Scenario: 方案失败后停止剩余任务
- **WHEN** 某方案失败后批量仍继续执行且用户点击停止后续
- **THEN** 批量显示已停止，待开始和活动方案不再提交新请求
- **AND** 已失败方案保持失败，继续入口不可用，已入队任务不变

#### Scenario: 暂停收尾期间停止
- **WHEN** 用户已暂停后续但仍有请求收尾，此时点击停止后续
- **THEN** 剩余方案进入停止终态
- **AND** 迟到的结果不会入队，错误不会把批量改回已暂停

#### Scenario: 卡住的规划停止后重新开始
- **WHEN** 两个规划请求仍未返回响应头或 SSE 尚未结束，用户点击停止后续
- **THEN** 当前规划请求收到本轮取消信号，停止清理完成后开始按钮恢复可用
- **AND** 用户再次点击开始创建独立新批次，旧批次不追加入队任务，也不覆盖新批次状态

### Requirement: 批量控制按钮与冻结数量保持一致

系统 SHALL 在本轮未结束时稳定展示“继续、暂停后续、停止后续”三个操作。运行时 SHALL 启用暂停和停止；正在暂停时 SHALL 仅启用停止；已暂停且请求收尾完成时 SHALL 启用继续和停止。开始新批次 SHALL 仅在没有待继续批次时可用。未结束批次的数量输入 SHALL 锁定，预计图片数和套数 SHALL 使用原始批次参数；续跑 SHALL 继续使用原始请求快照。既有默认关闭开关与三因子总数 SHALL 保持有效。

#### Scenario: 用户修改其他表单后继续
- **WHEN** 20 张、10 个方案、每方案 2 套的批次暂停后用户修改上方套图数量
- **THEN** 本批次仍显示预计 400 张和 20 套，批量数量输入保持锁定
- **AND** 点击继续使用本批次原始快照，不重新提交已完成任务

### Requirement: 批量营销状态仅展示数量汇总

系统 SHALL 用固定行数展示批量状态及已处理、成功、失败、进行中、待处理、已入队和累计重试数量。系统 MUST NOT 逐方案展开错误正文或营销进度长文本。系统 MAY 在汇总下展示各已开始方案的简短计时行，但计时列表 SHALL 限制高度并在溢出时滚动，未开始方案 SHALL 不占用计时行。失败数量 SHALL 独立于成功数量；所有方案处理完毕但有失败时 SHALL 明确显示有失败，不宣称全部成功。方案错误 SHALL 保留在方案状态中以供诊断。

#### Scenario: 多个方案含长错误
- **WHEN** 二十个方案中部分失败且每个错误包含二十条提示词诊断
- **THEN** 数量状态区域仍只展示固定行数的汇总，不输出错误正文或营销进度长文本
- **AND** 已入队、成功、失败与剩余数量反映实际状态，计时列表限制高度

### Requirement: 批量营销方案与批次独立显示执行耗时

系统 SHALL 为每个已开始方案及整个批次记录独立的执行耗时。运行中 SHALL 在现有批量状态位置每秒刷新已用时，即使上游没有进度事件。方案完成入队、规划失败或停止后 SHALL 固定显示所属方案总耗时；整批结束后 SHALL 固定显示整批总耗时。批次耗时 SHALL 按实际并发执行的经过时间计算，不叠加各方案耗时。重试等待与主动暂停时的请求收尾 SHALL 计入耗时，收尾后暂停的空闲时间 SHALL 排除；继续后 SHALL 累计原耗时。未开始方案 MUST NOT 显示运行计时。时间 SHALL 使用分秒格式，超过一小时 SHALL 显示时分秒。计时 SHALL 表示规划和入队阶段，不将已入队误报为图片生成完成。

#### Scenario: 两个方案独立完成
- **WHEN** 同时开始的两个方案分别在三秒和五秒完成
- **THEN** 两个方案分别保留三秒和五秒总耗时，整批保留五秒总耗时
- **AND** 后续刷新和其他任务进度不改变已完成耗时

#### Scenario: 没有上游事件仍更新
- **WHEN** 规划请求仍在等待上游且没有新进度事件
- **THEN** 方案已用时与批次已用时仍每秒更新
- **AND** 完成、暂停收尾结束、停止或关闭展示后清理刷新定时器，重新展示活动批次时仅恢复一个定时器

#### Scenario: 暂停后继续
- **WHEN** 方案已执行三秒并完成暂停收尾，空闲暂停三十秒后继续执行两秒
- **THEN** 方案及批次累计耗时为五秒，不计入三十秒空闲暂停
- **AND** 保留原始开始时间，不重新规划已保留的结果

#### Scenario: 重试失败后继续其他方案
- **WHEN** 一个方案重试后失败而其他方案继续处理
- **THEN** 失败方案固定显示包含重试等待的总耗时，活动方案继续计时
- **AND** 失败不会自动暂停其余方案或重置批次耗时
