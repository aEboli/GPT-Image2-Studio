## Why

套图记录已经保存商品输入、SKU、Listing 草稿和逐图结果，也已经提供独立于当前详情的多选状态，但现有导出仍只面向当前一套记录，且只生成提示词 TXT、记录 JSON 或 Listing JSON。用户要把多套商品整理到 Temu 标准 Excel 模板时，仍需逐套复制字段、逐张处理本地图片并手工补齐每个 SKU 行，容易发生漏行、错图、字段错位和把未证实尺寸重量当成真实值的问题。

需要在套图记录中增加显式的 Temu Excel 批量导出。导出必须使用用户确认的标准模板，按 SKU 一行写入；已有公网图片 URL 可以直接复用，本地图片可以在用户提供 Cloudinary `cloudName` 与 unsigned `uploadPreset` 时上传并使用返回的 `secure_url`。缺少 Listing、模板必填字段、可用图片或上传能力时，系统仍应生成可检查的待补全工作簿，并在独立问题表中说明缺口，而不是伪造内容或静默丢弃记录。

现有第一版虽然可以下载工作簿，但导出前只显示批次默认值表单，用户无法在界面中确认模板、SKU、图片、待上传资源和阻塞项，也无法区分“可严格导入检查”和“仅供人工补全”两类结果。套图记录还需要在宽屏保留“左侧记录列表、右侧当前记录图片和 Listing”的常驻双栏，同时让左侧列表支持搜索、筛选、多选、预检、严格导出、状态回写和持续加载；当前静默只渲染前 60 套的问题仍需修复。

## What Changes

- 在套图记录页复用现有勾选状态，增加“导出 Temu Excel”操作和本次导出表单；勾选记录继续独立于当前详情记录。
- 将套图记录在桌面和宽屏恢复为左侧可持续加载的高密度记录列表、右侧当前记录图片和 Listing 的常驻双栏；点击左侧记录只更新右侧内容。移动端将两区上下堆叠，记录选择器默认折叠、可按需展开，并在选择记录后自动收起；所有布局统一以创建时间支撑展示和日期筛选。
- 将导出表单升级为批次工作台，在写文件前展示模板、套数、SKU 行、图片、待上传、阻塞项、提醒和逐记录摘要，并允许重新预检。
- 保留“待补全导出”兼容路径，同时新增“严格导出”：严格导出必须先补传本地图片，再由本地服务重新验证每个最终公网 HTTPS 图片的 DNS、重定向、响应类型、大小和像素尺寸；任何阻塞项都会使整批失败且不返回工作簿。
- 新增本地 `POST /api/creation/sets/export-temu-excel`，接收有界、去重的 `setIds`、批次默认值和可选 Cloudinary unsigned 上传配置，返回基于用户提供的 `import_created_product_popTemu (2).xlsx` 标准模板生成的 `.xlsx`。
- 新增本地 `POST /api/creation/sets/export-temu-excel/preflight`，复用正式导出的读取、图片解析和严格验证边界并返回结构化批次摘要；Cloudflare 对两个端点均显式不支持。
- 按 manifest 中稳定的 SKU 顺序为每个 SKU 生成一行；没有可识别 SKU 的记录仍生成一行待补全记录并在问题表中标记，不静默跳过整套商品。
- 导出表单允许提供第一变种属性名、默认价格、包装长宽高、包装重量、库存和产地。已有明确记录值优先，默认值只补空缺，并在问题表中保留“用户批次默认值”来源；系统不得从图片、标题或相邻商品猜测尺寸、重量、价格、库存或产地。
- 复用可验证的公网 HTTPS 图片 URL。对于仅有本地输出文件的图片，可选调用 Cloudinary 官方 unsigned image upload 端点；请求只使用 `cloudName`、`uploadPreset` 和图片文件，不接受或持久化 API Secret。
- 将成功返回的 Cloudinary `secure_url`、本地源文件指纹和必要缓存元数据合并回对应 Creation manifest。缓存只在源文件指纹仍匹配时复用，失败上传不得写成成功缓存。
- 输出工作簿始终包含导出问题表，逐行列出缺 Listing、缺模板必填字段、缺图片、Cloudinary 配置缺失、上传失败、缓存写入失败以及内容清理或截断等问题。
- 增加请求大小、记录数、SKU 行数、唯一图片数和单图大小边界；严格校验 manifest 身份、本地输出根、真实路径、普通文件和符号链接边界。
- 对写入单元格的外部文本防护公式注入，移除 XML 1.0 不允许的控制字符，并保证任何单元格不超过 Excel 的 32767 字符限制；发生清理或截断时写入问题表。
- Cloudflare 明确返回现有 `unsupported_runtime_capability` 契约，不尝试读取本地 manifest、上传本地文件或伪造可下载的 Temu 工作簿。
- 将每套记录最近一次严格导出或待补全导出的模式、时间、源更新时间、行数和问题数保存到 manifest，使列表可区分“未导出 / 已导出 / 已修改 / 待补全导出”。
- 导出或预检期间统一锁定会改变同批记录的补图、Listing 生成、刷新和删除操作；搜索、筛选、滚动以及切换或查看右侧当前记录内容保持可用。
- 保持现有单套提示词 TXT、manifest JSON 和 Listing JSON 的导出入口、文件格式与行为不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`: 套图记录新增基于显式多选的 Temu 标准 Excel 批量导出、本地图片公网 URL 解析、导出问题报告和本地/Cloudflare 运行时边界。

## Impact

- Frontend: `public/index.html`、`public/app.js`、`public/styles.css` 恢复桌面常驻双栏、扩展左侧记录列表、点击切换右侧图片和 Listing，移动端使用默认折叠且选择后自动收起的记录选择器，并增加工作台式预检、严格/待补全模式、忙碌状态、导出状态和响应式操作层级。
- Backend: `server.mjs` 增加本地预检与严格导出阶段、远程图片验证、请求限制、manifest 读取与合并、图片 URL 解析和 `.xlsx` 响应。
- Libraries: 新增 Temu 模板定义、SKU 行映射、预检摘要、工作簿写入、问题表、单元格清理、Cloudinary unsigned 上传、远程图片验证、缓存及导出状态辅助模块；工作簿必须通过结构化 XLSX 库处理，不手写或拼接 Open XML。
- Storage: 用户确认的标准 Temu 模板作为只读、版本化资源；成功的 Cloudinary 图片 URL、源指纹和最近导出状态缓存到对应 Creation manifest，不保存 API Secret。
- API contract: `/api/creation/sets/export-temu-excel` 与 `/api/creation/sets/export-temu-excel/preflight` 在 Local 为 supported，在 Cloudflare 为 unsupported。
- Tests: 增加模板身份、SKU 行映射、默认值来源、缺失问题、公式/XML/长度防护、路径和符号链接安全、Cloudinary 成功/失败/无配置、远程公网图片、严格失败关闭、manifest 合并、导出状态、Local API、Worker capability、列表扩展和现有导出不回归覆盖。
