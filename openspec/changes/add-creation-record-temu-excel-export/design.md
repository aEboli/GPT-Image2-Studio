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
- 对请求、模板、路径、图片、工作簿文本和运行时能力建立明确的失败关闭边界。
- 保持现有 TXT/JSON/Listing 导出完全兼容。

**Non-Goals:**

- 不自动发布、上传或提交商品到 Temu，也不调用 Temu 卖家 API。
- 不声称生成的工作簿已经通过 Temu 审核或具备发布资格。
- 不从图片、模型输出或相邻 SKU 猜测价格、尺寸、重量、库存、产地、类目 ID 或其他缺失事实。
- 不在第一版实现字段级人工表格编辑器、单位或币种自动换算、远程 Cloudinary 资源删除或资产生命周期管理。
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

## Architecture

### Browser Flow

1. 用户在套图记录列表勾选一到多套记录。
2. 用户打开“导出 Temu Excel”表单，填写可选默认值及可选 `cloudName`/`uploadPreset`。
3. 浏览器基于当前完整已加载集合过滤 stale ID，提交去重 `setIds` 和规范化表单。
4. 导出期间只锁定重复导出和可能改变同一记录的危险操作；当前详情、筛选和滚动保持不变。
5. 成功响应按 `Content-Disposition` 下载 `.xlsx`，并显示导出记录数、SKU 行数和问题数；失败响应显示结构化错误。

### Local Backend Flow

1. 在读取 body 时应用 256 KiB 上限并验证 schema，拒绝未知敏感 Cloudinary 字段。
2. 对所有 set ID 做去重、数量和长度校验，读取 manifest 并核对精确身份。
3. 验证模板和所有总量边界，构建商品、SKU 行、图片需求和初始问题清单。
4. 解析公网 URL和有效缓存；对剩余本地图片执行安全路径校验、内容指纹和有界 Cloudinary 上传。
5. 串行合并成功图片缓存，随后完成每行字段映射和必填字段检查。
6. 从只读模板副本写入数据行和导出问题 sheet，验证工作簿可重新打开、目标 sheet/表头仍存在且行数一致。
7. 返回固定 ASCII 基础名加 UTC 时间戳的 `.xlsx` attachment；不把商品名写入响应 header。

### Request Shape

```json
{
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

空 Cloudinary 配置使用空对象或省略整个对象。API 不接受 `apiKey`、`apiSecret`、`signature`、`authorization` 或 `uploadUrl`。

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

## Risks / Trade-offs

- **标准模板更新导致映射漂移** -> 通过版本、SHA-256 和关键表头验证失败关闭；模板升级作为独立规格变更处理。
- **大量 unsigned upload 耗时并消耗 Cloudinary 配额** -> 请求前完成边界验证，按内容指纹去重，限制并发、超时、记录数和唯一图片数，并复用 manifest 缓存。
- **unsigned preset 可被滥用** -> 不把 preset 描述为秘密；用户应在 Cloudinary 侧配置文件类型、大小、转换和配额限制。应用不请求 Secret，也不提供通用上传代理。
- **部分图片上传成功后工作簿生成失败** -> 先验证模板和行模型，再上传；成功 URL 写入 manifest 后可供重试复用。第一版不自动删除远端资源。
- **默认值被误解为已验证事实** -> 默认值只补空缺，问题表逐字段标记来源；系统不自动估算也不隐藏缺失。
- **模板列或必填规则不完整** -> 没有模板定义时停止；不根据相似表头猜测。
- **工作簿内容触发公式或 XML 问题** -> 所有外部文本走统一安全写入器并产生可审计问题记录，模板受信公式保持隔离。
