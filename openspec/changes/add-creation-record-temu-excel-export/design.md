## Context

Creation set manifest 已经是套图记录的持久化事实来源，包含商品输入、平台、`skuSubjects`、逐图 `items`、Listing 草稿和输出相对路径。套图记录 UI 已经维护 `recordCheckedSetIds`，并保证勾选批次与当前详情互不替换。现有 TXT/JSON 导出从当前详情对象在浏览器内生成；它们不负责读取本地图片、生成 Temu 模板或发布公网图片。

Temu Excel 导出需要同时处理四类边界：

1. 用户标准模板的 sheet、表头、列顺序、格式和数据校验不能由代码猜测。
2. 每个 SKU 必须成为独立行，而商品级字段和 SKU 级字段必须有稳定来源。
3. 本地 `/output/...` 或 Windows 路径不是平台可访问的图片 URL；Cloudinary unsigned upload 可以提供公网 `secure_url`，但不能引入 API Secret。
4. 缺失字段属于待补全事实，不应阻止用户取得工作簿，也不能被模型推断、固定占位值或静默估算掩盖。

Cloudinary 官方上传文档定义 unsigned upload 使用上传预设，并在上传响应中返回资源 URL。第一版只调用固定的官方 image upload 端点 `https://api.cloudinary.com/v1_1/<cloudName>/image/upload`，multipart 字段仅包含图片和 `upload_preset`；不接受自定义上传 URL、签名参数或 API Secret。

## Goals / Non-Goals

**Goals:**

- 复用套图记录现有显式多选，批量生成一个用户标准 Temu `.xlsx`。
- 按 manifest 中规范化后的 SKU 顺序生成一 SKU 一行，并保持批次和行顺序可预测。
- 优先使用已保存且可验证的事实；允许用户用显式批次默认值补空字段，并可追踪这些默认值的来源。
- 复用已有公网 HTTPS 图片 URL；对本地输出图片提供可选 Cloudinary unsigned upload。
- 将成功的 `secure_url` 按源文件内容指纹缓存到 manifest，避免相同文件在后续导出中重复上传。
- 在任何非致命数据缺口下仍生成工作簿，并用导出问题表给出逐行、逐字段的修复清单。
- 在导出前提供与正式导出共用事实来源和安全边界的批次预检，使用户能看到 SKU、图片、待上传资源、阻塞项和提醒。
- 在兼容的待补全导出之外提供严格导出；严格导出只有在最终公网图片和 SKU 方图尺寸均经本地服务实时验证后才生成工作簿。
- 让套图记录在桌面和宽屏保留左侧可扩展记录列表、右侧当前记录图片和 Listing 的常驻双栏；点击记录只更新右侧，并避免第 60 套之后静默消失。
- 持久化最近导出模式和源更新时间，使每套记录能稳定显示未导出、已导出、已修改或待补全导出。
- 对请求、模板、路径、图片、工作簿文本和运行时能力建立明确的失败关闭边界。
- 保持现有 TXT/JSON/Listing 导出完全兼容。

**Non-Goals:**

- 不自动发布、上传或提交商品到 Temu，也不调用 Temu 卖家 API。
- 不声称生成的工作簿已经通过 Temu 审核或具备发布资格。
- 不从图片、模型输出或相邻 SKU 猜测价格、尺寸、重量、库存、产地、类目 ID 或其他缺失事实。
- 不在第一版实现字段级人工表格编辑器、单位或币种自动换算、远程 Cloudinary 资源删除或资产生命周期管理。
- 不把预检成功或工作簿生成描述为 Temu 卖家后台实际导入成功；真实平台 dry-run 仍需用户在已登录工具中人工完成。
- 不接受任意 Excel 模板并猜测列名；模板版本未识别时明确失败。
- 不要求 Cloudflare、Vercel 或其他无本地 Creation manifest/output 根的运行时支持该导出。
- 不改变现有单套 TXT、manifest JSON 或 Listing JSON 的输出结构。

## Decisions

### 1. 用户标准模板是版本化契约，不是参考样式

用户已提供并确认标准模板 `import_created_product_popTemu (2).xlsx`。版本化副本的 SHA-256 为 `8008B60BB1CCBD8F45D7B07F41445379BAC79B62CAEE9FD2465ADB95AAAD6DC8`，文件大小为 12,892 字节。目标数据 sheet 为 `导入模板`，表头位于第 1 行，数据从第 2 行开始，范围为 A:AY 共 51 列；`导入示例` 保持原样。模板定义与只读模板资源一同版本控制。

模板显式必填列为 A `*产品标题`、B `*英文标题`、E `*变种属性名称一`、F `*变种属性值一`、J `*申报价格（店铺币种）`、L:O `*长/*宽/*高/*重量`、S `*轮播图` 和 T `*产品素材图`。I `预览图` 的说明要求非服装类 SKU 图片。轮播图最多写 10 个换行分隔的 HTTPS URL；产品素材图要求 1:1 且大于 800×800；W `外包装图片` 最多 6 个 URL，但第一版没有可信包装图来源时保持空白。

导出开始时先验证模板身份和关键表头。模板缺失、哈希或关键结构不匹配时，端点返回明确错误，不创建一个“看起来相似”的自制表格。实现使用能够读取和写回现有 `.xlsx` 的结构化工作簿库，禁止用字符串替换或手写 ZIP/XML 修改模板。

输出是模板的独立副本。原模板不被修改；未被映射的数据、说明、格式、列宽、冻结窗格、数据验证和模板自带公式保持不变。导出器只向模板定义的数据区域写行，并新增一个不覆盖模板既有 sheet 的导出问题 sheet。若 `导出问题` 已被模板占用，则使用第一个可用的 `导出问题 (N)` 名称，并在响应元数据中返回实际名称。

### 2. 一套记录先归一化为商品，再按规范 SKU 展开行

每个请求先按用户提交的 `setIds` 顺序读取 manifest，并再次确认 manifest 内 `setId` 与请求 ID 精确相等。行生成使用 manifest 中规范化后的 `skuSubjects` 顺序；SKU 身份优先使用稳定 `id`，显示值使用有证据的标题、颜色和规格字段。不得从文件名、图片像素或未结构化提示词额外发明 SKU。

商品级 Listing、标题、描述、类目和共享图片映射到每个 SKU 行；SKU 名称、SKU 标识、SKU 图片及已保存的 SKU 特有值只映射到对应行。一个记录没有可用 `skuSubjects` 时，仍生成一个商品级占位行，SKU 字段留空，并写入 `MISSING_SKU` 问题，确保所选记录不会无提示地消失。

同一批次按请求中的 set 顺序、每套内部 SKU 顺序输出。所有问题通过稳定的 `setId + skuId/rowKey + templateField` 关联到具体数据行。

### 3. 事实值、用户默认值和空值有明确优先级

字段优先级为：

1. manifest 或已完成 Listing 中与目标字段明确对应的已保存值；
2. 用户在本次导出表单中显式填写的批次默认值；
3. 空单元格与问题记录。

导出表单和 API 使用含单位的字段：

- `variantAttributeName`：第一变种属性名称，表单初始值为用户参考导出采用的“颜色”，用户可在批次导出前修改。
- `defaultPrice`：模板声明币种下的正数价格；不执行币种换算。
- `defaultPackageLengthCm`、`defaultPackageWidthCm`、`defaultPackageHeightCm`：大于 0 的厘米值。
- `defaultPackageWeightG`：大于 0 的克值。
- `defaultStock`：大于或等于 0 的整数。
- `defaultOriginCountry`：按模板接受格式填写的产地值。

默认值只补空缺，不覆盖已有明确值。使用默认值的每个字段都在导出问题表标记 `USER_DEFAULT_APPLIED`，来源写为“用户批次默认值”。系统不把默认值重写为“识别”“实测”或“平台数据”，也不把图片尺寸、生成提示词中的模糊量词、类目常见值或其他 SKU 的值当作当前 SKU 事实。

无值且模板必填时，单元格保持空白并记录 `MISSING_REQUIRED_FIELD`。不使用 `0`、`N/A`、`unknown`、虚构 URL 或其他可能被平台当成真实值的占位符。

### 4. Listing 只读取，不在导出中生成或重写

导出器读取 set 上已有的规范化 Listing 草稿，并按模板定义映射标题、卖点、描述、搜索词等字段。没有可用 Listing 时仍输出 SKU 行，Listing 相关单元格保持空白，同时记录 set/行级 `MISSING_LISTING` 和对应必填字段问题。

导出操作不启动 Listing 生成、不调用模型、不翻译、不做营销改写，也不绕过现有事实和无品牌内容边界。历史 Listing 只按现有兼容读取器映射，不在 manifest 中迁移或覆盖。

### 5. 图片 URL 解析分为公网复用、本地上传和待补全

每个模板图片字段先解析到明确的 Creation item。SKU 图片必须匹配当前 SKU；共享主图、详情图和其他商品级图片按模板定义的有序槽位复用。

URL 解析顺序：

1. item 已包含无凭据、绝对、非本地网络目标的 `https://` URL时直接复用；`http:`、相对 `/output`、`data:`、`blob:`、`file:`、带用户名密码、localhost、回环、链路本地或私网目标不视为公网 URL。
2. item 只有本地 `relativePath` 且 manifest 中存在源文件指纹仍匹配的 Cloudinary `secure_url` 缓存时复用缓存。
3. item 只有本地文件且请求同时提供合法 `cloudName` 与 `uploadPreset` 时，安全读取本地图片并执行 unsigned upload。
4. 其他情况保持图片字段为空，并记录 `MISSING_PUBLIC_IMAGE_URL` 或更具体的配置/文件问题。

Cloudinary 配置必须同时提供或同时为空。API schema 不接受 API Secret、签名、任意 endpoint、Authorization header 或 Cookie。`cloudName` 只用于构造固定官方主机下的路径，`uploadPreset` 只作为 multipart `upload_preset`；响应必须成功、是有界 JSON，并包含可验证的公网 HTTPS `secure_url`。上传使用有界超时、并发数、重试和响应大小限制；不跟随到非 Cloudinary 上传主机。

相同源图片在一个请求内只上传一次。成功后将 `secureUrl`、源 `relativePath` 的 SHA-256 内容指纹、`cloudName`、资源标识和上传时间合并到对应 set manifest。缓存合并必须走每个 set 的串行保存队列，保留并发写入的 Listing 和生成字段。源文件指纹变化、URL 不再合法或 cloudName 不匹配时缓存失效并重新解析。上传失败不写成功缓存；缓存写入失败时当前工作簿可以继续使用刚取得的 URL，但必须记录 `IMAGE_CACHE_WRITE_FAILED`。

SKU 预览图使用与当前 SKU 精确关联的生成图；轮播图按非 SKU 完成项顺序最多写 10 个 URL。产品素材图优先使用首张 hero 图。若素材图是 Cloudinary delivery URL，则派生 `c_pad,b_white,h_1200,w_1200` 的 1:1 白底交付 URL；其他公网 URL 不做像素内容猜测，并记录素材图尺寸要求尚未验证的问题。

### 6. 缺口通过导出问题 sheet 表达，工作簿仍是主要结果

除请求、模板、身份或总量边界等致命错误外，数据不完整和单图上传失败不使整批导出失败。输出工作簿始终包含导出问题 sheet，至少包含以下列：

- 严重级别
- 问题代码
- `setId`
- 商品名称
- SKU ID/名称
- 数据行号
- 模板字段/列
- 问题说明
- 当前来源
- 建议处理

问题代码覆盖缺 Listing、缺 SKU、缺必填字段、缺公网图片、Cloudinary 未配置/配置无效、文件缺失、路径不安全、上传失败、缓存写入失败、单元格字符清理和长度截断。一个上传失败可以在内部去重，但问题表必须能定位所有受影响的行与图片字段。

无问题时仍保留只有表头的问题 sheet，使下游可以稳定检查。问题表不得包含 API 配置、请求头、API Secret、本地绝对路径或原始上游错误响应；错误文本经过长度和敏感信息清理。

### 7. 输入、路径和工作簿写入使用失败关闭边界

第一版使用明确常量限制：

- JSON 请求体最多 256 KiB。
- 每次最多 100 个去重 set ID，每个 ID 最多 200 字符。
- 单个 manifest 和整个批次共同受总输出 2000 个数据行限制；不另设会拒绝用户参考商品中 20 个以上 SKU 的低上限。
- 每次最多解析或上传 5000 个去重图片资源。
- 单个本地上传图片最多 20 MiB，且必须是允许的图片扩展名、MIME 和普通文件。

超出请求、记录、行或唯一图片总量时，在任何网络上传或工作簿写入前返回 `400` 或 `413`。这些值由共享常量导出并直接测试，不散落在 UI 和服务端。

本地文件只从精确 manifest item 的 `relativePath` 解析。解析同时执行词法 containment、输出根和目标 `realpath` containment、`lstat` 普通文件检查，并拒绝空路径、绝对路径、`.`/`..` 段、符号链接、输出根本身和根外目标。端点不接受目标目录或任意本地文件路径，结果只作为 `.xlsx` attachment 返回。

所有外部文本在写入普通数据单元格前：

- 以字符串类型写入，禁止把用户或记录文本设置为公式。
- 去除 XML 1.0 不允许的控制字符；保留允许的制表、换行和回车。
- 对忽略前导空白后以 `=`, `+`, `-`, `@` 开头的文本使用电子表格安全的字面值编码，避免公式执行。
- 在 Unicode 字符边界将单元格限制到最多 32767 字符；截断时记录原长度和 `CELL_VALUE_TRUNCATED`。

数值列先通过严格有限数值、范围和整数规则校验，再以数值类型写入。模板自带并位于非数据输入区域的受信公式保留，数据映射不得覆盖未声明的公式单元格。

### 8. Local 支持，Cloudflare 显式不支持

`POST /api/creation/sets/export-temu-excel` 加入共享 API capability matrix：Local 为 `supported`，Cloudflare 为 `unsupported`，理由为该能力依赖本地 Creation manifest、受控输出文件和可持久化的 manifest 缓存。

Cloudflare Worker 对该路由返回现有 `unsupported_runtime_capability` JSON，不读取 R2 任务或浏览器临时状态来伪造记录，不代表用户上传图片到 Cloudinary，也不返回空的假工作簿。前端识别该 code 并显示本地应用要求。

### 9. 现有导出保持独立

Temu Excel 使用独立按钮、表单、端点和文件名。现有“导出提示词”“导出清单”“导出 Listing”仍使用当前详情记录和原有浏览器下载实现；它们的 enablement、payload、文件名和内容不因本 change 改变。

### 10. 套图记录在桌面以常驻双栏为默认工作面

套图记录页在桌面和宽屏 SHALL 维持左侧记录列表、右侧当前记录内容的常驻双栏。左侧为宽度受约束、可滚动、高密度且可扩展的列表，记录行显示独立勾选框、商品名、平台、完成数、创建时间、生成/Listing 状态和 Temu 导出状态；右侧自适应展示当前记录摘要、图片和 Listing。在桌面和宽屏布局中，点击记录 SHALL 只更新右侧当前记录内容，MUST NOT 隐藏左侧列表、进入互斥详情视图或要求用户返回记录列表；搜索、筛选、勾选和滚动状态保持不变。

列表不得静默截断。第一版使用有状态的分批显示，每批 60 套；界面始终显示“已显示 N / 匹配 M”，并在仍有结果时提供“加载更多”。筛选计数、全选/删除筛选结果和导出目标仍以完整匹配集合为准。列表展示和日期筛选统一使用 `createdAt`；`updatedAt` 只在详情中显示。

列表采用普通列表语义，每个记录标题由真实 `button` 选择当前记录并更新右侧内容，下拉菜单和勾选框保持独立键盘焦点，避免声明 `listbox/option` 却缺少完整方向键模型。移动端将列表与当前记录内容上下堆叠，记录选择器默认折叠、可按需展开，并在选择记录后自动收起；首层只保留“复用”“导出 Temu Excel”和“更多”，刷新、补图和删除按普通/危险操作分组收入菜单。

### 11. 预检是正式导出的共享阶段，不是浏览器猜测

新增本地 `POST /api/creation/sets/export-temu-excel/preflight`。请求复用正式导出的 set ID、默认值和可选 Cloudinary unsigned 配置；服务端执行 body/schema、manifest 身份、模板、总行数、字段映射、图片需求、安全本地路径、内容指纹、缓存复用及可选上传。随后对所有最终图片 URL 执行严格远程验证，返回 JSON 而不写工作簿。

预检响应至少包含模板名称/版本、set 数、SKU 行数、唯一图片数、待上传数、已上传数、缓存复用数、阻塞项数、提醒数、是否允许严格导出，以及逐记录的 SKU/图片/阻塞项/提醒摘要。问题项使用稳定 code、set、SKU、字段和清理后的说明；不得返回 API 配置、Secret、本地绝对路径或原始上游响应。

工作台打开后可以先显示基于当前已加载 manifest 的即时摘要，但“可以严格导出”只能来自最近一次服务端预检，且该预检必须与当前 set ID、表单值和记录 `updatedAt` 快照对应。任何选择、默认值或 Cloudinary 配置变化都会使旧预检失效。

### 12. 严格导出与待补全导出使用同一模板但不同失败语义

正式导出请求新增 `mode`：`strict` 或 `draft`。为兼容已发布客户端，省略 `mode` 等同 `draft`。待补全导出保持现有语义：数据或单图缺口写入问题 sheet，仍返回可人工修复的工作簿。

严格导出在模板、行模型、图片解析和上传后重新执行完整远程图片验证；预检结果只用于界面提示，不能替代导出时复核。任一错误级问题、缺少必填字段、缺少最终公网图片、远程图片不可达、重定向越界、响应非图片或 SKU/产品素材图不是宽高均大于 800 像素的正方形时，服务端返回 `422` 结构化 `TEMU_STRICT_EXPORT_BLOCKED`，包含有界、清理后的阻塞摘要，不生成工作簿、不更新成功导出状态。提醒级问题可以随严格工作簿进入问题 sheet。

SKU 预览图和产品素材图都必须通过大于 800×800 的正方形检查。轮播图只要求经验证的公网 HTTPS 图片，不额外猜测平台未声明的构图或语义。Cloudinary 素材图派生的 1200×1200 delivery URL也必须按最终 URL 实时验证。

### 13. 远程图片验证对 DNS、重定向和响应体失败关闭

远程验证只接受无凭据的公网 HTTPS URL。每一次请求和每一次手工处理的重定向都重新检查协议、主机和 DNS 解析结果；任一 A/AAAA 记录落入回环、链路本地、私网、保留地址或 IPv4-mapped IPv6 私网范围即拒绝。最多跟随 3 次重定向，不自动携带认证头、Cookie 或来源请求头。

验证使用 GET、总超时、响应字节流上限和有界并发。响应必须为成功或允许的分段成功状态，`Content-Type` 必须为受支持图片类型，并从实际 PNG、JPEG 或常见 WebP 字节解析宽高；声明的 `Content-Length`、文件名扩展名或 URL 参数不能替代内容检查。验证结果按最终 URL 在单次请求内去重，但问题必须展开到每个受影响行和模板字段。

### 14. 导出状态使用源更新时间判断是否过期

每套 manifest 增加版本化 `temuExcelExportState`，保存最近成功生成工作簿的 `mode`、`exportedAt`、导出时的 `sourceUpdatedAt`、行数和问题数。状态 merge 走现有每 set 串行保存队列，不修改业务 `updatedAt`，并保留并发生成、Listing、`temuExport` 事实字段和图片缓存。

列表状态规则固定为：没有状态为“未导出”；最近成功模式为 `draft` 时为“待补全导出”；最近成功模式为 `strict` 且 `sourceUpdatedAt` 与当前 `updatedAt` 相同为“已导出”；最近成功模式为 `strict` 但源时间已变化为“已修改”。严格导出在工作簿生成并完成回读校验后才写状态；状态写入失败不阻止已经生成的工作簿返回，但响应和问题 sheet记录 `EXPORT_STATE_WRITE_FAILED`，列表不得伪装为已写回。

### 15. 预检、导出与记录变更共用互斥边界

浏览器以一个 Temu 工作台 busy 状态覆盖预检、补传和导出。busy 时禁止重复提交，并禁用补齐图像、生成/重新生成 Listing、刷新和所有删除操作；现有生成或 Listing 请求进行中时不得启动预检或导出。搜索、时间筛选、滚动、勾选查看以及切换或查看右侧当前记录内容不修改 manifest，可继续使用。关闭按钮在网络阶段禁用，失败或成功后恢复焦点到打开工作台的命令。

## Architecture

### Browser Flow

1. 用户在桌面双栏左侧的套图记录列表勾选一到多套记录。
2. 用户打开 Temu 导出工作台，填写可选默认值及可选 `cloudName`/`uploadPreset`；工作台立即展示本地摘要并将严格导出保持禁用。
3. 浏览器基于当前完整已加载集合过滤 stale ID，向预检端点提交去重 `setIds`、规范化表单和当前 manifest `updatedAt` 快照。
4. 服务端完成图片补传和严格远程复核后返回批次摘要；只有与当前选择和表单仍匹配的成功预检可以启用严格导出。
5. 用户选择严格导出或待补全导出。浏览器向正式端点提交相同批次和 `mode`；服务端不信任旧预检并重新执行对应模式的最后检查。
6. 成功响应按 `Content-Disposition` 下载 `.xlsx`，并显示导出模式、记录数、SKU 行数和问题数；严格阻塞或其他失败显示结构化原因，工作台保持打开。

### Local Backend Flow

1. 在读取 body 时应用 256 KiB 上限并验证 schema，拒绝未知敏感 Cloudinary 字段。
2. 对所有 set ID 做去重、数量和长度校验，读取 manifest 并核对精确身份。
3. 验证模板和所有总量边界，构建商品、SKU 行、图片需求和初始问题清单。
4. 解析公网 URL和有效缓存；对剩余本地图片执行安全路径校验、内容指纹和有界 Cloudinary 上传。
5. 串行合并成功图片缓存，对所有最终 URL 做 DNS/重定向/响应/尺寸验证，随后完成每行字段映射和必填字段检查。
6. 预检请求在这里返回结构化摘要。严格正式请求若有阻塞项返回 `422`；待补全正式请求继续生成问题 sheet。
7. 从只读模板副本写入数据行和导出问题 sheet，验证工作簿可重新打开、目标 sheet/表头仍存在且行数一致。
8. 串行写入每套导出状态并返回固定 ASCII 基础名加 UTC 时间戳的 `.xlsx` attachment；不把商品名写入响应 header。

### Request Shape

```json
{
  "mode": "strict",
  "setIds": ["creation-set-1", "creation-set-2"],
  "defaults": {
    "variantAttributeName": "颜色",
    "defaultPrice": "19.99",
    "defaultPackageLengthCm": "20",
    "defaultPackageWidthCm": "12",
    "defaultPackageHeightCm": "6",
    "defaultPackageWeightG": "350",
    "defaultStock": "100",
    "defaultOriginCountry": "中国-广东省"
  },
  "cloudinary": {
    "cloudName": "example-cloud",
    "uploadPreset": "temu_unsigned"
  }
}
```

空 Cloudinary 配置使用空对象或省略整个对象。`mode` 只接受 `strict` 或 `draft`，省略时按兼容的 `draft` 处理。API 不接受 `apiKey`、`apiSecret`、`signature`、`authorization` 或 `uploadUrl`。

### Manifest Cache Shape

缓存字段使用版本化、可迁移的内部结构，不覆盖 item 当前 `imageUrl`：

```json
{
  "temuExcelImageCache": {
    "version": 1,
    "entries": {
      "item-id": {
        "sourceRelativePath": "2026-08/08-01/2026-08-01-creation/set/01-main.png",
        "sourceSha256": "sha256:...",
        "cloudName": "example-cloud",
        "secureUrl": "https://res.cloudinary.com/example-cloud/image/upload/...",
        "assetId": "...",
        "uploadedAt": "2026-08-01T12:00:00.000Z"
      }
    }
  }
}
```

不保存 upload preset、API Key、API Secret、Authorization header 或本地绝对路径。

### Manifest Export State Shape

```json
{
  "temuExcelExportState": {
    "version": 1,
    "mode": "strict",
    "exportedAt": "2026-08-05T12:00:00.000Z",
    "sourceUpdatedAt": "2026-08-05T11:58:00.000Z",
    "rowCount": 3,
    "issueCount": 0
  }
}
```

该结构不包含 Cloudinary 配置、绝对路径或工作簿内容，也不改变 manifest 的业务 `updatedAt`。

## Risks / Trade-offs

- **标准模板更新导致映射漂移** -> 通过版本、SHA-256 和关键表头验证失败关闭；模板升级作为独立规格变更处理。
- **大量 unsigned upload 耗时并消耗 Cloudinary 配额** -> 请求前完成边界验证，按内容指纹去重，限制并发、超时、记录数和唯一图片数，并复用 manifest 缓存。
- **unsigned preset 可被滥用** -> 不把 preset 描述为秘密；用户应在 Cloudinary 侧配置文件类型、大小、转换和配额限制。应用不请求 Secret，也不提供通用上传代理。
- **部分图片上传成功后工作簿生成失败** -> 先验证模板和行模型，再上传；成功 URL 写入 manifest 后可供重试复用。第一版不自动删除远端资源。
- **默认值被误解为已验证事实** -> 默认值只补空缺，问题表逐字段标记来源；系统不自动估算也不隐藏缺失。
- **模板列或必填规则不完整** -> 没有模板定义时停止；不根据相似表头猜测。
- **工作簿内容触发公式或 XML 问题** -> 所有外部文本走统一安全写入器并产生可审计问题记录，模板受信公式保持隔离。
- **预检通过后记录或远程图片发生变化** -> 正式严格导出重新读取 manifest 并重新验证全部最终 URL；浏览器的预检只控制交互，不作为服务端信任凭据。
- **远程图片检查成为 SSRF 或资源耗尽入口** -> 每个 DNS 结果和重定向都失败关闭，限制并发、总超时、响应字节和重定向次数，不转发认证信息。
- **状态写回让刚导出的记录被错误标记为已修改** -> 保存导出时的源 `updatedAt`，状态 merge 本身不推进业务更新时间；并发业务修改会自然显示“已修改”。
- **全量记录过多导致初次渲染卡顿** -> 分批渲染并明确已显示/匹配数量，不再静默截断，也不改变完整筛选集合的批量语义。
