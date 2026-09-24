## MODIFIED Requirements

### Requirement: Suite item prompts stay short and positively phrased

Creation Mode SHALL compose every planned carousel and SKU item prompt as a concise sequence of positive rendering instructions. Each prompt SHALL state what the image must contain rather than listing prohibited outcomes, and SHALL NOT contain Do not, Avoid, Never, never, 不要, or other prohibition phrasing.

Necessary constraints SHALL be preserved as positive requirements. In particular, the prompt SHALL still express that existing product and packaging surface content stays as shown, that exact size and weight values appear only in the dimension and specification roles, that visible facts come only from supplied product input and reference evidence, and that included-item images show the unpacked inventory on an open surface.

Prompt composition SHALL NOT impose a character-length ceiling or truncate assembled sections to satisfy a total prompt length. Every role SHALL contribute one merged role directive instead of separate brief, shopper-question, buyer-decision, role-intent, role-focus, and rendering-constraint blocks.

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

#### Scenario: SKU prompt is compressed

- **WHEN** the plan appends SKU items for distinct sellable subjects
- **THEN** each SKU item prompt retains all assembled sections regardless of total character count
- **AND** it contains no prohibition phrasing
- **AND** it still requires the supplied SKU subject, its preserved shape, colors, markings, and identifiers, a new ecommerce background, the applicable subject count, and one shared series template

## ADDED Requirements

### Requirement: 套图生图提示词避免冗余上下文

普通 Creation 轮播图与 SKU 项的模型提示词 SHALL 使用简洁、可执行的控制文字。系统生成的角色、平台、类别、视觉风格和比例描述 SHALL 使用简洁英文或省略无动作含义的默认显示标签；Creation Mode 比例提示 SHALL 只说明所选比例值，不包含用途标签或冗长构图解释。用户提供的商品事实与参考图备注 SHALL 保持原文。

规划提示词与运行时组装 SHALL 不重复表达商品身份锁、商品表面内容保护或新增画布文案语言边界。运行时仍 SHALL 为缺少必要保护的历史冻结提示词补上相应约束。参考图标签 SHALL 标识所附图片与角色，并保留分配给该角色的必要说明；主体身份说明 SHALL 不以多段近义文字重复出现，支撑参考图 SHALL 只贡献其分配角色的证据。

精简 SHALL 通过删除重复或仅复述界面设置的文字完成，不得设置提示词字符数上限，也不得按总长度截断提示词。精简 SHALL 保留商品事实、画面角色、有效的平台/品类硬约束、参考图归属、主体身份与表面内容保护及目标语言边界。infographic-rebuild SHALL 继续使用其独立来源事实与翻译规则。

新增文案的目标语言规则 SHALL 只作用于新创作的画布文案。商品或包装本体上已有的图案、标记、表面文字和字符 SHALL 保持原样；角色、构图、场景和平台约束 SHALL 不因措辞精简而改变其画面含义。

#### Scenario: 英语通用首图只传递比例值

- **WHEN** Creation Mode 以英语目标语言、1:1 比例和 1K 分辨率生成通用首图
- **THEN** 比例提示只包含 Aspect ratio: 1:1. 等简短比例值说明
- **AND** 提示词不包含比例用途、中文 UI 名称或重复的构图解释
- **AND** 规划和运行时不会重复添加主体身份、表面内容保护或目标语言边界

#### Scenario: 商品事实含有中文

- **WHEN** 用户输入的商品名称、描述、卖点或参考图备注包含中文
- **THEN** 系统保留这些用户提供的原文，不猜测翻译或删除商品事实
- **AND** 系统生成的角色、平台、类别、视觉风格和比例控制文字使用简洁英文或省略默认标签

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
