import { DEFAULT_REASONING_EFFORT, MAX_CREATION_REFERENCE_IMAGES } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { buildReferenceAnalysisLanguagePromptGuidance } from "./reference-analysis-language.mjs";
import { normalizeCreationAudienceStrategy } from "./creation-platform-resolver.mjs";
import { normalizeCreationSkuColorLabels } from "./creation-sku-colors.mjs";
import { CREATION_PRODUCT_INSIGHTS_JSON_SCHEMA } from "./creation-product-insights.mjs";
import { CREATION_MARKETING_ITEMS_SCHEMA, CREATION_MARKETING_PLAN_INSTRUCTION, CREATION_MARKETING_PLAN_MODE } from "./creation-marketing-plan.mjs";
import {
  collapseCreationPairedSubjectColorLabels,
  resolveCreationPairedSubjectUnitCount,
} from "./creation-paired-subject-units.mjs";
import {
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  IMAGE_ROUTE_C,
  appendApiEndpointPath,
  normalizeApiEndpointPath,
  normalizeImageRoute,
} from "./image-route-config.mjs";
import { formatFetchFailureDetail, normalizeBase64, parseSseChunk } from "./responses-workflow.mjs";
import { upstreamStreamFetch } from "./upstream-stream-fetch.mjs";

const PROMPT_AGENT_INSTRUCTION = `你是一个图片提示词逆向工程 agent。请分析用户上传的图片，返回一份能复刻该图片视觉效果的结构化中文生图 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释；顶层只能包含 subject、framing、scene、visual、avoid。
2. subject 详细记录主体类型、姿态或状态、表情、可见外观、服装和与物体的交互。图片不适用的字符串返回空字符串，列表返回空数组，不要编造内容。
3. framing 必须详细记录画幅比例、景别、主体占画面比例、画面位置、负空间、前景框景、相机建议、机位角度、裁切、透视和景深。主体占比和位置尽量使用近似百分比或可复核的画面关系。
4. camera 必须给出一个明确且单一的全画幅等效建议焦段，并同时写出与画面匹配的建议拍摄距离、光圈和对焦目标。没有可靠 EXIF 时仍需选择最利于复刻的具体焦段，但只能作为生成建议，不得声称是原图 EXIF 或原始元数据。
5. scene 用一段精简文字描述背景环境和关键物体；visual 不要写成泛泛的画面摘要，必须写成可直接复用的“风格锁定”段，并以“风格锁定：”开头。明确写出源图最具辨识度的风格组合，按适用情况覆盖审美或流派、媒介与渲染、主色与对比、光线方向与质地、材质与表面反应、镜头与景深、后期处理与氛围；不要把具体风格压缩成“写实人像”“电影感”等泛化标签。
6. 对风格锚点按复刻优先级组织：先写最能决定画面身份的媒介、审美类型、色彩关系和用光，再补材质、镜头景深与后期。适用时使用“古风高定写真”“柔光直闪”“玫粉与深墨绿对比”“真实皮肤肌理”“半透明纱料”等可操作词；只在源图有依据时采用这些或同类词汇，不要编造或混搭互相冲突的风格。
7. 风格锁定段使用 8-16 个去重后的具体短语，并包含一次“4K/8K级超高清成像质感”作为生图视觉目标，不得将其表述为源图实际像素、EXIF 或所选路线的输出尺寸保证。若主体清晰对焦，明确要求主体焦点清楚、源图可见的皮肤/材质纹理可辨、边缘自然锐利、细节干净且层次清楚；不要凭空补造源图看不见的细节，也不要要求全画面过度锐化。
8. avoid 只列与当前图片容易生成错误的具体偏差，例如改变景别、主体占比、裁切、姿态、关键物体、媒介、色彩、光线或材质；仅当源图不包含且有误生成风险时，才排除主体意外虚焦、运动拖影、纹理涂抹、噪点/压缩伪影、重复或畸变细节、无关杂物。保留源图有意的背景散景、浅景深、柔焦、胶片颗粒和运动表现，不要写“低质量、最差质量”等通用词。
9. 每项视觉信息只出现一次并放入最合适的字段；主体事实放入 subject，环境事实放入 scene，风格事实优先放入 visual，不得增加完整 prompt、title、summary、style_tags、notes 等重复汇总字段，不得用同义短语重复同一细节。
10. 只保留会改变可见画面、影响最终像素的具体描述。删除“精美”“高级”“震撼”“顶级”“杰作”“氛围感”等空泛质量修饰词，不要堆叠近义形容词；“风格锁定：”后面必须是可操作的视觉词，而不是评价。
11. 在 avoid 中补充当前图像最容易发生的风格漂移，例如错误媒介、错误时代或审美、错误明暗时段、错误色彩体系、错误材质反光或过度磨皮；只写与图片相关的偏差。
12. 不要输出主图、详情页、SKU、直播、移动端缩略图等用途建议，不要评价图片适合做什么，也不要提供融合或改图建议。
13. 不要编造图片中不存在的品牌、文字、人名、艺术家、相机原始元数据或敏感身份。`;

export const REFERENCE_ORCHESTRATION_MODE = "reference-orchestration";
export const CREATION_REFERENCE_ANALYSIS_MODE = "creation-reference-analysis";
export const PORTRAIT_REFERENCE_ANALYSIS_MODE = "portrait-reference-analysis";
const REFERENCE_ORCHESTRATION_INSTRUCTION = `你是一个参考图编排 agent。请分析用户上传的 1 到 6 张参考图，判断图片之间最合理的创作关系，并生成 1 到 3 条可直接用于图片生成的目标语言场景提示词。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. 先判断每张参考图的角色，例如人物主体、服装、裤子、配饰、背景、姿态、商品、风格参考或构图参考。
3. 多图时必须优先判断关系，例如人物 + 服装、主体 + 背景、商品 + 场景、风格图 + 内容图、多主体 + 场景。
4. 你会收到按顺序标注的参考图 1、参考图 2 等内容标签；必须逐张分析并覆盖所有参考图，不要只分析第一张。
5. prompts 必须包含 1 到 3 条结果；关系明确时给 1 条，存在明显不同场景或动作时给 2 到 3 条。
6. 每条 prompt 都要包含主体、参考图关系、场景、动作或姿态、镜头、光线、画面融合要求和必要限制。
7. 主体保真优先于融合创意；同一商品或同一产品主体必须保持不变，不要改成新主体、替换品类、改变核心结构或生成参考图中没有的主商品。
8. 不得新增或编造参考图中不存在的人、动物、物体、配件或可售商品；只有明确出现在参考图中的对象才能进入 prompt。
9. 电商商品参考图中，说明图、规格图、局部特写、不同状态图只能作为结构、细节或信息参考，不能当成新主体，也不得把不同状态混成同一画面状态。
10. 如果关系不明确，请在 risks 中说明待确认点，并让 prompt 保持保守，不要强行指定归属。
11. 不要识别或编造真人身份、姓名、年龄、品牌、地点或图片中不存在的敏感信息。`;

const CREATION_REFERENCE_ANALYSIS_INSTRUCTION = `你是电商视觉营销专家，负责商品分析、目标买家洞察、成交理由提炼和套图视觉策划。请在同一次识别中分析用户上传的 1 到 ${MAX_CREATION_REFERENCE_IMAGES} 张电商套图参考图，判断素材用途、商品事实和创意场景，并返回 JSON。你的分析要回答谁会买、为什么买、在什么具体场景需要它、有什么购买犹豫，以及怎样用画面和商品证据促成购买决策。

要求：
1. 只返回 JSON，不要返回 Markdown、代码块或解释。
2. 必须逐张分析并覆盖所有套图参考图，不要只分析第一张。
3. reference_roles 必须按输入顺序返回，每张图只能选择一个 role。
4. role 只能是 product、reference-product、package、material、feature、dimensions、usage、scene、other：
   - product = 商品主体，仅用于独立白底主图、正面主体图、可售 SKU 色款或需要作为商品身份锚点的清晰主体图。
   - reference-product = 参考主体，仅在用户明确指定一张全套主主体锚点时使用；它与 product 一样属于商品身份参考，最多保留一张。
   - package = 包装清单，用于锁定包装、配件、套装和用户实际收到的物品。
   - material = 材质结构细节，用于锁定材质质感、纹理、表面、边缘工艺、外观结构、做工、部件结构和细节说明；不要当成商品主体或单独可售 SKU，也不要把功能效果写进此类。
   - feature = 功能卖点，用于锁定图片中有可见证据的功能、工作机制、效果表现、卖点拆解或功能标注，包括续航、加热温度/档位、模式数量、快充和按键控制等功能证据；只能保留图片和商品事实支持的内容，不得编造性能，也不要当成使用步骤或单独可售 SKU。
   - dimensions = 尺寸规格，用于锁定尺寸表、尺码卡、长宽高、重量、容器容量、钩号、型号、适配/兼容性等静态规格事实；不要把续航、加热温度/档位、模式数量或快充卖点仅因带数字就归入此类，也不要当成单独可售 SKU。
   - usage = 使用说明，用于锁定实际的安装、装配、操作、充电、连接、接线、正负极、步骤、注意事项和说明性箭头标注；仅说明支持 Type-C 快充、一键控制或其他功能优势而没有步骤流程时，应归入 feature；不要当成商品主体或单独可售 SKU。
   - scene = 使用场景，用于锁定环境、尺度、使用方式和生活化摆放。
   - other = 仅在无法归类时使用。
4.1 如果图片主要展示包装清单、配件、套装、内含物或用户实际收到的物品，必须选择 role=package；即使同时出现尺寸、型号、重量、长度等规格数字，也不要改成 dimensions。
5. 如果图片是尺寸表、尺码卡、静态规格表或主要展示长宽高、重量、容器容量、钩号、型号、适配/兼容性等文字，必须选择 role=dimensions，并在 note 中逐项抄写所有可辨认的具体规格，保留原始数字、单位和符号，例如“型号 F4J16、长度 13cm、重量 42g、钩号 2#”；看不清的文字写入 risks，不能只写“长度感”“比例”等概括。续航时长、加热温度/档位、模式数量、快充和按键控制属于功能证据，即使带数字也优先选择 role=feature；只有它们作为更大综合规格表中的普通一行时，才可随整张表归 dimensions。如果同一张图同时展示多个颜色、尺码、型号或大小变体，必须在 dimension_groups 中按变体分别返回尺寸事实，并给每组填写可辨认的 label/variant/size/color 以及能可靠绑定的 reference_indexes 或 filenames；不得把不同组的数值合并到 note 或任意一组。
6. 如果图片是使用说明、操作指南、充电指南、安装步骤、连接/接线示意、正负极标注、注意事项或用箭头/编号说明实际操作流程，必须选择 role=usage；只有“支持 Type-C 快充”“一键控制”等功能标题而没有步骤顺序时，选择 role=feature。即使图中出现商品，也不要归为 product，也不要为它创建 sku_subjects。
6.1 如果图片主要是外观结构说明、材质纹理放大、边缘工艺、部件结构标注或细节说明，选择 role=material；即使图中有完整商品，也不要归为 product，也不要为它创建 sku_subjects。
6.2 如果图片主要是功能卖点拆解、功能效果展示、工作机制/结果证据或功能标注（例如 LED 照明、过滤、收纳、发光、感应、防水、续航、加热温度档位、快充等可见功能），选择 role=feature；只记录可见且有依据的功能，不要与纯结构细节、静态尺寸规格或实际操作步骤混淆。
7. note 使用简短的简体中文事实句：主体图优先说明可售单位、画面各位置的视角/表面及各自专属部件、开合状态；每项只写一次，不用“适合主图/SKU对比”等用途建议替代结构信息。单图说明以80–180个汉字为目标，必要事实完整保留。
8. category_hint 写出最可能的四级类目名称；如果无法判断到四级类目，返回空字符串。
9. category_path 写出可判断的完整类目路径；如果无法判断，返回空字符串。
10. risks 写出不确定点，例如产品身份不清、包装缺失、参考图互相冲突或文字不可辨认。
11. 根据用户选择的平台和识别到的商品类型，补充哪些参考信息最适合用于平台化套图生成，例如主图识别、详情页信息、SKU 对比、直播讲解、移动端缩略图或规格核对；不要输出视觉语言建议。
12. audience_strategy 只描述与商品使用或购买决策直接相关的非敏感目标语境、购买动机、购买顾虑、期望结果、证据依据和置信度；不得从人物外观推断年龄、性别、种族、民族、国籍、宗教、健康、残障、怀孕、性取向、收入或其他敏感属性，不得使用地域或文化刻板印象。
13. audience_strategy 中的动机、顾虑、结果和证据必须来自用户提供的商品事实、可见商品/使用证据以及平台与类目上下文；证据不足时使用通用类目买家、confidence=low 和 source=analysis-suggestion，不得编造性能、认证、价格、销量、保证、评价或效果。
14. product_insights.appearance_locks 只从用户指定的 reference-product 主体图提取；没有指定时用第一张清晰商品主体图。逐项锁定颜色、覆盖范围、开口/翻盖状态、按键/控制器位置、纹理、缝线与可售数量。辅助说明图不能改变主主体外观，不要把全指手套改成露指手套或替主图打开翻盖。
14.1 先判断同一商品的多视角、同一配对商品的两只、不同SKU、不同开合状态，再决定可售数量；展示视角数量不等于可售单位数量。画面左右只指图片位置，不等于左右手，不能由左右并列推断“一左一右”。例如一正一反的手套应分别描述画面左侧掌面与画面右侧手背；掌面蜂窝纹、拇指/食指翻盖状态、手背HOT字样、控制器显示窗和下方按键分别绑定到实际可见表面，不能合并到同一表面、互相复制或镜像拼接。只有图中确实存在这些细节时才采用此例，不把示例事实套给其他商品。
14.2 appearance_locks 用3–6条短句覆盖关键结构（复杂商品最多10条），一条一个表面/部件关系，每条尽量不超过100个汉字，不重复营销信息。保持可见的开合/覆盖状态；未知视角、未见表面与无法确认的左右手/件数关系写unknowns/risks，不能靠品类常识补造。显示窗出现55只说明可见数字，不自动解释为55°C温度、档位、续航或温度上限。
15. confirmed_facts 每项有唯一 id、text、kind、source 和 reference_indexes。只记可见/可读事实，source=reference 逐项标来源图序号。source=user 的 text 必须逐字摘自本次商品名称/描述，reference_indexes=[]。数字、温度、档位、时长、电池、尺寸、材质成分和认证不能靠外观推断。无法确定写 unknowns。
16. 同一商品的不同参考图默认提供互补信息。仅当同一商品、同一属性在相同条件下有两个明确互斥的值或结构时写 conflicts；fact_ids 只列真正矛盾的事实，claims 逐字列出双方原文（包括商品描述/参考备注中的原文短语），reference_indexes 标记来源。每项 conflicts 必须提供至少两个 comparisons，每项写 subject（同一商品/款式）、attribute（同一属性名）、condition（相同操作/测量条件，未注明时空字符串）和 value（可比较的值或结构）；同义属性与等价单位统一后比较，实际等价的值不冲突。只有真正冲突的事实不能作为买点或场景依据。
16.1 图1/图2标示电池3000mAh，图3标示45°C续航6小时，是不同属性的互补信息，应各自进入 confirmed_facts 并保留来源；没有相反信息时可以用于同一商品的套图，无需每张图重复全套参数，也无需外部检测才能采用原图可读信息。不同档位的温度和续航、不同款式的容量或尺寸分别保留条件和分组；缺少信息、未重复标示、无法独立核实准确性或无法确认额外对应关系均不等于冲突。只把确实不清楚的关联写入 unknowns，保留各自已读事实；不由电池容量推算续航，不把未注明的档位、型号或电池条件强行绑定。辅助图可以补充功能参数，但不改变主主体外观。
17. selling_points 和 pain_points 使用 id、text、fact_ids，均绑定至少一个明确事实；它们是购买理由/使用顾虑的分析推断，不能把顾虑写成已证实功效、缺陷或夸大前后对比。
18. usage_scenarios 提供 6–12 个适合该商品的候选场景（适用范围窄时宁少勿凑），每个有不同的 environment + action + framing、fact_ids、pain_point_ids。环境和动作具体到实际任务，不能只换背景；优先商品、手部操作或局部穿戴，people 只能 none/hands/partial-body，不指定年龄性别或人物正脸。道具只是使用语境，不能变成赠品或兼容性声明。
19. 从商品用途发散场景，例如手套可考虑通勤握把、户外操作相机、牵引遛狗、岸边垂钓、营地整理装备、寒冷工作台等，但只有与当前商品可见结构和可靠用途相符时才采用，不能由场景反推防水、加热或安全防护性能。其他品类按真实用途分析，不套用手套模板。
20. 不要让每张图重复全部买点。为主视觉、细节证据、使用动作、使用顾虑、收纳准备分别提供可分配的信息，供后续整套规划使用。
21. usage_scenarios 每项必须提供 action_group，标识交互对象与核心操作。同一手机上的查看消息、查看地图、点按手机相机都用 phone-operation，不得靠换环境、手机应用、标题、镜头或准备前后拆组。同一事实可以支持不同核心操作，例如操作独立相机、握车把、握牵引绳分别分组。没有其他可靠用途时少给场景，不编造同义候选凑数量。
22. product_insights.marketing_recommendations 是分析师提供的营销建议，使用 id、text、fact_ids，每条引用至少一个 confirmed_facts 中的有效事实。建议内容必须用简体中文，资料充分时提供 3–6 条不同建议，资料有限时宁少勿凑，无法支持时返回空数组。每条 text 说明具体营销重点、对应的购买动机或顾虑以及可执行的画面表达，例如“突出可见腕部调节结构，用调节动作近景表现穿戴细节”。根据当前商品分析，不套用示例；不要只写“突出卖点”“提高转化”，不要机械重复 selling_points，不用默认买家语境冒充分析，也不要改变全套视觉语言。画面建议应能适配相应主视觉、细节、场景或卖点任务，不能编造温度、续航、认证、配件、效果或夸大收益；不同建议不要让每张图重复同一画面。
23. product_insights.audience_segments 按真实用途和需求细分主次目标买家，资料充分时给 3–6 组。每组有 id、name、context（具体使用或购买场景）、need、purchase_trigger、objection、priority（primary/secondary）和 fact_ids。不能只写“此类商品的买家”“户外人群”，也不能把同一人群换词拆成多组；应明确实际任务和差异，例如商品确实适用时区分冬季骑行通勤、户外相机操作、遛狗牵引、营地装备操作等。群体必须符合本商品结构与用途，并用简体中文说明，不从人物外观推断人口属性。
24. 资料充分时 selling_points 提炼 4–8 条“商品依据 → 买家价值”，pain_points 提炼 3–6 条“具体使用困扰或购买阻碍 → 有依据的回应”。不要只罗列外观属性，或只重复“规格不清、是否适合”。区别用户可能遇到的困扰与已证实的商品性能；资料不足时如实减少并写 unknowns，不凑空泛条目。`;

const CREATION_REFERENCE_ANALYSIS_SKU_INSTRUCTION = [
  "SKU grouping: also return sku_subjects. Each sku_subjects item must represent one sellable product subject group for one added SKU image.",
  "If one product-subject reference image contains multiple complete visible product units, colorways, finishes, or model variants, keep those units together as one sku_subject that uses that source filename; do not split them into multiple sku_subjects.",
  "Set sku_subjects[].subject_unit_count to the evidenced sellable unit count, independently of the number of displayed views. Front/back views of one subject do not create additional units; image-left/image-right is not left-hand/right-hand evidence. Preserve observed surface-specific details and opening states in the note; report uncertain piece relationships in risks.",
  "Count sellable units, not visible parts. A product sold as one matched left-plus-right pair — gloves, mittens, shoes, boots, socks, slippers, earrings, earbuds, wrist guards, knee pads, ski poles — is 1 complete product unit even when both pieces sit side by side, so subject_unit_count stays 1 and color_names holds one label for the whole pair, for example black or black grey.",
  "已确认成对售卖的左右套装（手套、鞋、袜、耳环、护腕等）一双就是 1 个完整产品单位；note 将按双计数与展示视角分开说明，不因画面左右并列就强写“左右各一只”。只有明确出现两双及以上时才按多双计数，例如四只手套组成两双写“2 个完整产品单位”。",
  "For every sku_subject, return sku_subjects[].color_names with exactly one concise English pure-color label per complete visible product unit, in the same left-to-right or top-to-bottom order as those units. Each unit label may contain color names, spaces, and internal hyphens only, for example brown black silver or off-white. Preserve a hyphen inside a recognized compound color name. Separate colors with single spaces and never use a hyphen as a separator between independent colors. Use no other punctuation: no commas, quotation marks, slashes, brackets, bullets, or other symbols. It must not include component names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or any other non-color text. Keep all reliable colors for one product unit together inside one array string, including neutral colors shared by variants, but omit the associated part words. Do not split one unit's colors into multiple color_names items. Exclude the white/transparent background, shadows, highlights, environmental reflections, source-card text, and uncertain colors. If safe pure-color labels cannot be supplied for every complete unit in the group, return an empty color_names array and never guess.",
  "Distinguish visibly different colorways precisely, for example navy blue versus cyan or sky blue, and orange versus red; never copy an unrelated visible word such as white as the color result.",
  "In sku_subjects[].note, explicitly record the visible product unit count and the visible differences that must be preserved in the one SKU image. Group multiple photos of the same subject group into one item.",
  "Ordinary white-background SKU/colorway images, including source images that show two or more complete products in one frame, must use role=product and not role=reference-product.",
  "Use role=reference-product only for exactly one optional 参考主体 image when the image is explicitly the set-wide primary subject anchor; it keeps the same generation mode as role=product and must still be treated as a product subject for SKU grouping and generation references. Use role=product for ordinary 商品主体 images and additional sellable SKU subjects.",
  "For product and reference-product roles, reference_roles[].note must include the same exact visible product unit count that you put in sku_subjects[].subject_unit_count and sku_subjects[].note whenever the source image shows multiple complete product units.",
  "Never describe two stacked, side-by-side, top/bottom, or paired complete independently sold duplicates as 1 unit; 当同一张白底商品主体图里有上下、左右或成对的两个完整路亚/鱼饵时，reference_roles[].note 和 sku_subjects[].note 都必须写清“2 个完整产品单位”，不要写成“单个”或“单一”，也不要写“画面为1个完整产品单体”或“画面为1个完整产品单位”。成对售卖的左右套装不适用这一条：手套、鞋、袜等一双仍写 1 个完整产品单位。",
  "Use role=package for package lists, packaging, included items, accessories, bundles, or what the shopper receives, even if the same image contains size, model, length, or weight text.",
  "Use role=dimensions for physical size charts, static specification tables, size cards, or references focused on length, width, height, weight, container capacity, hooks, model numbers, fit, or compatibility. Numeric runtime, heating temperature or mode settings, battery life, fast charging, and control benefits are feature evidence unless they are incidental rows in a broader static specification table.",
  "When one dimensions reference contains multiple colors, sizes, models, or product units, return one reference_roles[].dimension_groups entry per reliable variant group with its own label and exact specs, and bind each group using reference_indexes or filenames whenever the source supports it. Never cross-pair values between groups; leave a group unbound rather than guess.",
  "Use role=usage for actual instruction guides, user manuals, setup sequences, operation diagrams, charging steps, connection/polarity diagrams, positive/negative terminal callouts, or caution/step labels. A headline that only advertises Type-C fast charging or one-button control is feature evidence, not a usage procedure.",
  "Use role=material for exterior-structure callouts, annotated component/detail diagrams, material texture references, and references focused on visible structure details rather than a sellable SKU.",
  "Use role=feature for feature selling-point callouts, functional effect demonstrations, mechanism/benefit evidence, and functional annotations rather than a sellable SKU; preserve only visibly supported claims.",
  "Treat text outside the physical product as non-subject overlay: ignore corner badges, stickers, price tags, product-card captions, bottom SKU/color text blocks, title bars, watermarks, and words such as 2025 NEW or WHITE EDIT when deciding what the SKU subject must preserve.",
  "sku_subjects[].note should describe only the sellable product subject group plus intrinsic product-surface logos, model identifiers, markings, materials, color, shape, structure, and visible product unit count.",
  "When role=dimensions, transcribe every readable model, size, weight, hook number, capacity, and compatibility value into reference_roles[].note.",
  "Do not create SKU subjects for accessories, packaging-only images, material/detail/structure-only closeups, feature selling-point references, dimensions/specification/size-chart references, usage/instruction references, scenes.",
].join(" ");

const CREATION_REFERENCE_ANALYSIS_PRODUCT_NAME_INSTRUCTION =
  "Product naming: first identify the main sellable product subject in the reference set, then put that subject name in product_name. product_name must be the analyzed subject's concise ecommerce product name, not a category path or a generic word like product. Do not include brand names in product_name, even if they are visibly readable. Retain a model identifier only when it is part of the product identity; otherwise return a concise generic ecommerce product name such as 'jointed fishing lure'. Do not leave product_name empty.";

const PORTRAIT_REFERENCE_ANALYSIS_INSTRUCTION = `You are a portrait task reference analysis agent. Analyze the uploaded portrait reference set and return one strict JSON object for a portrait photography workflow.

Requirements:
1. Return JSON only. Do not return Markdown, code fences, or commentary.
2. Describe only visible presentation and visual cues that are useful for portrait generation.
3. Use visiblePresentation with exactly one of: masculine-presenting, feminine-presenting, androgynous-presenting, unclear.
4. Use heightImpression only as a low-confidence visual impression. If the full body or scale context is insufficient, return unclear.
5. Use bodyBuild with neutral low-granularity wording such as slim, average, broad, curvy, plus-size, unclear.
6. Include pose, clothing, hair, faceVisibility, distinctVisibleFeatures, referenceRoles, risks, safety, and confidence.
7. Respect each image's label: person references are for visible person identity and presentation, action references are pose-only guidance, and clothing/prop/accessory references are styling-only guidance.
8. Do not treat action or styling references as additional people.
9. Do not infer real age, race, ethnicity, nationality, religion, health, disability, pregnancy, sexual orientation, real identity name, or other sensitive personal attributes.
10. If adult status is unclear, safety must say to use ordinary portrait or lifestyle styling and avoid sexualized, nude, lingerie, or adult-oriented direction.
11. Keep the summary editable and conservative, suitable for user confirmation before image generation.`;

export const PROMPT_AGENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "framing", "scene", "visual", "avoid"],
  properties: {
    subject: {
      type: "object",
      additionalProperties: false,
      required: ["type", "pose", "expression", "appearance", "clothing", "interaction"],
      properties: {
        type: {
          type: "string",
          description: "画面主要人物、商品、动物、建筑或其他核心对象的简洁类型。",
        },
        pose: {
          type: "string",
          description: "主体的姿态、朝向、动作；静物则描述摆放方式和可见状态。",
        },
        expression: {
          type: "string",
          description: "人物或动物的可见表情；不适用时返回空字符串。",
        },
        appearance: {
          type: "array",
          items: { type: "string" },
          description: "逐项记录会影响复原的外观、形状、颜色、材质和细节。",
        },
        clothing: {
          type: "string",
          description: "可见服装、鞋履和佩戴物；不适用时返回空字符串。",
        },
        interaction: {
          type: "string",
          description: "主体与手机、道具、家具、其他主体或环境的可见交互；没有时返回空字符串。",
        },
      },
    },
    framing: {
      type: "object",
      additionalProperties: false,
      required: [
        "aspect_ratio",
        "shot_size",
        "subject_scale",
        "placement",
        "negative_space",
        "foreground_frame",
        "camera",
        "angle",
        "crop",
        "perspective",
        "depth_of_field",
      ],
      properties: {
        aspect_ratio: {
          type: "string",
          description: "原图或最接近原图构图的明确横竖画幅比例。",
        },
        shot_size: {
          type: "string",
          description: "准确景别及入镜范围，例如带大量环境的全身远景或紧凑头肩近景。",
        },
        subject_scale: {
          type: "string",
          description: "主体高度、宽度或关键部位约占画面的百分比。",
        },
        placement: {
          type: "string",
          description: "主体中心和关键部位在画面中的具体位置，可使用近似百分比或三分法关系。",
        },
        negative_space: {
          type: "string",
          description: "画面留白的位置与约占比例；没有明显留白时返回空字符串。",
        },
        foreground_frame: {
          type: "string",
          description: "前景遮挡、门窗框、枝叶等框景关系及其清晰程度；没有时返回空字符串。",
        },
        camera: {
          type: "string",
          description: "用于生成复刻的相机建议：一个明确且单一的全画幅等效焦段，并包含匹配的拍摄距离、光圈和对焦目标；无可靠 EXIF 时不得冒充原始参数。",
        },
        angle: {
          type: "string",
          description: "机位高度、俯仰、正侧方向和是否隔着前景拍摄。",
        },
        crop: {
          type: "string",
          description: "画面边缘保留或截断的主体部位、环境物体和框体。",
        },
        perspective: {
          type: "string",
          description: "广角、中焦或长焦形成的空间展开、压缩和比例特征。",
        },
        depth_of_field: {
          type: "string",
          description: "对焦区域，以及前景、主体和背景分别清晰或虚化的关系。",
        },
      },
    },
    scene: {
      type: "string",
      description: "用一段精简中文描述背景环境、空间和会影响复原的关键物体。",
    },
    visual: {
      type: "string",
      description: "以“风格锁定：”开头的可复用视觉风格段，优先保留源图最具辨识度的媒介、审美、色彩、用光和材质锚点，再写镜头景深与后期；适用时包含一次“4K/8K级超高清成像质感”作为视觉目标，以及自然清晰的主体焦点、可见纹理和干净层次。不得泛化风格、过度锐化、虚构细节，或承诺实际输出像素。",
    },
    avoid: {
      type: "array",
      items: { type: "string" },
      description: "仅列出针对当前图片的高影响复原偏差，不包含通用质量词。",
    },
  },
};

export const REFERENCE_ORCHESTRATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "image_roles", "relationship", "prompts", "risks"],
  properties: {
    title: {
      type: "string",
      description: "本次参考图编排的短标题，使用目标语言。",
    },
    summary: {
      type: "string",
      description: "一句话说明识别出的组合关系和创作方向。",
    },
    image_roles: {
      type: "array",
      items: { type: "string" },
      description: "逐张说明参考图角色，例如图 1：女性主体、图 2：裤装。",
    },
    relationship: {
      type: "string",
      description: "参考图之间的关系判断，例如人物穿搭、主体融入背景、商品场景化。",
    },
    prompts: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "intent", "prompt"],
        properties: {
          title: {
            type: "string",
            description: "单条提示词标题。",
          },
          intent: {
            type: "string",
            description: "这条提示词的使用意图。",
          },
          prompt: {
            type: "string",
            description: "可直接用于图片生成的完整目标语言提示词。",
          },
        },
      },
      description: "1 到 3 条可应用到主提示词框的编排提示词。",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "不确定点、需要用户确认的关系或生成时需要规避的问题。",
    },
  },
};

export const CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "product_name", "category_hint", "category_path", "reference_roles", "sku_subjects", "audience_strategy", "product_insights", "risks"],
  properties: {
    product_insights: CREATION_PRODUCT_INSIGHTS_JSON_SCHEMA,
    summary: {
      type: "string",
      description: "一句话概括本组套图参考图的商品信息、可用素材和主要限制。",
    },
    product_name: {
      type: "string",
      minLength: 1,
      description: "The identified main sellable product subject name to fill the Creation Mode product name field. Use the analyzed subject's concise ecommerce product name, not a category path. Do not include brand names, even when they are visibly readable; retain a model identifier only when it is part of the product identity.",
    },
    category_hint: {
      type: "string",
      description: "最可能匹配的四级类目名称；无法判断时返回空字符串。",
    },
    category_path: {
      type: "string",
      description: "最可能匹配的完整类目路径；无法判断时返回空字符串。",
    },
    reference_roles: {
      type: "array",
      minItems: 1,
      maxItems: MAX_CREATION_REFERENCE_IMAGES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "filename", "role", "note", "dimension_groups"],
        properties: {
          index: {
            type: "integer",
            minimum: 1,
            maximum: MAX_CREATION_REFERENCE_IMAGES,
            description: "参考图输入序号，从 1 开始。",
          },
          filename: {
            type: "string",
            description: "对应参考图文件名。",
          },
          role: {
            type: "string",
            enum: ["product", "reference-product", "package", "material", "feature", "dimensions", "usage", "scene", "other"],
            description: "推荐的套图参考用途。",
          },
          note: {
            type: "string",
            description: "这张参考图应该影响生成结果的重点说明，使用简体中文。若 role=dimensions，必须逐项写入可辨认的具体规格原文，例如：型号 F4J16、长度 13cm、重量 42g、钩号 2#。若 role=usage，写清可见步骤、箭头、连接方式、正负极或注意事项。若 role=material，写清外观结构、材质纹理、部件结构或细节说明；若 role=feature，写清有可见证据的功能、机制、效果或卖点标注，不得编造性能；任何情况下不要写成商品主体。",
          },
          dimension_groups: {
            type: "array",
            maxItems: 32,
            description: "当一张尺寸参考图包含多个颜色、尺码、型号或产品单位时，按变体分组保留尺寸事实；每组只能包含属于该组的数值，优先提供 reference_indexes 或 filenames 绑定。没有可靠分组时返回空数组。",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "variant", "color", "size", "reference_indexes", "filenames", "specs", "note"],
              properties: {
                id: { type: "string", description: "稳定的变体尺寸组标识；无法可靠命名时返回空字符串。" },
                label: { type: "string", description: "该变体、颜色、尺码或型号的简短标签；无法判断时返回空字符串。" },
                variant: { type: "string", description: "变体名称；不适用时返回空字符串。" },
                color: { type: "string", description: "颜色名称；不适用时返回空字符串。" },
                size: { type: "string", description: "尺码名称；不适用时返回空字符串。" },
                reference_indexes: {
                  type: "array",
                  items: { type: "integer", minimum: 1, maximum: MAX_CREATION_REFERENCE_IMAGES },
                  description: "能确认属于该变体的参考图输入序号；无法绑定时返回空数组。",
                },
                filenames: {
                  type: "array",
                  items: { type: "string" },
                  description: "能确认属于该变体的参考图文件名；无法绑定时返回空数组。",
                },
                specs: {
                  type: "array",
                  items: { type: "string" },
                  description: "该变体的逐项尺寸/重量规格原文，例如 Length 12 cm、Width 5 cm。",
                },
                note: { type: "string", description: "该变体尺寸证据的补充说明；没有补充说明时返回空字符串。" },
              },
            },
          },
        },
      },
      description: "逐张参考图的用途建议，必须按输入顺序返回。",
    },
    sku_subjects: {
      type: "array",
      maxItems: MAX_CREATION_REFERENCE_IMAGES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "reference_indexes", "filenames", "subject_unit_count", "color_names", "note"],
        properties: {
          id: {
            type: "string",
            description: "Stable short id for this distinct sellable SKU subject.",
          },
          title: {
            type: "string",
            description: "Short display name for this SKU subject.",
          },
          reference_indexes: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
              maximum: MAX_CREATION_REFERENCE_IMAGES,
            },
            description: "Input reference image indexes that show this same sellable product subject.",
          },
          filenames: {
            type: "array",
            items: { type: "string" },
            description: "Reference filenames that show this same grouped sellable product subject.",
          },
          subject_unit_count: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Exact count of complete visible product units inside this grouped sellable product subject. Count sellable units rather than visible pieces: use 1 for a single complete product unit, including one matched left-plus-right pair such as a pair of gloves or shoes, and count pairs only when the image clearly shows more than one pair.",
          },
          color_names: {
            type: "array",
            minItems: 0,
            maxItems: 20,
            items: { type: "string" },
            description: "Exactly one concise English pure-color label per complete visible product unit, ordered left-to-right or top-to-bottom, or an empty array when safe labels are unavailable for the complete group. A matched pair counted as one unit uses one label for both pieces, such as black or black grey. Each label may contain multiple reliable colors but only color names, spaces, and internal hyphens inside recognized compound colors such as off-white. Use single spaces between independent colors; do not use hyphens as color separators or include commas, quotation marks, slashes, brackets, bullets, or other punctuation. Do not include component names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or other non-color text. Preserve each complete unit label as one array item. Exclude backgrounds, shadows, highlights, environmental reflections, overlay text, and uncertain colors.",
          },
          note: {
            type: "string",
            description: "What must be preserved for this SKU image subject group, including visible product unit count when one source image contains multiple complete product units, and saying that left and right pieces form one pair when the subject is sold as a pair; exclude source-image overlay text outside the physical product.",
          },
        },
      },
      description: "Distinct sellable product subjects that should receive added SKU background images.",
    },
    audience_strategy: {
      type: "object",
      additionalProperties: false,
      required: ["target_audience", "purchase_motivations", "purchase_objections", "desired_outcome", "evidence_basis", "confidence", "source"],
      properties: {
        target_audience: {
          type: "string",
          description: "Non-sensitive product-use or purchase context, never an inferred protected demographic.",
        },
        purchase_motivations: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Evidence-backed purchase motivations from supplied product facts or visible use context.",
        },
        purchase_objections: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Conservative buyer uncertainties that the supplied evidence can address.",
        },
        desired_outcome: {
          type: "string",
          description: "Buyer outcome supported by the supplied facts without invented claims.",
        },
        evidence_basis: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description: "Supplied or visible facts supporting the audience suggestion.",
        },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        source: { type: "string", enum: ["analysis-suggestion"] },
      },
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "不确定点、需要用户确认的关系或生成时需要规避的问题。",
    },
  },
};

export const PORTRAIT_REFERENCE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "visiblePresentation",
    "heightImpression",
    "bodyBuild",
    "pose",
    "clothing",
    "hair",
    "faceVisibility",
    "distinctVisibleFeatures",
    "referenceRoles",
    "risks",
    "safety",
    "confidence",
  ],
  properties: {
    summary: {
      type: "string",
      description: "Editable visible portrait draft for user confirmation.",
    },
    visiblePresentation: {
      type: "string",
      enum: ["masculine-presenting", "feminine-presenting", "androgynous-presenting", "unclear"],
      description: "Visible presentation label based on styling and appearance cues.",
    },
    heightImpression: {
      type: "string",
      description: "Low-confidence visual height impression; use unclear when scale context is limited.",
    },
    bodyBuild: {
      type: "string",
      description: "Neutral low-granularity body shape impression.",
    },
    pose: {
      type: "string",
      description: "Visible pose, gesture, and framing cues.",
    },
    clothing: {
      type: "string",
      description: "Visible wardrobe and accessory cues.",
    },
    hair: {
      type: "string",
      description: "Visible hair style, length, and color cues.",
    },
    faceVisibility: {
      type: "string",
      description: "How clearly the face is visible and usable as a reference.",
    },
    distinctVisibleFeatures: {
      type: "array",
      items: { type: "string" },
      description: "Visible non-sensitive details useful for preserving likeness.",
    },
    referenceRoles: {
      type: "array",
      items: { type: "string" },
      description: "How each uploaded reference should be used in the portrait set.",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "Unclear points that need user review.",
    },
    safety: {
      type: "string",
      description: "Generation safety guidance for the portrait planner.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high", "unclear"],
      description: "Overall confidence of the visible draft.",
    },
  },
};

function normalizeImage(image) {
  if (!image || typeof image !== "object") {
    throw new Error("请先上传一张图片。");
  }

  const mimeType = String(image.mimeType || "").trim() || "image/png";
  const base64 = normalizeBase64(String(image.base64 || ""));

  if (!base64) {
    throw new Error("图片内容为空。");
  }

  return {
    filename: String(image.filename || "uploaded-image").trim(),
    mimeType,
    base64,
  };
}

function normalizeImages({ image, images } = {}) {
  const list = Array.isArray(images) && images.length > 0 ? images : image ? [image] : [];
  if (list.length === 0) {
    throw new Error("请先上传一张图片。");
  }

  return list.map(normalizeImage);
}

function buildPromptAgentImageLabel({ filename, index, mode }) {
  if (mode === PORTRAIT_REFERENCE_ANALYSIS_MODE) {
    return `写真人物参考图 ${index + 1}：${filename}。请按此序号分析这张图的可见人物呈现、姿态、服装、发型和可用于写真生成的参考作用。`;
  }

  if (!mode) {
    return `待分析图片 ${index + 1}：${filename}。请只根据这张图片反推一份主体和景别详细、背景与视觉精简且无同义重复的结构化生图 JSON。`;
  }

  const label =
    mode === CREATION_REFERENCE_ANALYSIS_MODE
      ? "套图参考图"
      : mode === REFERENCE_ORCHESTRATION_MODE
        ? "参考图"
        : "待分析图片";
  return `${label} ${index + 1}：${filename}。请按此序号分析这张图片的角色、内容和可融合元素。`;
}

function buildPromptAgentImageContent({ normalizedImages, mode, imageLabels = [] }) {
  const labels = Array.isArray(imageLabels) ? imageLabels : [];
  return normalizedImages.flatMap((normalized, index) => [
    {
      type: "input_text",
      text:
        String(labels[index] || "").trim() ||
        buildPromptAgentImageLabel({
          filename: normalized.filename,
          index,
          mode,
        }),
    },
    {
      type: "input_image",
      image_url: `data:${normalized.mimeType};base64,${normalized.base64}`,
    },
  ]);
}

function buildStrictJsonRetryInstruction(mode) {
  const format = getPromptAgentSchema(mode);
  const requiredKeys = Array.isArray(format.schema?.required) ? format.schema.required.join(", ") : "";
  return [
    "The previous model output was not parseable JSON.",
    `Return exactly one JSON object matching the ${format.name} schema.`,
    requiredKeys ? `Required top-level keys: ${requiredKeys}.` : "",
    "Do not include Markdown, code fences, explanations, bullet lists, or prose outside the JSON object.",
    "The first character must be { and the last character must be }.",
  ]
    .filter(Boolean)
    .join(" ");
}

function getPromptAgentInstruction(mode, targetLanguage, targetLanguageLabel) {
  if (mode === CREATION_MARKETING_PLAN_MODE) {
    return `${CREATION_REFERENCE_ANALYSIS_INSTRUCTION}\n${CREATION_REFERENCE_ANALYSIS_SKU_INSTRUCTION}\n${CREATION_MARKETING_PLAN_INSTRUCTION}`;
  }
  if (mode === PORTRAIT_REFERENCE_ANALYSIS_MODE) {
    return PORTRAIT_REFERENCE_ANALYSIS_INSTRUCTION;
  }

  if (mode === CREATION_REFERENCE_ANALYSIS_MODE) {
    return `${CREATION_REFERENCE_ANALYSIS_INSTRUCTION}\n${CREATION_REFERENCE_ANALYSIS_PRODUCT_NAME_INSTRUCTION}\n${CREATION_REFERENCE_ANALYSIS_SKU_INSTRUCTION}`;
  }

  if (mode === REFERENCE_ORCHESTRATION_MODE) {
    return `${REFERENCE_ORCHESTRATION_INSTRUCTION}\n\n${buildReferenceAnalysisLanguagePromptGuidance(targetLanguage, targetLanguageLabel)}`;
  }

  return PROMPT_AGENT_INSTRUCTION;
}

function getPromptAgentSchema(mode, contextPrompt = "") {
  if (mode === CREATION_MARKETING_PLAN_MODE) {
    let count = 0;
    try { count = Number(JSON.parse(contextPrompt).task_count); } catch {}
    const items = Number.isInteger(count) && count >= 1 && count <= 20
      ? { ...CREATION_MARKETING_ITEMS_SCHEMA, minItems: count, maxItems: count }
      : CREATION_MARKETING_ITEMS_SCHEMA;
    return { name: "creation_marketing_plan_json", schema: {
      ...CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA,
      required: [...CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA.required, "items"],
      properties: { ...CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA.properties, reference_roles: { ...CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA.properties.reference_roles, minItems: 0 }, items },
    } };
  }
  if (mode === PORTRAIT_REFERENCE_ANALYSIS_MODE) {
    return {
      name: "portrait_reference_analysis_json",
      schema: PORTRAIT_REFERENCE_ANALYSIS_JSON_SCHEMA,
    };
  }

  if (mode === CREATION_REFERENCE_ANALYSIS_MODE) {
    return {
      name: "creation_reference_analysis_json",
      schema: CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA,
    };
  }

  return mode === REFERENCE_ORCHESTRATION_MODE
    ? {
        name: "reference_orchestration_prompt_json",
        schema: REFERENCE_ORCHESTRATION_JSON_SCHEMA,
      }
    : {
        name: "image_prompt_json",
        schema: PROMPT_AGENT_JSON_SCHEMA,
      };
}

export function buildPromptAgentInput({
  image,
  images,
  imageLabels = [],
  mode,
  targetLanguage,
  targetLanguageLabel,
  contextPrompt = "",
  strictJsonRetry = false,
} = {}) {
  const normalizedImages = mode === CREATION_MARKETING_PLAN_MODE && !image && !images?.length ? [] : normalizeImages({ image, images });
  const content = [
    {
      type: "input_text",
      text: getPromptAgentInstruction(mode, targetLanguage, targetLanguageLabel),
    },
    ...(String(contextPrompt || "").trim()
      ? [
          {
            type: "input_text",
            text: String(contextPrompt || "").trim(),
          },
        ]
      : []),
    ...(mode === CREATION_MARKETING_PLAN_MODE ? [{
      type: "input_text",
      text: `本次是整套图片规划，不能仅返回商品分析。顶层 items 必须一次包含 task_count 条完整图片任务；以下是输出 JSON schema，即使接口忽略结构化输出参数也必须遵守：${JSON.stringify(getPromptAgentSchema(mode, contextPrompt).schema)}`,
    }] : []),
    ...buildPromptAgentImageContent({ normalizedImages, mode, imageLabels }),
  ];

  if (strictJsonRetry) {
    content.push({
      type: "input_text",
      text: buildStrictJsonRetryInstruction(mode),
    });
  }

  return [
    {
      role: "user",
      content,
    },
  ];
}

export function createPromptAgentRequestBody({
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  contextPrompt,
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  structuredOutput = true,
  strictJsonRetry = false,
}) {
  const body = {
    model: responsesModel,
    input: buildPromptAgentInput({
      image,
      images,
      imageLabels,
      mode,
      targetLanguage,
      targetLanguageLabel,
      contextPrompt,
      strictJsonRetry,
    }),
    reasoning: {
      effort: reasoningEffort,
    },
    stream: true,
  };

  if (structuredOutput) {
    const format = getPromptAgentSchema(mode, contextPrompt);
    body.text = {
      format: {
        type: "json_schema",
        name: format.name,
        strict: true,
        schema: format.schema,
      },
    };
  }

  return body;
}

function getPromptAgentChatResponseFormat(mode, contextPrompt) {
  const format = getPromptAgentSchema(mode, contextPrompt);
  return {
    type: "json_schema",
    json_schema: {
      name: format.name,
      strict: true,
      schema: format.schema,
    },
  };
}

function mapPromptAgentChatContentPart(part) {
  if (part?.type === "input_text") {
    return {
      type: "text",
      text: part.text || "",
    };
  }

  if (part?.type === "input_image") {
    return {
      type: "image_url",
      image_url: {
        url: part.image_url || "",
      },
    };
  }

  return null;
}

function buildPromptAgentChatMessages(options) {
  return buildPromptAgentInput(options).map((message) => ({
    role: message.role || "user",
    content: message.content.map(mapPromptAgentChatContentPart).filter(Boolean),
  }));
}

function createPromptAgentChatCompletionsRequestBody({
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  contextPrompt,
  responsesModel,
  structuredOutput = true,
  strictJsonRetry = false,
}) {
  const body = {
    model: responsesModel,
    messages: buildPromptAgentChatMessages({
      image,
      images,
      imageLabels,
      mode,
      targetLanguage,
      targetLanguageLabel,
      contextPrompt,
      strictJsonRetry,
    }),
  };

  if (structuredOutput) {
    body.response_format = getPromptAgentChatResponseFormat(mode, contextPrompt);
  }

  return body;
}

function parseImageDataUrl(value) {
  const match = String(value || "").match(/^data:([^;,]+);base64,(.+)$/i);
  return {
    mimeType: match?.[1] || "image/png",
    data: normalizeBase64(match?.[2] || ""),
  };
}

function mapPromptAgentGeminiPart(part) {
  if (part?.type === "input_text") {
    return {
      text: part.text || "",
    };
  }

  if (part?.type === "input_image") {
    const imageData = parseImageDataUrl(part.image_url);
    return {
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.data,
      },
    };
  }

  return null;
}

function createPromptAgentGeminiRequestBody({
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  contextPrompt,
  responsesModel,
  imageModel,
  structuredOutput = true,
  strictJsonRetry = false,
}) {
  const body = {
    model: imageModel || responsesModel,
    contents: buildPromptAgentInput({
      image,
      images,
      imageLabels,
      mode,
      targetLanguage,
      targetLanguageLabel,
      contextPrompt,
      strictJsonRetry,
    }).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: message.content.map(mapPromptAgentGeminiPart).filter(Boolean),
    })),
    generationConfig: {
      responseModalities: ["TEXT"],
    },
  };

  if (structuredOutput) {
    body.generationConfig.responseMimeType = "application/json";
  }

  return body;
}

function isGeminiPromptAgentModel(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.includes("gemini") && (
    normalized.includes("image") ||
    normalized.includes("banana") ||
    normalized.includes("图像") ||
    normalized.includes("生图")
  );
}

function collectTextParts(value, parts = []) {
  if (!value || typeof value !== "object") {
    return parts;
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (
    (!value.type ||
      value.type === "output_text" ||
      value.type === "text" ||
      value.type === "response.output_text.done") &&
    typeof value.text === "string"
  ) {
    parts.push(value.text);
  }

  if (typeof value.content === "string") {
    parts.push(value.content);
  }

  // Relays fronting reasoning models sometimes deliver the answer in
  // `reasoning_content` while leaving `content` empty. Collect it after
  // `content` so a real answer is still preferred: callers try each part
  // separately, so a chain-of-thought part simply fails to parse and is skipped.
  if (typeof value.reasoning_content === "string") {
    parts.push(value.reasoning_content);
  }

  if (Array.isArray(value.choices)) {
    value.choices.forEach((choice) => {
      collectTextParts(choice?.message, parts);
      collectTextParts(choice?.delta, parts);
    });
  }

  if (Array.isArray(value.output)) {
    value.output.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.content)) {
    value.content.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.parts)) {
    value.parts.forEach((item) => collectTextParts(item, parts));
  }

  if (Array.isArray(value.candidates)) {
    value.candidates.forEach((candidate) => collectTextParts(candidate?.content || candidate, parts));
  }

  if (value.response && typeof value.response === "object") {
    collectTextParts(value.response, parts);
  }

  if (value.item && typeof value.item === "object") {
    collectTextParts(value.item, parts);
  }

  return parts;
}

function stripJsonFence(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

class PromptAgentJsonParseError extends Error {
  constructor(rawText, cause, message = "模型返回的内容不是有效 JSON。") {
    super(message, { cause });
    this.name = "PromptAgentJsonParseError";
    this.rawText = String(rawText || "");
  }
}

function isPromptAgentJsonParseError(error) {
  return error instanceof PromptAgentJsonParseError;
}

function extractBalancedJsonObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

function removeJsonTrailingCommas(text) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === ",") {
      let nextIndex = index + 1;
      while (nextIndex < text.length && /\s/.test(text[nextIndex])) {
        nextIndex += 1;
      }
      if (text[nextIndex] === "}" || text[nextIndex] === "]") {
        continue;
      }
    }

    result += character;
  }

  return result;
}

function parseJsonCandidate(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    // Models occasionally add a trailing comma even when asked for strict
    // JSON. Remove only commas immediately before a closing token; quoted
    // values are left untouched.
    const withoutTrailingCommas = removeJsonTrailingCommas(text);
    if (withoutTrailingCommas !== text) {
      return JSON.parse(withoutTrailingCommas);
    }
    throw error;
  }
}

function parseJsonObject(text, mode = "") {
  const cleaned = stripJsonFence(text);

  try {
    return parseJsonCandidate(cleaned);
  } catch (error) {
    let nestedError = error;
    for (let start = cleaned.indexOf("{"); start >= 0; start = cleaned.indexOf("{", start + 1)) {
      const candidate = extractBalancedJsonObject(cleaned, start);
      if (!candidate) {
        if (mode === CREATION_MARKETING_PLAN_MODE) break;
        continue;
      }

      try {
        return parseJsonCandidate(candidate);
      } catch (candidateError) {
        nestedError = candidateError;
      }
    }

    throw new PromptAgentJsonParseError(cleaned, nestedError);
  }
}

function toPromptAgentText(value) {
  // 网关不支持严格结构化输出时，模型可能把字符串字段回成对象或数组。
  // 直接 String(value) 会得到 "[object Object]"，这里按可见文本拼接。
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(toPromptAgentText).filter(Boolean).join("，");
  }
  if (value && typeof value === "object") {
    return Object.values(value).map(toPromptAgentText).filter(Boolean).join("，");
  }
  return "";
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(toPromptAgentText).filter(Boolean) : [];
}

function normalizeIntegerArray(value) {
  return Array.isArray(value)
    ? value.map((item) => Number.parseInt(String(item || "").trim(), 10)).filter((item) => Number.isFinite(item) && item > 0)
    : [];
}

const SUBJECT_UNIT_COUNT_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);
const CHINESE_SUBJECT_UNIT_COUNT_WORDS = new Map([
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function clampSubjectUnitCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.min(20, Math.round(value)) : 0;
}

function normalizeSubjectUnitCount(value) {
  const count = Number.parseInt(String(value || "").trim(), 10);
  return clampSubjectUnitCount(count) || 1;
}

function parseSubjectUnitCountToken(value) {
  const token = String(value || "").trim();
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return clampSubjectUnitCount(digitCount);
  }
  if (CHINESE_SUBJECT_UNIT_COUNT_WORDS.has(token)) {
    return clampSubjectUnitCount(CHINESE_SUBJECT_UNIT_COUNT_WORDS.get(token));
  }
  if (token.includes("十")) {
    const [left, right] = token.split("十");
    const tens = left ? CHINESE_SUBJECT_UNIT_COUNT_WORDS.get(left) || 0 : 1;
    const ones = right ? CHINESE_SUBJECT_UNIT_COUNT_WORDS.get(right) || 0 : 0;
    return clampSubjectUnitCount(tens * 10 + ones);
  }
  return 0;
}

function inferSubjectUnitCount(value = "") {
  const text = String(value || "").trim().toLowerCase();
  const digitMatch = text.match(/\b(\d+)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (digitMatch) {
    return clampSubjectUnitCount(Number.parseInt(digitMatch[1], 10));
  }
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (wordMatch) {
    return clampSubjectUnitCount(SUBJECT_UNIT_COUNT_WORDS.get(wordMatch[1].toLowerCase()));
  }
  const chineseMatch = text.match(/([一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款|种|组|套)?\s*(?:完整|可见|完整可见|可售|不同|独立)?\s*(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵)/u);
  return chineseMatch ? parseSubjectUnitCountToken(chineseMatch[1]) : 0;
}

function normalizeSkuSubjects(value) {
  return Array.isArray(value)
    ? value
        .map((item, index) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const referenceIndexes = normalizeIntegerArray(
            item.reference_indexes || item.referenceIndexes || item.indexes || item.indices,
          );
          const filenames = normalizeStringArray(item.filenames || item.reference_filenames || item.referenceFilenames);
          const id = String(item.id || item.subjectId || item.subject_id || filenames[0] || `sku-${index + 1}`).trim();
          const title = String(item.title || item.name || filenames[0] || id).trim();
          const note = String(item.note || item.description || item.summary || "").trim();
          const hasStructuredColorNames = Array.isArray(item.color_names) || Array.isArray(item.colorNames);
          const rawColorNames = item.color_names ?? item.colorNames ?? item.color_name ?? item.colorName ?? item.colors ?? item.colours;
          const subjectText = [filenames.join(" "), title, note].join(" ");
          const subjectUnitCount = resolveCreationPairedSubjectUnitCount(
            subjectText,
            Math.max(
              normalizeSubjectUnitCount(
                item.subject_unit_count ?? item.subjectUnitCount ?? item.visible_unit_count ?? item.visibleUnitCount ?? item.unit_count ?? item.unitCount,
              ),
              inferSubjectUnitCount(subjectText),
            ),
          );
          const colorNames = collapseCreationPairedSubjectColorLabels(
            subjectText,
            normalizeCreationSkuColorLabels(rawColorNames, subjectUnitCount > 1),
            subjectUnitCount,
          );

          if (!id && filenames.length === 0) {
            return null;
          }

          return {
            id,
            title,
            reference_indexes: referenceIndexes,
            filenames,
            subject_unit_count: subjectUnitCount,
            ...(hasStructuredColorNames || colorNames.length > 0 ? { color_names: colorNames } : {}),
            note,
          };
        })
        .filter(Boolean)
        .slice(0, MAX_CREATION_REFERENCE_IMAGES)
    : [];
}

function isLikelyReferenceFilename(value) {
  const text = String(value || "").trim();
  return /[\\/]/.test(text) || /\.(?:avif|bmp|gif|heic|jpe?g|png|svg|tiff?|webp)$/i.test(text);
}

function isUsefulProductNameCandidate(value) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  return Boolean(text) && !isLikelyReferenceFilename(text) && !["product", "goods", "item", "sku", "商品", "产品", "物品", "主体"].includes(normalized);
}

function getSkuSubjectProductNameCandidate(subject = {}) {
  const directName = String(
    subject.product_name ||
      subject.productName ||
      subject.productSubject ||
      subject.product_subject ||
      subject.mainSubject ||
      subject.main_subject ||
      subject.subjectName ||
      subject.subject_name ||
      subject.subject ||
      subject.productTitle ||
      subject.product_title ||
      subject.title ||
      subject.name ||
      subject.label ||
      "",
  ).trim();
  if (!isUsefulProductNameCandidate(directName)) {
    return "";
  }

  const normalizedName = directName.toLowerCase();
  const id = String(subject.id || subject.subjectId || subject.subject_id || "").trim().toLowerCase();
  const filenames = normalizeStringArray(subject.filenames || subject.reference_filenames || subject.referenceFilenames)
    .map((item) => item.toLowerCase());
  return normalizedName && normalizedName !== id && !filenames.includes(normalizedName) ? directName : "";
}

function getSkuSubjectProductName(value = {}, skuSubjects = []) {
  const rawSkuSubjects = Array.isArray(value.sku_subjects)
    ? value.sku_subjects
    : Array.isArray(value.skuSubjects)
      ? value.skuSubjects
      : [];
  for (const subject of [...rawSkuSubjects, ...skuSubjects]) {
    const candidate = getSkuSubjectProductNameCandidate(subject);
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

function getDirectProductNameCandidate(value = {}, { includeSubject = false } = {}) {
  const candidates = [
    value.product_name,
    value.productName,
    value.productSubject,
    value.product_subject,
    value.mainSubject,
    value.main_subject,
    value.subjectName,
    value.subject_name,
    includeSubject ? value.subject : "",
    value.productTitle,
    value.product_title,
  ];
  return candidates.map((item) => String(item || "").trim()).find(isUsefulProductNameCandidate) || "";
}

function normalizePromptOptions(value) {
  const prompts = Array.isArray(value.prompts)
    ? value.prompts
        .map((item, index) => {
          if (typeof item === "string") {
            const prompt = item.trim();
            return prompt
              ? {
                  title: `提示词 ${index + 1}`,
                  intent: "",
                  prompt,
                }
              : null;
          }

          if (!item || typeof item !== "object") {
            return null;
          }

          const prompt = String(item.prompt || "").trim();
          if (!prompt) {
            return null;
          }

          return {
            title: String(item.title || `提示词 ${index + 1}`).trim(),
            intent: String(item.intent || "").trim(),
            prompt,
          };
        })
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const singlePrompt = String(value.prompt || "").trim();
  if (prompts.length > 0) {
    return prompts;
  }

  return singlePrompt
    ? [
        {
          title: String(value.title || "图片提示词").trim(),
          intent: "",
          prompt: singlePrompt,
        },
      ]
    : [];
}

function normalizeStructuredImagePromptJson(value) {
  const subject = value?.subject;
  const framing = value?.framing;
  const hasStructuredShape =
    subject &&
    typeof subject === "object" &&
    !Array.isArray(subject) &&
    framing &&
    typeof framing === "object" &&
    !Array.isArray(framing) &&
    Object.hasOwn(value, "scene") &&
    Object.hasOwn(value, "visual") &&
    Object.hasOwn(value, "avoid");

  if (!hasStructuredShape) {
    return null;
  }

  const normalized = {
    subject: {
      type: toPromptAgentText(subject.type),
      pose: toPromptAgentText(subject.pose),
      expression: toPromptAgentText(subject.expression),
      appearance: normalizeStringArray(subject.appearance),
      clothing: toPromptAgentText(subject.clothing),
      interaction: toPromptAgentText(subject.interaction),
    },
    framing: {
      aspect_ratio: toPromptAgentText(framing.aspect_ratio),
      shot_size: toPromptAgentText(framing.shot_size),
      subject_scale: toPromptAgentText(framing.subject_scale),
      placement: toPromptAgentText(framing.placement),
      negative_space: toPromptAgentText(framing.negative_space),
      foreground_frame: toPromptAgentText(framing.foreground_frame),
      camera: toPromptAgentText(framing.camera),
      angle: toPromptAgentText(framing.angle),
      crop: toPromptAgentText(framing.crop),
      perspective: toPromptAgentText(framing.perspective),
      depth_of_field: toPromptAgentText(framing.depth_of_field),
    },
    scene: toPromptAgentText(value.scene),
    visual: toPromptAgentText(value.visual),
    avoid: normalizeStringArray(value.avoid),
  };

  const subjectText = [
    normalized.subject.type,
    normalized.subject.pose,
    normalized.subject.expression,
    normalized.subject.clothing,
    normalized.subject.interaction,
    ...normalized.subject.appearance,
  ].join("");
  const framingText = Object.values(normalized.framing).join("");
  if (!subjectText.trim() && !framingText.trim()) {
    // 主体和构图同时为空时，结果没有任何可复现内容，标题也会退化成单个氛围词。
    throw new Error("图片分析没有返回主体与构图信息，请重新分析或更换视觉模型。");
  }

  return normalized;
}

function normalizePromptAgentJson(value, mode = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型返回的 JSON 不是对象。");
  }
  if (mode === CREATION_MARKETING_PLAN_MODE) {
    if (!Array.isArray(value.items) || value.items.length === 0) {
      throw new PromptAgentJsonParseError(JSON.stringify(value), undefined, "AI 未返回整套图片任务（缺少非空 items 数组），请重新规划。");
    }
    return value;
  }

  const structuredImagePrompt = normalizeStructuredImagePromptJson(value);
  if (structuredImagePrompt) {
    return structuredImagePrompt;
  }

  const prompts = normalizePromptOptions(value);
  const prompt = String(value.prompt || prompts[0]?.prompt || "").trim();
  const referenceRoles = Array.isArray(value.reference_roles) ? value.reference_roles : [];
  const skuSubjects = normalizeSkuSubjects(value.sku_subjects || value.skuSubjects);
  const portraitReferenceRoles = normalizeStringArray(value.referenceRoles || value.reference_roles);
  const rawAudienceStrategy = value.audience_strategy || value.audienceStrategy;
  const normalizedAudienceStrategy = normalizeCreationAudienceStrategy(rawAudienceStrategy && typeof rawAudienceStrategy === "object" && !Array.isArray(rawAudienceStrategy) ? { ...rawAudienceStrategy, source: "analysis-suggestion" } : {}, { defaultSource: "analysis-suggestion" });
  const audienceStrategy = Object.keys(normalizedAudienceStrategy).length > 0 ? {
    target_audience: normalizedAudienceStrategy.targetAudience,
    purchase_motivations: normalizedAudienceStrategy.purchaseMotivations,
    purchase_objections: normalizedAudienceStrategy.purchaseObjections,
    desired_outcome: normalizedAudienceStrategy.desiredOutcome,
    evidence_basis: normalizedAudienceStrategy.evidenceBasis,
    confidence: normalizedAudienceStrategy.confidence,
    source: "analysis-suggestion",
  } : undefined;
  const hasPortraitAnalysis =
    value.visiblePresentation !== undefined ||
    value.heightImpression !== undefined ||
    value.bodyBuild !== undefined ||
    value.faceVisibility !== undefined ||
    portraitReferenceRoles.length > 0;
  if (!prompt && referenceRoles.length === 0 && !hasPortraitAnalysis) {
    throw new Error("模型返回的 JSON 缺少 prompt 字段。");
  }

  return {
    title: String(value.title || "图片提示词").trim(),
    prompt,
    negative_prompt: String(value.negative_prompt || "").trim(),
    style_tags: normalizeStringArray(value.style_tags),
    subject: String(value.subject || "").trim(),
    scene: String(value.scene || "").trim(),
    composition: String(value.composition || "").trim(),
    lighting: String(value.lighting || "").trim(),
    color_palette: String(value.color_palette || "").trim(),
    camera: String(value.camera || "").trim(),
    aspect_ratio: String(value.aspect_ratio || "").trim(),
    notes: normalizeStringArray(value.notes),
    product_name: getDirectProductNameCandidate(value, { includeSubject: referenceRoles.length > 0 || skuSubjects.length > 0 }) ||
      getSkuSubjectProductName(value, skuSubjects),
    summary: String(value.summary || "").trim(),
    category_hint: String(value.category_hint || value.categoryHint || value.category || "").trim(),
    category_path: String(value.category_path || value.categoryPath || "").trim(),
    image_roles: normalizeStringArray(value.image_roles),
    reference_roles: referenceRoles,
    sku_subjects: skuSubjects,
    ...(mode === CREATION_REFERENCE_ANALYSIS_MODE && value.product_insights && typeof value.product_insights === "object" ? { product_insights: value.product_insights } : {}),
    ...(audienceStrategy ? { audience_strategy: audienceStrategy } : {}),
    relationship: String(value.relationship || "").trim(),
    prompts,
    risks: normalizeStringArray(value.risks),
    visiblePresentation: String(value.visiblePresentation || "unclear").trim(),
    heightImpression: String(value.heightImpression || "unclear").trim(),
    bodyBuild: String(value.bodyBuild || "unclear").trim(),
    pose: String(value.pose || "").trim(),
    clothing: String(value.clothing || "").trim(),
    hair: String(value.hair || "").trim(),
    faceVisibility: String(value.faceVisibility || "").trim(),
    distinctVisibleFeatures: normalizeStringArray(value.distinctVisibleFeatures),
    referenceRoles: portraitReferenceRoles,
    safety: String(value.safety || "").trim(),
    confidence: String(value.confidence || "").trim(),
  };
}

// ---- 上游响应诊断（临时排查用，可整段删除）--------------------------------
// 目的：HTTP 2xx 却抽不到任何文本时，说明上游到底回了什么，而不是只报一句
// “没有可解析的文本内容”。不含任何凭据——API Key 只出现在请求头里。
const PROMPT_AGENT_DIAGNOSTIC_SNIPPET_LIMIT = 400;

function summarizePromptAgentPayload(payload) {
  const notes = [];
  const seen = new Set();

  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) {
      return;
    }
    seen.add(value);

    const error = value.error;
    if (error) {
      const text = typeof error === "string" ? error : error.message || error.type || error.code;
      if (text) notes.push(`上游 error：${String(text).slice(0, 200)}`);
    }
    if (typeof value.status === "string" && value.status !== "completed" && value.status !== "in_progress") {
      notes.push(`status=${value.status}`);
    }
    const reason = value.incomplete_details?.reason;
    if (reason) notes.push(`截断原因=${reason}`);
    if (typeof value.refusal === "string" && value.refusal.trim()) {
      notes.push(`模型拒答：${value.refusal.slice(0, 200)}`);
    }
    if (typeof value.finish_reason === "string" && value.finish_reason && value.finish_reason !== "stop") {
      notes.push(`finish_reason=${value.finish_reason}`);
    }
    if (Array.isArray(value.data) && value.data.length > 0) {
      notes.push(`响应体是图像负载：data[${value.data.length}] 含 ${Object.keys(value.data[0] || {}).join("/") || "?"}`);
    }
    if (Array.isArray(value.output)) {
      const types = value.output.map((item) => item?.type).filter(Boolean);
      if (types.length) notes.push(`output 项类型=[${types.join(", ")}]`);
    }
    if (value.usage && typeof value.usage === "object") {
      const used = value.usage.output_tokens ?? value.usage.completion_tokens;
      if (used !== undefined) notes.push(`输出 token=${used}`);
    }

    for (const key of ["response", "item", "message", "delta", "content", "choices", "candidates", "output", "parts"]) {
      const child = value[key];
      if (Array.isArray(child)) child.forEach((entry) => visit(entry, depth + 1));
      else visit(child, depth + 1);
    }
  };

  visit(payload);
  return notes.filter((note, index) => notes.indexOf(note) === index);
}

function buildEmptyTextError(payload, rawText = "", extraNotes = []) {
  let notes = [];
  try {
    notes = [...summarizePromptAgentPayload(payload), ...extraNotes];
  } catch {
    notes = [...extraNotes];
  }
  const snippet = String(rawText || "").replace(/\s+/g, " ").trim();
  const detail = [
    notes.length ? `诊断：${notes.join("；")}` : "诊断：响应结构里没有任何文本字段",
    snippet
      ? `原始响应片段：${snippet.slice(0, PROMPT_AGENT_DIAGNOSTIC_SNIPPET_LIMIT)}${
          snippet.length > PROMPT_AGENT_DIAGNOSTIC_SNIPPET_LIMIT ? "…" : ""
        }`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const error = new Error(`模型响应中没有可解析的文本内容。${detail ? ` ${detail}` : ""}`);
  error.isPromptAgentEmptyText = true;
  return error;
}
// ---- 诊断段结束 ------------------------------------------------------------

export function extractPromptAgentJson(payload, rawText = "", mode = "") {
  if (typeof payload === "string") {
    return normalizePromptAgentJson(parseJsonObject(payload, mode), mode);
  }

  const parts = collectTextParts(payload)
    .map((part) => String(part || ""))
    .filter((part) => part.trim());
  if (parts.length === 0) {
    throw buildEmptyTextError(payload, rawText);
  }

  // Providers sometimes expose the same answer through both `output_text` and
  // nested `output[].content`. Try each part before joining them so duplicate
  // copies of one JSON object cannot turn an otherwise valid response into
  // invalid text. Joining remains the fallback for genuinely segmented output.
  const candidates = [...parts, parts.join(""), parts.join("\n")];
  let lastError;
  for (const candidate of candidates) {
    try {
      return normalizePromptAgentJson(parseJsonObject(candidate, mode), mode);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("模型响应中没有可解析的文本内容。");
}

function pickStreamText({ completedText, chatMessageText = "", collectedTexts, deltaText }) {
  return [
    completedText,
    chatMessageText,
    deltaText,
    ...[...collectedTexts].reverse(),
    collectedTexts.join(""),
    collectedTexts.join("\n"),
  ]
    .map((text) => String(text || "").trim())
    .filter(Boolean)
    .filter((text, index, candidates) => candidates.indexOf(text) === index);
}

export async function consumePromptAgentSse(stream, mode = "", onProgress) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let deltaText = "";
  let completedText = "";
  let chatMessageText = "";
  const collectedTexts = [];
  // 诊断用：累计上游事件里的异常线索和原始流片段（临时排查用，可整段删除）
  const diagnostics = [];
  let rawStreamText = "";
  let reportedText = "";

  const mergeChatMessageText = (value) => {
    const text = String(value || "");
    if (!text) {
      return;
    }
    if (!chatMessageText || text === chatMessageText) {
      chatMessageText = text;
      return;
    }
    if (text.startsWith(chatMessageText)) {
      chatMessageText = text;
      return;
    }
    if (chatMessageText.startsWith(text)) {
      return;
    }
    chatMessageText += text;
  };

  const finish = () => {
    let lastError;
    for (const candidate of pickStreamText({ completedText, chatMessageText, collectedTexts, deltaText })) {
      try {
        return extractPromptAgentJson(candidate, "", mode);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && !lastError.isPromptAgentEmptyText) {
      throw lastError;
    }

    throw buildEmptyTextError(null, rawStreamText, [
      ...diagnostics,
      `流内文本：completed=${completedText.length}字 chat=${chatMessageText.length}字 delta=${deltaText.length}字 收集=${collectedTexts.length}段`,
    ]);
  };

  const processChunk = (chunk) => {
    const trimmedChunk = String(chunk || "").trim();
    // Some gateways keep the event-stream content type while returning one
    // ordinary JSON envelope. Accept that body directly instead of treating it
    // as an empty SSE event.
    if (trimmedChunk && !/^event\s*:|^data\s*:/m.test(trimmedChunk) && /^[\[{]/.test(trimmedChunk)) {
      try {
        return extractPromptAgentJson(JSON.parse(trimmedChunk), "", mode);
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error;
        }
      }
    }

    const { eventName, data } = parseSseChunk(chunk);
    if (!data) {
      return undefined;
    }

    if (data === "[DONE]") {
      return finish();
    }

    const payload = JSON.parse(data);
    const resolvedEventName = eventName || payload?.type || "unknown";
    if (diagnostics.length < 40) {
      for (const note of summarizePromptAgentPayload(payload)) {
        if (!diagnostics.includes(note)) {
          diagnostics.push(note);
        }
      }
    }

    if (typeof payload === "string") {
      collectedTexts.push(payload);
      return undefined;
    }

    if (
      resolvedEventName === "response.output_text.delta" &&
      typeof payload.delta === "string"
    ) {
      deltaText += payload.delta;
    }

    if (
      resolvedEventName === "response.output_text.done" &&
      typeof payload.text === "string"
    ) {
      completedText = payload.text;
    }

    // OpenAI-compatible Chat Completions relays may stream JSON in
    // `choices[].delta.content` instead of Responses' output_text events.
    // Accumulate those fragments in the same ordered buffer. Do not append
    // `choices[].message.content` here: that field is commonly a complete
    // message and is already collected below as a fallback.
    if (Array.isArray(payload.choices)) {
      for (const choice of payload.choices) {
        const delta = choice?.delta;
        if (!delta || typeof delta !== "object" || !Object.prototype.hasOwnProperty.call(delta, "content")) {
          continue;
        }
        const content = delta.content;
        if (typeof content === "string") {
          deltaText += content;
        } else if (Array.isArray(content)) {
          deltaText += content
            .map((part) => (typeof part === "string" ? part : part?.text || part?.content || ""))
            .join("");
        } else if (content && typeof content === "object") {
          deltaText += String(content.text || content.content || "");
        }
      }

      for (const choice of payload.choices) {
        const message = choice?.message;
        if (!message || typeof message !== "object") {
          continue;
        }
        const content = message.content;
        const text = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
              .map((part) => (typeof part === "string" ? part : part?.text || part?.content || ""))
              .join("")
            : content && typeof content === "object"
              ? String(content.text || content.content || "")
              : "";
        mergeChatMessageText(text);
      }
    }

    const parts = collectTextParts(payload);
    if (parts.length > 0) {
      collectedTexts.push(parts.join("\n"));
    }
    // 仅转发最终回答文本，推理字段与原始上游事件不进入进度回调。
    const outputText = completedText || deltaText || chatMessageText;
    if (outputText && outputText !== reportedText) {
      reportedText = outputText;
      onProgress?.({ stage: "receiving", text: outputText });
    }
    return undefined;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      if (rawStreamText.length < PROMPT_AGENT_DIAGNOSTIC_SNIPPET_LIMIT * 4) {
        rawStreamText += decoded;
      }
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const result = processChunk(chunk);
        if (result !== undefined) {
          return result;
        }
      }
    }

    // A compliant SSE producer may close immediately after the final event,
    // without emitting the blank line that normally terminates an event. Flush
    // the decoder and process that complete trailing event instead of dropping
    // the last JSON fragment.
    buffer += decoder.decode();
    if (buffer.trim()) {
      const result = processChunk(buffer);
      if (result !== undefined) {
        return result;
      }
    }

    return finish();
  } finally {
    try { await reader.cancel?.(); } catch {}
    reader.releaseLock?.();
  }
}

function shouldRetryWithoutStructuredOutput(error) {
  const message = error instanceof Error ? error.message : String(error);
  const upstreamBody =
    error && typeof error === "object" && typeof error.upstreamBody === "string"
      ? error.upstreamBody
      : "";
  return /text\.format|json_schema|response_format|responseMimeType|response_mime_type|structured/i.test(`${message}\n${upstreamBody}`);
}

function looksLikePromptAgentSse(text) {
  return /^(?:\uFEFF)?\s*(?:event:|data:|:)/m.test(String(text || ""));
}

function createPromptAgentTextStream(text) {
  let emitted = false;
  const value = new TextEncoder().encode(String(text || ""));
  return {
    getReader() {
      return {
        async read() {
          if (emitted) {
            return { done: true };
          }
          emitted = true;
          return { done: false, value };
        },
      };
    },
  };
}

function extractPromptAgentResponseText(responseText, mode = "") {
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = responseText;
  }

  return extractPromptAgentJson(payload, responseText, mode);
}

async function parsePromptAgentResponse(response, mode = "", onProgress) {
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      formatHttpErrorMessage({
        label: "图片分析请求失败",
        status: response.status,
        body,
      }),
    );
    error.upstreamBody = body;
    throw error;
  }

  const contentType = response.headers?.get("content-type") || "";
  if (response.body && /text\/event-stream/i.test(contentType)) {
    // The stream consumer also accepts a single ordinary JSON envelope. This
    // keeps the normal `[DONE]` early-return behavior for long-lived streams.
    return consumePromptAgentSse(response.body, mode, onProgress);
  }

  const responseText = await response.text();
  if (looksLikePromptAgentSse(responseText)) {
    return consumePromptAgentSse(createPromptAgentTextStream(responseText), mode, onProgress);
  }

  return extractPromptAgentResponseText(responseText, mode);
}

async function sendPromptAgentRequest({
  baseUrl,
  endpointPath,
  apiKey,
  imageRoute,
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  contextPrompt,
  responsesModel,
  imageModel,
  reasoningEffort,
  fetchImpl,
  structuredOutput,
  strictJsonRetry,
  onProgress,
  signal,
}) {
  const normalizedRoute = normalizeImageRoute(imageRoute);
  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath, API_ENDPOINT_RESPONSES);
  const useModelProtocol = normalizedRoute === IMAGE_ROUTE_C;
  const useGeminiProtocol = useModelProtocol && isGeminiPromptAgentModel(imageModel || responsesModel);
  const useChatCompletions = !useGeminiProtocol && (useModelProtocol || normalizedEndpointPath === API_ENDPOINT_CHAT_COMPLETIONS);
  const requestEndpointPath = useGeminiProtocol
    ? API_ENDPOINT_IMAGE_GENERATIONS
    : useChatCompletions
      ? API_ENDPOINT_CHAT_COMPLETIONS
      : normalizedEndpointPath;
  const requestBody = useGeminiProtocol
    ? createPromptAgentGeminiRequestBody({
        image,
        images,
        imageLabels,
        mode,
        targetLanguage,
        targetLanguageLabel,
        contextPrompt,
        responsesModel,
        imageModel,
        structuredOutput,
        strictJsonRetry,
      })
    : useChatCompletions
      ? createPromptAgentChatCompletionsRequestBody({
          image,
          images,
          imageLabels,
          mode,
          targetLanguage,
          targetLanguageLabel,
          contextPrompt,
          responsesModel: responsesModel || imageModel,
          structuredOutput,
          strictJsonRetry,
        })
      : createPromptAgentRequestBody({
          image,
          images,
          imageLabels,
          mode,
          targetLanguage,
          targetLanguageLabel,
          contextPrompt,
          responsesModel,
          reasoningEffort,
          structuredOutput,
          strictJsonRetry,
        });

  let response;
  try {
    response = await fetchImpl(appendApiEndpointPath(baseUrl, requestEndpointPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: useGeminiProtocol || useChatCompletions ? "application/json" : "text/event-stream",
      },
      body: JSON.stringify(requestBody),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    const detail = formatFetchFailureDetail(error);
    throw new Error(`模型服务连接失败：${detail || (error instanceof Error ? error.message : String(error))}。请检查文本/视觉模型的 API 地址和网络连接。`, { cause: error });
  }

  return parsePromptAgentResponse(response, mode, onProgress);
}

async function sendPromptAgentRequestWithStructuredFallback(options) {
  try {
    return await sendPromptAgentRequest({
      ...options,
      structuredOutput: true,
    });
  } catch (error) {
    if (!shouldRetryWithoutStructuredOutput(error)) {
      throw error;
    }

    options.onProgress?.({ stage: "retrying", message: "上游不支持结构化输出，正在切换兼容格式。" });

    return sendPromptAgentRequest({
      ...options,
      structuredOutput: false,
    });
  }
}

export async function requestPromptAgentAnalysis({
  baseUrl,
  endpointPath,
  apiKey,
  imageRoute,
  image,
  images,
  imageLabels,
  mode,
  targetLanguage,
  targetLanguageLabel,
  contextPrompt,
  responsesModel,
  imageModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = upstreamStreamFetch,
  onProgress,
  signal,
}) {
  let attempt = 0;
  const reportProgress = onProgress ? (event) => onProgress({ ...event, attempt }) : undefined;
  const requestFetch = onProgress ? (url, init) => {
    attempt += 1;
    reportProgress({ stage: "waiting", message: "已发出整套规划请求，等待模型返回。" });
    return fetchImpl(url, init);
  } : fetchImpl;
  const options = {
    baseUrl,
    endpointPath,
    apiKey,
    imageRoute,
    image,
    images,
    imageLabels,
    mode,
    targetLanguage,
    targetLanguageLabel,
    contextPrompt,
    responsesModel,
    imageModel,
    reasoningEffort,
    fetchImpl: requestFetch,
    onProgress: reportProgress,
    signal,
  };

  try {
    return await sendPromptAgentRequestWithStructuredFallback({
      ...options,
      strictJsonRetry: false,
    });
  } catch (error) {
    if (!isPromptAgentJsonParseError(error)) {
      throw error;
    }

    reportProgress?.({ stage: "retrying", message: "整套响应不完整，正在重试完整规划。" });

    return sendPromptAgentRequestWithStructuredFallback({
      ...options,
      strictJsonRetry: true,
    });
  }
}
