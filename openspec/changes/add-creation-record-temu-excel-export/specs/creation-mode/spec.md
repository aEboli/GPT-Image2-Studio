## ADDED Requirements

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

### Requirement: 套图记录以左侧可扩展列表和右侧当前内容组成桌面双栏

系统 SHALL 在桌面和宽屏以常驻双栏呈现套图记录：左侧为可滚动、高密度、可扩展的记录列表，右侧为当前记录摘要、图片和 Listing。每行 SHALL 显示独立勾选、商品名、平台、完成数、创建时间、生成状态、Listing 状态和 Temu 导出状态。在桌面和宽屏布局中，点击记录 SHALL 只选择当前记录并更新右侧内容，MUST NOT 隐藏左侧列表、进入互斥详情视图或要求用户返回列表。移动端 SHALL 将记录选择器和当前记录内容上下堆叠；选择器 SHALL 默认折叠、可按需展开，并 SHALL 在选择记录后自动收起。系统 MUST NOT 静默丢弃第 60 套之后的匹配记录；分批显示时 SHALL 明确显示已呈现数量和匹配总数并提供继续加载。

#### Scenario: 匹配记录超过首批显示数量

- **WHEN** 当前筛选匹配 75 套记录且首批上限为 60 套
- **THEN** 页面显示“已显示 60 / 75”及可用的“加载更多”命令
- **AND** 用户加载后可以查看并勾选余下 15 套
- **AND** 删除筛选结果和筛选计数仍以完整 75 套为准

#### Scenario: 桌面用户在左侧列表切换当前记录

- **WHEN** 用户点击左侧列表中的另一套记录
- **THEN** 右侧更新为该记录的摘要、图片和 Listing
- **AND** 左侧列表持续可见，当前搜索、时间筛选、已勾选记录、已加载行数和列表滚动位置保持不变

#### Scenario: 移动端用户展开记录选择器

- **WHEN** 用户在移动端进入已有当前记录的套图记录页
- **THEN** 记录选择器默认折叠且当前记录内容持续可见
- **WHEN** 用户展开记录选择器
- **THEN** 记录列表和“已显示 N / 匹配 M”footer 可见

#### Scenario: 移动端用户选择另一套记录

- **GIVEN** 移动端记录选择器已经展开
- **WHEN** 用户选择另一套记录
- **THEN** 选择器自动收起且当前记录内容更新为所选记录的摘要、图片和 Listing
- **AND** 当前搜索、时间筛选、已勾选记录和已加载行数保持不变

#### Scenario: 日期展示与筛选使用同一事实

- **WHEN** 一套记录的 `createdAt` 与 `updatedAt` 位于不同日期
- **THEN** 列表主时间显示 `createdAt`
- **AND** 日期筛选也使用 `createdAt`
- **AND** `updatedAt` 只作为详情中的更新时间显示

### Requirement: Temu 导出工作台在正式导出前提供服务端批次预检

系统 SHALL 在 Temu 导出工作台展示模板、set 数、SKU 行数、唯一图片数、待上传数、已上传数、缓存复用数、阻塞项数、提醒数和逐记录摘要。浏览器 SHALL 调用本地 `POST /api/creation/sets/export-temu-excel/preflight`，并 SHALL 只有在响应仍对应当前 set ID、表单值和记录更新时间快照时才把它视为当前预检结果。Cloudflare SHALL 对该端点返回 `unsupported_runtime_capability`。

#### Scenario: 预检补传本地图片并返回摘要

- **WHEN** 用户为包含安全本地图片的批次提供合法 Cloudinary unsigned 配置并启动预检
- **THEN** 服务端复用正式导出的路径、指纹、缓存和上传边界补传缺少公网地址的图片
- **AND** 响应列出上传数、缓存复用数、SKU 行数、阻塞项和逐记录摘要
- **AND** 响应不包含 upload preset、Secret、本地绝对路径或原始上游响应

#### Scenario: 预检后选择或默认值变化

- **WHEN** 用户在一次预检后改变勾选记录、任一默认值或 Cloudinary 配置
- **THEN** 浏览器立即把旧预检标记为过期
- **AND** 严格导出保持禁用直到新预检成功

### Requirement: Temu Excel 支持严格导出和待补全导出双轨

正式导出请求 SHALL 接受 `mode` 为 `strict` 或 `draft`；省略该字段 SHALL 为兼容现有客户端而按 `draft` 处理。`draft` SHALL 保持缺口进入问题 sheet 且工作簿可下载的现有行为。`strict` SHALL 在写工作簿前重新读取事实并复核全部阻塞条件，任一阻塞项存在时 SHALL 整批返回 `422` 和 code `TEMU_STRICT_EXPORT_BLOCKED`，MUST NOT 返回部分工作簿或写入成功导出状态。

#### Scenario: 严格导出全部通过

- **WHEN** 所有模板必填字段、最终公网图片和严格尺寸规则在正式请求中重新验证通过
- **THEN** 服务端生成并回读验证完整工作簿
- **AND** 返回模式、set 数、SKU 行数和问题数响应元数据
- **AND** 每套记录写入最近严格导出状态

#### Scenario: 严格导出存在一个阻塞项

- **WHEN** 任一 SKU 缺少必填价格、最终公网图片不可达或 SKU 方图尺寸不合规
- **THEN** 整批返回 `422` 和 `TEMU_STRICT_EXPORT_BLOCKED`
- **AND** 响应包含有界、清理后的可定位阻塞摘要
- **AND** 不生成或下载部分工作簿
- **AND** 不把任何记录标记为严格已导出

#### Scenario: 用户选择待补全导出

- **WHEN** 相同批次仍有数据或图片缺口但用户显式选择待补全导出
- **THEN** 服务端生成工作簿并把缺口写入导出问题 sheet
- **AND** 列表将这些记录标记为“待补全导出”而不是“已导出”

### Requirement: 严格模式实时验证最终公网图片及 SKU 方图尺寸

系统 SHALL 对严格预检和严格正式导出中的每个最终图片 URL执行服务端实时验证。每次请求和每次重定向 SHALL 重新验证无凭据 HTTPS、主机和全部 DNS 地址；回环、链路本地、私网、保留地址及 IPv4-mapped IPv6 私网地址 MUST 被拒绝。系统 SHALL 使用有界总超时、最多 3 次手工重定向、有界并发和响应字节流上限，SHALL 要求响应为受支持的实际图片，并 SHALL 从 PNG、JPEG 或常见 WebP 字节解析像素尺寸。

#### Scenario: DNS 解析到 IPv4-mapped 私网地址

- **WHEN** 一个看似公网的 HTTPS 主机解析到 `::ffff:127.0.0.1`、`::ffff:10.0.0.1` 或其他映射私网地址
- **THEN** 远程验证失败关闭
- **AND** 系统不向该地址发送后续图片请求
- **AND** 严格导出将对应字段报告为阻塞项

#### Scenario: 重定向离开公网边界

- **WHEN** 公网图片地址重定向到 HTTP、本地主机、带凭据地址或私网解析主机
- **THEN** 系统在跟随该目标前拒绝重定向
- **AND** 不转发 Authorization、Cookie 或其他认证信息

#### Scenario: SKU 或素材图尺寸不合规

- **WHEN** 最终 SKU 预览图或产品素材图的实际宽高不相等，或任一边不大于 800 像素
- **THEN** 预检报告稳定的尺寸阻塞代码和实际宽高
- **AND** 严格导出失败
- **AND** 待补全导出仍可下载并在问题 sheet 标记该缺口

### Requirement: 套图记录持久化可判定是否过期的 Temu 导出状态

系统 SHALL 在每套 manifest 中以版本化 `temuExcelExportState` 保存最近成功工作簿的模式、导出时间、导出时源 `updatedAt`、行数和问题数。状态合并 SHALL 保留并发业务字段且 MUST NOT 仅因状态写入推进业务 `updatedAt`。列表 SHALL 区分“未导出”“已导出”“已修改”和“待补全导出”。

#### Scenario: 严格导出后记录未变化

- **WHEN** 最近成功模式为 `strict` 且保存的源更新时间等于当前记录 `updatedAt`
- **THEN** 列表显示“已导出”

#### Scenario: 严格导出后记录发生变化

- **WHEN** 最近成功模式为 `strict` 但当前 `updatedAt` 晚于或不同于保存的源更新时间
- **THEN** 列表显示“已修改”
- **AND** 旧导出不再被描述为当前数据的有效严格导出

#### Scenario: 状态写入失败

- **WHEN** 工作簿已生成并通过回读校验但任一 manifest 状态 merge-save 失败
- **THEN** 工作簿仍可返回
- **AND** 响应和问题 sheet 记录 `EXPORT_STATE_WRITE_FAILED`
- **AND** 列表不得伪装为状态已成功写回

### Requirement: Temu 工作台与记录变更操作使用统一互斥和响应式层级

预检、图片补传和正式导出 SHALL 共用一个 busy 状态。busy 时 SHALL 禁止重复提交，并 SHALL 禁用补齐图像、生成或重新生成 Listing、刷新及所有删除操作；已有生成或 Listing 请求运行时 SHALL 不允许启动预检或导出。搜索、时间筛选、滚动、右侧当前记录内容和勾选查看 SHALL 保持可用。移动端 SHALL 将记录选择器和当前记录内容上下堆叠，选择器 SHALL 默认折叠、可按需展开，并 SHALL 在选择记录后自动收起；首层操作 SHALL 只保留复用、Temu 导出和更多菜单，并 SHALL 将刷新、补图和删除按普通/危险操作分组收入菜单。

#### Scenario: 导出进行时用户尝试改变记录

- **WHEN** Temu 预检或导出请求尚未结束
- **THEN** 补图、Listing 生成、刷新和删除命令均不可用
- **AND** 用户仍可搜索、筛选、滚动或切换并查看右侧当前记录内容
- **AND** 请求结束后焦点返回打开工作台的命令或可用的搜索控件

#### Scenario: 键盘用户浏览套图记录

- **WHEN** 键盘用户在记录列表中移动焦点
- **THEN** 列表使用普通列表、真实按钮和独立复选框语义
- **AND** 不依赖未实现的 `listbox/option` 方向键模型
- **AND** 所有主要命令具有可见焦点和可读名称
