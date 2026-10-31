## MODIFIED Requirements

### Requirement: Creation Mode grounds product fidelity in the primary reference

Newly planned Creation Mode prompts SHALL express product appearance through one `PRODUCT FIDELITY` instruction grounded in the reference applicable to the image task. Ordinary single-product carousel items SHALL follow the selected primary product reference. Independent SKU items SHALL follow their own exact source references. Variant comparison and grouped size or specification items SHALL preserve each assigned variant from its matching source rather than copying the default product over all groups. The system MUST NOT request, normalize, inject, or display analysis-derived `APPEARANCE LOCK` text as an independent instruction. Legacy analysis payloads containing `appearance_locks` SHALL be accepted without allowing that field to affect new plans. Supporting references MAY contribute facts assigned to their roles, but MUST NOT replace the applicable product reference as the visual authority. Appearance facts assigned to ordinary detail tasks SHALL be scoped using the explicit primary-reference role, not analysis-derived appearance locks.

Reference analysis SHALL NOT automatically replace the user's product-name field with a visually inferred product name, category name, or SKU title; such values MAY be shown as suggestions for review.

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

- **WHEN** reference analysis recommends a product name that differs from the name entered by the user
- **THEN** applying reference roles and category recommendations leaves the product-name field unchanged
- **AND** the inferred name remains available in analysis feedback for the user to review

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

## ADDED Requirements

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
