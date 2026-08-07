## 1. 模板契约与测试夹具

- [x] 1.1 已确认用户标准模板 `import_created_product_popTemu (2).xlsx`（SHA-256 `8008B60BB1CCBD8F45D7B07F41445379BAC79B62CAEE9FD2465ADB95AAAD6DC8`，12,892 字节）：`导入模板` 为 A1:AY1 共 51 列、数据从第 2 行写入，`导入示例` 保留；必填列、图片 URL 约束和字段映射已写入 design，实施时保存只读版本化副本并继续核对公式/验证区域。
- [x] 1.2 增加最小模板测试夹具和失败测试，覆盖模板缺失、哈希/版本不匹配、目标 sheet 缺失、关键表头漂移及 `导出问题` sheet 名称冲突。
- [x] 1.3 选择并接入可结构化读取/修改现有 XLSX 的库，证明加载和保存模板后未映射 sheet、列序、格式、冻结窗格、数据验证和受信公式保持不变。

## 2. 导出请求与 SKU 行模型

- [x] 2.1 先增加导出请求规范化测试，覆盖 256 KiB body、最多 100 个去重 set ID、ID 类型/长度、未知字段、第一变种属性名、默认值范围、Cloudinary 两字段同时提供或同时为空，以及敏感 Cloudinary 字段拒绝。
- [x] 2.2 实现共享 Temu 导出请求、限制常量和默认值规范化模块，使用带单位字段并保持浏览器与本地 API 规则一致。
- [x] 2.3 先增加 SKU 行映射测试，覆盖多 set 顺序、每 SKU 一行、商品字段重复、SKU 特有字段隔离、稳定 row key、最多 2000 行，以及无 SKU 时生成一个带 `MISSING_SKU` 的待补全行。
- [x] 2.4 实现从规范 Creation manifest 和现有 Listing 兼容读取结果构建商品/SKU 行的纯函数，不从文件名、图片或提示词发明 SKU 或商品事实。

## 3. 字段真实性与导出问题

- [x] 3.1 先增加字段优先级测试，固定已保存明确值优先、用户默认值只补空字段、空缺保持空白且不写 `0`/`N/A`/虚构内容。
- [x] 3.2 实现价格、厘米长宽高、克重量、整数库存和产地默认值应用，并为每个默认字段生成 `USER_DEFAULT_APPLIED` 来源问题。
- [x] 3.3 先增加缺 Listing、缺模板必填字段、缺 SKU 和非 Temu/历史兼容记录测试，确认导出不调用模型、不翻译、不重写 Listing，且每个缺口可定位到 set、SKU、行和模板字段。
- [x] 3.4 实现稳定的导出问题模型和问题 sheet 写入器，包含严重级别、代码、set、商品、SKU、行、字段、来源、说明和建议处理；无问题时仍输出表头。

## 4. 工作簿内容安全

- [x] 4.1 先增加公式注入测试，覆盖去除前导空白后以 `=`, `+`, `-`, `@` 开头的外部文本，同时证明模板受信公式不被转义或覆盖。
- [x] 4.2 先增加 XML 1.0 非法控制字符、允许的 tab/换行/回车、无效 Unicode 和 32767 字符边界测试，确认清理与截断均产生问题记录且不会生成损坏工作簿。
- [x] 4.3 实现统一安全单元格写入器：文本字面值编码、XML 控制字符清理、Unicode 边界截断、严格数值类型和字段长度限制。
- [x] 4.4 增加输出工作簿回读校验，确认模板身份、目标 sheet、写入行数、问题行数、数据类型和文件非空。

## 5. 图片 URL 与 Cloudinary unsigned upload

- [x] 5.1 先增加公网 URL 分类测试，覆盖可复用公网 HTTPS、相对 `/output`、HTTP、data/blob/file、带凭据 URL、localhost、回环、链路本地和私网目标。
- [x] 5.2 先增加本地图片路径测试，覆盖空/绝对/遍历/根路径、符号链接、realpath 逃逸、非普通文件、扩展名/MIME 不允许、单图超过 20 MiB及安全输出根内图片。
  - 当前 Windows 环境不允许创建测试符号链接；该分支有用例，但本轮聚焦测试按环境能力跳过。
- [x] 5.3 实现按 manifest item 精确解析图片需求的路径安全和公网 URL 模块，端点不得接受客户端本地源路径或目标目录。
- [x] 5.4 先使用伪造 HTTP client 增加 Cloudinary 测试，覆盖固定官方 upload URL、multipart `file`/`upload_preset`、无 Secret、超时、非 2xx、超大/非法 JSON、缺失或非公网 `secure_url`、受限重试与最多 5000 个唯一图片边界。
- [x] 5.5 实现有界 Cloudinary unsigned uploader，固定官方 image upload 主机，拒绝自定义 endpoint、签名、Authorization、Cookie、API Key 和 API Secret。
- [x] 5.6 先增加内容指纹与缓存测试，覆盖请求内去重、相同源复用、源文件变化、cloudName 变化、缓存 URL 失效、上传失败不缓存及缓存写入失败继续导出并报告。
- [x] 5.7 实现版本化 `temuExcelImageCache` 及每 set 串行 merge-save，保留并发 Listing/生成字段，不持久化 upload preset、Secret 或本地绝对路径。
- [x] 5.8 实现无 Cloudinary 配置和部分上传失败的降级：仍生成工作簿，受影响图片单元格留空，并在问题 sheet 展开到所有相关 SKU 行。

## 6. Local API 与运行时契约

- [ ] 6.1 先增加本地 API 集成测试，覆盖 `POST /api/creation/sets/export-temu-excel` 成功附件、去重 ID、精确 manifest 身份、模板致命错误、超限、无配置待补全工作簿、部分上传失败和成功缓存。
- [x] 6.2 实现本地端点的阶段顺序：body/schema 校验、manifest 精确读取、模板/总量预检、图片解析/上传、缓存 merge、工作簿生成、回读校验和 `.xlsx` attachment。
- [x] 6.3 使用固定 ASCII 文件名前缀与 UTC 时间戳设置安全 `Content-Disposition`、正确 XLSX MIME、`no-store` 和问题/行数响应元数据；不得把商品名写入 header。
- [x] 6.4 更新共享 API capability matrix，并增加 Worker 测试确认 Cloudflare 返回 `unsupported_runtime_capability`，不读取 R2、浏览器缓存或调用 Cloudinary，也不返回空假工作簿。

## 7. 套图记录界面

- [x] 7.1 先增加静态与控制器测试，确认导出复用 `recordCheckedSetIds`、勾选不改变当前详情、stale ID 被过滤、无选择或导出忙碌时禁用、成功后筛选/勾选/当前详情/滚动不变。
- [x] 7.2 在套图记录工具栏增加紧凑的“导出 Temu Excel”命令和表单，包含第一变种属性名、默认价格、厘米长宽高、克重量、库存、产地及可选 `cloudName`/`uploadPreset`，并提供清晰的单位和 unsigned 提示。
- [x] 7.3 实现请求、XLSX 下载、结构化错误、Cloudflare 本地能力提示，以及导出记录数、SKU 行数、问题数和实际问题 sheet 名称反馈。
- [ ] 7.4 增加回归测试，证明现有当前套图提示词 TXT、manifest JSON 和 Listing JSON 导出按钮、enablement、文件名与 payload 未变化。

## 8. 文档与验证

- [x] 8.1 更新 README/API 能力和安全说明，明确这是本地模板生成而非 Temu 发布、Cloudinary preset 不是 Secret、缺失字段需要人工补全、云端不支持及远端资产生命周期由用户管理。
- [x] 8.2 运行 Temu 导出、Creation store、Local API、API contract、Worker、套图记录 UI 和模板回读聚焦测试。
  - 聚焦测试共 `69` 项：`68` 通过，`1` 项因当前 Windows 配置禁止创建测试符号链接而跳过。
- [x] 8.3 运行完整 `npm test`、`npm run sync:public-lib -- --check`、`npm run check:release`、`npm run build:pages`、change 与全项目 OpenSpec strict validation、`git diff --check` 及新增中文 UTF-8/替换字符扫描。
  - 完整测试 `1569` 项（`1568` 通过、`1` 跳过、`0` 失败）；公共模块 `89` 个；OpenSpec 严格验证 `25/25` 通过；Pages 构建与差异检查通过。跳过项是当前 Windows 权限不允许创建测试符号链接。
- [ ] 8.4 在真实本地应用用至少两套记录和多个 SKU 验证完整导出、无 Cloudinary 待补全导出、部分上传失败、缓存复用、问题 sheet、现有单套导出不回归和无 UI 重叠；不得把工作簿生成视为 Temu 实际导入验收。
- [ ] 8.5 使用用户确认的 Temu 导入工具或卖家后台进行人工 dry-run/校验时，只记录平台真实返回的字段错误；不自动发布商品，不绕过登录、验证码或平台保护。

## 9. 扩展规格与既有缺口修复

- [x] 9.1 同步 proposal、design、增量 spec 与 tasks，明确桌面常驻双栏和左侧可扩展记录列表、服务端预检、严格/待补全双轨、远程图片失败关闭、导出状态和统一互斥边界，并通过 change strict validation。
- [ ] 9.2 先增加 Creation store 回归测试，证明 set/SKU `temuExport` 事实和 `temuExcelExportState` 经过 save/read/merge 后保持，且状态写入不推进业务 `updatedAt`。
- [ ] 9.3 先增加公网 URL 与图片映射回归测试，覆盖 IPv4-mapped IPv6 私网拒绝，以及 hero 位于第 10 张共享图之后时仍优先成为产品素材图。
- [ ] 9.4 修复上述 store、URL 和素材图优先级缺口并同步 `lib` 与 `public/lib`。

## 10. 预检与严格远程图片验证

- [ ] 10.1 先增加预检纯函数测试，覆盖模板/set/SKU/图片/待上传/缓存/阻塞/提醒统计、逐记录摘要、敏感信息清理和稳定问题 code。
- [ ] 10.2 先增加远程图片验证测试，覆盖 DNS 公网检查、IPv4-mapped IPv6、每次重定向复核、最多 3 次重定向、总超时、流式字节上限、非图片响应，以及 PNG/JPEG/WebP 尺寸解析。
- [ ] 10.3 实现不依赖原生图像扩展的有界远程图片验证模块，并把结果展开到每个 SKU/模板图片字段。
- [ ] 10.4 实现严格阻塞判定：必填字段、最终公网图片、SKU 预览图和产品素材图大于 800×800 正方形；提醒不得被错误提升为阻塞。

## 11. Local API、状态与严格失败关闭

- [ ] 11.1 在共享 API capability matrix 增加 `POST /api/creation/sets/export-temu-excel/preflight`，Local supported、Cloudflare unsupported，并补 Worker 不访问 R2/Cloudinary 的契约测试。
- [ ] 11.2 实现预检端点，复用正式导出的 schema、manifest、模板、总量、路径、缓存、上传和远程验证阶段，返回有界 JSON 摘要而不生成工作簿。
- [ ] 11.3 为正式端点增加 `mode`；省略为 `draft`，`strict` 在写工作簿前重新验证并以 `422 TEMU_STRICT_EXPORT_BLOCKED` 整批失败关闭。
- [ ] 11.4 实现每 set 串行 `temuExcelExportState` merge；严格成功、待补全成功、并发修改和 `EXPORT_STATE_WRITE_FAILED` 均有 API 集成测试。
- [ ] 11.5 补齐任务 6.1 的模板致命错误与 `IMAGE_CACHE_WRITE_FAILED` API 集成分支，并确认预检和正式端点在任何上传前执行模板/总量检查。

## 12. 桌面双栏记录页与 Temu 导出工作台

- [x] 12.1 先增加记录列表测试，覆盖超过 60 套时的“已显示 N / 匹配 M”和加载更多、创建时间一致性、普通列表语义、导出状态四态，桌面常驻双栏及点击记录后左侧列表、已加载行数、滚动和筛选保持不变，并覆盖移动端选择器默认折叠、展开可见和选择后自动收起。
- [x] 12.2 将宽屏套图记录恢复为左侧可扩展记录列表、右侧当前记录图片和 Listing 的常驻双栏，点击左侧记录只更新右侧；移动端将两区上下堆叠，记录选择器默认折叠、可按需展开且选择后自动收起，并只保留复用、Temu 导出和更多，把刷新、补图及删除按层级收入菜单。
- [ ] 12.3 将导出弹窗升级为工作台，展示模板、set、SKU、图片、待上传、缓存、阻塞、提醒和逐记录摘要，并实现预检过期规则。
- [ ] 12.4 实现严格导出/待补全导出分段选择、严格按钮禁用原因、结构化阻塞列表、成功状态回写后的列表刷新及单一表单主体滚动。
- [ ] 12.5 统一预检/导出 busy 与补图、Listing、刷新、删除的互斥；搜索、筛选、滚动、勾选以及切换或查看右侧当前记录内容保持可用。
- [ ] 12.6 完成任务 7.4：用统一回归测试固定旧 TXT、manifest JSON 和 Listing JSON 的 enablement、目标记录、文件名、payload 与 Temu 勾选批次隔离。

## 13. 完整验证与视觉验收

- [ ] 13.1 运行新增失败测试并确认修复后通过，再运行 Temu、Creation store、Local API、API contract、Worker、列表/工作台和旧导出聚焦测试。
- [ ] 13.2 运行完整 `npm test`、`npm run sync:public-lib -- --check`、`npm run check:release`、`npm run build:pages`、OpenSpec 全量 strict validation、`git diff --check` 及中文 UTF-8/替换字符扫描。
- [ ] 13.3 在隔离端口和临时输出目录构造至少 75 套记录、两套多 SKU 完整记录及缺字段/无 Cloudinary/上传失败/缓存复用/严格失败场景，验证现有服务不受影响。
- [x] 13.4 使用 in-app Browser 在 `1728×947` 与参考图同状态截图，并验证桌面、平板和 `390×844` 移动端无重叠、关键交互和控制台错误；把参考图与实现截图放入同一比较输入，迭代到根目录 `design-qa.md` 为 `final result: passed`。
