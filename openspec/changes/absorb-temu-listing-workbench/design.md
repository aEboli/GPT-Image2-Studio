# 设计：把 TEMU 本地上品台并入 Studio

## 与 add-creation-record-temu-excel-export 的关系

`openspec/changes/add-creation-record-temu-excel-export` 仍是 live change（`tasks.md` 尚有 23 项未勾选），且与本变更作用于同一条导出路径。`openspec validate --strict` 检测不到两个 live change 之间的语义冲突，因此逐条声明边界：

**本变更取代的部分**

- 无。该 change 已定的批量导出语义（`setIds` 驱动、预检、严格/待补全模式、Cloudinary unsigned 上传、逐 SKU 行、公式注入与 32767 字符防护、`temuExcelExportState` 回写）全部保留，行为字节级不变。

**本变更扩展的部分**

- 入口层级：`导出 Temu Excel` 按钮原先直接 `showModal()` 打开批量工作台弹窗；现在改为打开覆盖层，批量工作台成为覆盖层内第二个平级标签。该 change 规定的“导出表单升级为批次工作台”“严格/待补全分段选择”“预检过期规则”“busy 互斥”全部在标签二内原样成立，仅多一层可见的标签导航。
- 工作簿写入器：新增 `includeIssueSheet` 选项。该 change 规定“输出工作簿始终包含导出问题表”——该规定继续约束批量路径（默认 `true`），本变更不改动它；新增的草稿驱动路径按待决决定输出 2 sheet，属于新增能力的独立契约，不是对既有要求的削弱。
- 表头来源：该 change 的 `lib/creation-temu-export.mjs` 表头常量改为从 `lib/temu/template-headers.mjs` 再导出。导出名与值均不变，其模板身份校验要求不受影响。
- 远程图片验证：该 change 的任务 10.2/10.3 已实现 `lib/creation-temu-remote-images.mjs`；本变更让被吸收的校验器复用它，并按其任务 9.3 的方向补齐 IPv4-mapped IPv6 与素材图优先级缺口。

**两者共同待决**

- 该 change 的任务 8.5 要求由人工在真实卖家后台做 dry-run 校验。批量路径产出 3 sheet 而商家实际上传成功过的均为 2 sheet，这一条只能由该人工验收消除，不能由自动化测试消除。本变更据此把工作台路径定为 2 sheet，不改动批量路径。

## 宿主选择

三个候选宿主中选择**同源 iframe 覆盖层**，依据是可复核的硬事实而非偏好。

**为什么不注入进现有页面**（即不做原生 Studio 视图）

- `excel-temu-dxm/public/app.js` 有 45 处无保护的顶层 `document.querySelector("#id").addEventListener`，以及一处 import 期的 `[data-view]` 捕获。不做 `init(root)` 重构，模块在 import 时即抛错。
- `excel-temu-dxm/public/styles.css` 开头的 `*` / `html` / 两条 `body` / `body::before|after`（`position: fixed; inset: 0` 的整屏渐变层，正是其外观本体）/ `svg { width: 18px }` / 裸 `dialog { width: min(500px, …) }` 无法被任何包裹类收住。Studio 恰好没有裸 `dialog` 规则，且有多个 `select` 与 `dialog` 会被击中。
- `.app-shell`、`.topbar`、`.field`、`.icon-button`、`.nav-item`、`.app-version`、`.brand-mark` 七个结构类两边都在顶层定义，胜负只取决于样式表顺序且不报错。
- 代价量级：约 183 处 `querySelector` 重新限定作用域、116 个 id 加前缀、480 个选择器加作用域、25 处视口单位重算。付出这些之后仍是深色孤岛（TEMU 为 `color-scheme: dark` 且无浅色变体）。

**为什么不用弹窗或新窗口**

- `desktop/main.mjs` 的 `setWindowOpenHandler` 对所有 URL 返回 `{ action: "deny" }`。
- 回环 `http` 又先在 protocol 上被 `desktop/url-policy.mjs` 的外链策略拒绝（只放行 `https://github.com` 下的路径）。
- 二者叠加的后果是：`window.open("/temu/")` 在浏览器里工作，在打包安装版里静默失效。这是本次吸收最容易踩且最难发现的坑——浏览器冒烟测试会通过。
- `<webview>` 已被 `will-attach-webview` 拦掉。

**为什么不用整页跳转**

- `will-navigate` 会放行同源 `http://127.0.0.1` 的导航，但整页跳转会替换唯一的 `BrowserWindow`，丢掉 `state.creation.sets` 与所有在跑的生成任务。

**为什么覆盖层而不是模态 dialog**

- TEMU 的图片灯箱是 `width: 100vw; height: 100dvh`，图片 `max-width: 90vw`。装进受 `min(1600px, 96vw) × min(96svh, 1000px)` 约束的 dialog 后，“全屏看图”在结构上不可能成立——而这正是用户用来检视生成图的功能。这一条独立成立，足以定案。
- 另有一处具体隐患：现有 `#creationRecordTemuExportDialog` 内是一个 `<form>`；把 iframe 嵌进该 form 会让工作台与批量表单共享同一个 form 元素，一次误触回车即触发批量导出的 submit。

覆盖层为 `position: fixed; inset: 0`；标签二仍用 `showModal()`，dialog 进 top layer 天然盖在覆盖层之上，不需要 z-index 博弈。

## 跨文档协议

只有两类消息，均带 `targetOrigin`/`origin` 校验，且在 spec 中固定：

- 父页 → frame：`temu-workbench:init { setIds, theme, lang }`（首次 load 后下发，用于预选刚勾选的记录并同步主题语言）、`temu-workbench:theme { theme }`（Studio 侧切换主题时补发）。
- frame → 父页：`temu-workbench:request-close`。这是“焦点在 frame 内时 Escape 关不掉宿主”的修法：frame 自己的 keydown 先处理它内部的 dialog 与上下文菜单，判据用 `document.querySelector("dialog[open]")` 而不是数个数（子文档现有 6 个 dialog，写死数量会随改动漂移），无任何打开时才向父页请求关闭覆盖层。

关闭覆盖层只隐藏、不卸载 frame，使草稿、滚动位置与未上传的 `blob:` 预览在重新打开后仍在。

## 依赖消除

| 依赖 | 处置 | 依据 |
| --- | --- | --- |
| `@oai/artifact-tool` | 删除，不 vendor | 全仓仅一处 import，只用到 4 个 API，均由 `exceljs` + `lib/creation-temu-workbook.mjs` 覆盖。第 5 个 API `workbook.inspect` 仅测试调用，由 `assertGeneratedWorkbook` 加同一测试已在用的 JSZip 断言接手。它不可能进 CI：未发布到公共 npm，本机仅靠 NTFS junction 解析。 |
| `sharp` | 删除 | 唯一用途是读远程图片宽高与格式，`lib/creation-temu-remote-images.mjs` 已用纯 JS 做同一件事，且在其余方面是严格超集（无 DNS 的字面 IP 检查、私网/保留 CIDR 表、逐跳重定向复核、超时、按 URL 去重与并发池）。零测试改动：相关测试全部注入校验器，从未真跑过 `sharp`。 |
| `lucide` | 构建期烘焙 | `lucide` 根本不是本仓库的依赖，而 `lucide-static` 是 devDependency——浏览器安装器虽然会在目标机执行 `npm ci --omit=dev` 生成 `node_modules`，但 `--omit=dev` 恰好把它排除；Electron 打包白名单也不含 `node_modules`。照抄原来那条 `/vendor/lucide.js` 路由会让所有 `<i data-lucide>` 渲染成空元素且无任何测试会红。做法是从 `lucide-static` 生成字形子集 + 极小 shim。选 shim 而非改成 inline `<svg>`，因为部分字形名是 `data-lucide="${…}"` 的模板字符串动态值，改标记必踩。 |

净依赖增量：0 运行期、0 开发期、0 原生预编译。

**明确接受的能力损失**（写在此处以免日后被当成 bug）

- 图片字段变为仅 HTTPS。被吸收的校验器曾容忍 `http` 并加警告，但其领域规则对图片本就要求 HTTPS，故只影响非图片字段，而那些字段不做远程校验。
- 失去 AVIF/BMP/GIF/TIFF 尺寸探测。这会放大 Studio 已有的裂缝——本地上传允许 `.avif`/`.gif`，远程校验器却读不了。阶段二用新增 AVIF/GIF 头解析器向前修，不把 `sharp` 请回来。

## 单一写入器

评审对“一个写入器还是两个”争议最大，用一处已核实的事实解决：`writeDataRows` 是按表头取值的（遍历表头读 `row.cells[header]`），而 `assertTemplateStructure` 只校验 `导入模板`/`导入示例` 两表、不校验 sheet 总数。因此把被吸收的 51 元素定位数组与表头 zip 成 `cells` 对象，即可原样复用现有写入器，连带白拿 `sanitizeTemuCellText`（公式字面量标记、32767 截断、控制符清理）与回读断言。

`includeIssueSheet` 开关同时中和两条致命项：既避免“唯一路径都是 3 sheet、没有退路”，也避免“同一文件里两个写入器、每次模板迁移改两处，且新的那个绕过单元格清理”。

一处必须配套的清理缺口：`sanitizeTemuCellText` 在该模块有两处调用点——`:118`（`sanitizedIssueValue`，喂给 `writeIssueSheet`）与 `:168`（`writeDataRows`）。`includeIssueSheet: false` 跳过 `writeIssueSheet` 时，`:118` 那处清理也随之不再执行，因此工作台路由把问题清单放进 JSON 响应之前必须自行过 `sanitizeCreationTemuPreflightText`，否则本地绝对路径会漏给前端。

## 刻意保留的重复

唯一刻意保留的重复是两个 plan builder：`createTemuExportPlan`（`setIds` 驱动）与 `buildTemuDraftPlan`（手编草稿驱动）。它们共用同一个 `{ rows: [{ cells, … }], issues }` 形状，因此共用同一个写入器、同一次模板加载、同一次 SHA 校验、同一次回读。这个缝正是让阶段二三能在不重做阶段一的前提下收敛的地方。

为此在阶段一就建好 golden-draft 等价测试：同一份归一化后的草稿分别过两条映射，断言 51 元素定位数组等于 `表头.map(h => row.cells[h])`。其中 `null` 与 `""`、number 与 string 的换算表就是测试本体——被吸收侧对空文本与非有限数返回 `null`，Studio 侧写 `""`；被吸收侧逐列选 text/number，Studio 侧按 `typeof` 分支并给字符串盖 `numFmt "@"`。

## 规则分歧逐条裁决

七处两边规则不一致。用户已确认原则：**每条路径保留今天的行为**，优化留待后续。

| 项 | 被吸收侧 | Studio 侧 | 本次裁决 |
| --- | --- | --- | --- |
| `产品描述` | 逐行转义 + hero `<img>` + 500 字上限 | 检测到标签即原样透传 | 采逐行转义。原行为是可下载文件里的注入面，属安全修复而非口味。 |
| 轮播/包装超限 | 硬报错 | 静默 `slice(0, 10)` | 阶段二改为发 `CAROUSEL_TRUNCATED` 警告，不静默截断。 |
| `变种属性名称一` | 18 值白名单 | 无约束 | 工作台采白名单（今天的行为）。 |
| `SKU货号` | 非空 + 禁中文 + 不区分大小写唯一 | 较宽 | 工作台采严格规则（今天的行为）。 |
| `产地` | `中国大陆-<省>` 复合格式 | 单值 | 工作台采复合格式（今天的行为）。 |
| URL 受理 | `inspectPublicUrl` 容忍 http 加警告 | 图片一律 HTTPS | 分两层：图片字段一律走远程校验器；容忍 http 的那条只留给 `站外产品链接`/视频/说明书/`来源URL`。 |
| `产品素材图` | 原样写 `carousel[0].url`，仅 sku 角色校验正方 | 改写为 Cloudinary `c_pad,b_white,h_1200,w_1200` 派生 URL，且正方规则同时套到 material | **工作台写用户选定的原始 URL、仅给警告**（用户已决定）。批量路径不变。 |

另两条按用户决定固定：

- **工作表数量**：工作台 2 sheet，批量路径保持 3 sheet 不动。
- **物流预估**：工作台照被吸收侧解析并预填。同一份真实 manifest 文本（`Estimated: 18 cm x 8 cm x 4 cm` / `Estimated: 145 g`）在被吸收侧解析为 `{18, 8, 4}` / `145`，在 Studio 侧返回 `null` 并抛 `ESTIMATED_VALUE_IGNORED`。工作台沿用预填，批量路径不变。

所有移植过来的校验文案必须过 `sanitizeCreationTemuPreflightText`，否则本地绝对路径会漏进可下载的问题表。

`freightTemplateId` 被 `validateDraft` 要求但不属于 51 列、也不在行映射里，它只是必填门禁；保留浏览器侧把该 id 强制回默认值的现有行为。

## 服务端挂载

- `/api/temu/*` 五个分支插在现有 `export-temu-excel/preflight` 分支之后（API 等值段内，先于 `/output/` 前缀分支）。这些分支都是 `url.pathname === "…"` 等值判断，互不遮蔽。
- 所有非 GET 路由必须位于 `/api/` 前缀下：CSRF 检查对 `/api/` 之外的非 GET 请求直接放行，故导出端点必须是 `/api/temu/export`，不能是 `/temu/export`。
- 认证零需额外接线：`routeRequest` 在任何路由匹配之前对每个请求执行授权。
- `GET /temu/` 与 `GET /temu` 需显式路由到子文档 `index.html`。`resolveSafeFile` 不做 `isFile()` 检查，目录请求会先发出 200 头再在 `createReadStream` 抛 `EISDIR`，而 catch 只处理 `ENOENT`，结果是“已发头的截断 200 + 服务端异常”。
- 静态分支必须插在宽 `GET` publicDir 兜底之前：该兜底在 `resolveSafeFile` 返回 null 时会直接 403 返回，且一旦将来出现 `public/temu/` 目录就会完全遮蔽。
- 被吸收的 `securityHeaders()` 不可照搬：其 `x-frame-options: DENY` 与 `frame-ancestors 'none'` 都会禁掉本设计所需的 iframe，`script-src 'self'` 还会破坏 Studio 现有的内联脚本。
- 同一变更内收窄 `/lib/` 兜底到镜像白名单，并给 `decodeURIComponent` 包 try/catch 使畸形转义返回 400 而非 500。前者是既有暴露面（整个 `lib/` 树可被 `GET /lib/<name>` 读取，含 `local-server-auth.mjs` 与二进制模板），吸收进来的服务端模块会扩大它，故一并处理。收窄前需 grep `public/` 下所有 `/lib/` 引用逐条确认都在白名单内。

## 被吸收侧的已知缺陷（保留今天行为，记录在案）

用户已定原则：每条路径保留今天的行为，优化留待后续。下列各条是对抗验证在被吸收侧实测出的缺陷。工作台沿用它们**不是**因为它们正确，而是因为改动它们会改变用户今天依赖的行为。逐条记录，避免日后被当成本次引入的 bug。

- **`产地` 空值产出畸形串**：`normalizeOrigin` 对 `""`、`"中国"`、`"中国大陆"` 一律返回 `"中国大陆-"`（尾随连字符），而 `validateDraft` 对 `origin` 一条校验都没有（`"NotACountry-Nowhere"` 也放行）。`createDefaultDraft` 还把 `"中国大陆-广东省"` 作为默认值——这是凭空捏造的事实，与 Studio「不编造」的设计相反。Studio 侧缺值走 `MISSING_REQUIRED_FIELD`。
- **`变种属性名称一` 白名单是静默改写而非报错**：不在 18 值表内的值被 `normalizeVariantAttribute` 静默 fallback 成 `"颜色"`，`errors` 为空。实测 `"尺码"` → `"颜色"`。表内既无 `尺码` 也无 `尺寸`，服装类最常用的属性名会被无声篡改。Studio 侧 `"尺码"` 原样保留。该表是否为 Temu 平台完整合法集，值得回源核对。
- **`产品描述` 500 字截断有悬崖**：`truncateProductDescription` 在 500 字前缀里找最后一个 `.` 或 `。` 并切到那里。实测 `"First sentence. " + 600 个 x` 截成 15 字符；`"A. " + 1000 个 y` 截成 2 字符。而 Studio 自己的策略是 `recommendedMaxChars: 1200`、`hardMaxChars: null`，1200 字描述是正常产物、喂给被吸收侧直接 `max_length` 失败。
- **`产品描述` 对已含 HTML 的输入是二次转义**：被吸收侧把 `<p>Already <b>HTML</b></p>` 转成字面标签文本，买家页面上会看到源码；Studio 侧检测到标签即透传。因此「逐行转义是安全修复」这一判断只对**纯文本**输入成立；已含标签的输入需要独立决策（白名单清洗 / 拒绝 / 透传），本阶段不改批量路径。
- **`SKU货号` 规则与 Studio 现状不兼容**：`skuSubject.id` 就是文件名，Studio 直接写进 `SKU货号`。实测把 `"1-sku-SKU-卡其 (2).png"` 喂给被吸收侧的 `validateDraft` 得到 `chinese_characters` 失败。被吸收侧自己不撞这个问题，是因为导入时 `studioSkuCodePart` 先剥中文压空格、再由 `uniqueStudioSkuCode` 做小写唯一化。阶段三若统一该列，必须一并搬这两个函数，并明确唯一性作用域——被吸收侧的 codes Map 是 per-draft 的，Studio 一次导出多套会跨套碰撞，这一层从来没被校验过。
- **轮播/包装超限两侧语义相反**：被吸收侧是 `errors` 硬失败（`valid=false` 阻止导出），Studio 侧是完全静默的 `slice(0, 10)`（实测 13 图 → 保留 10，issues 数为 0）。二者不是同一件事。本阶段各留其现状；阶段二把 Studio 侧改为发 `CAROUSEL_TRUNCATED` 警告，不改被吸收侧的硬失败。
- **`外包装图片` 6 张上限只存在于被吸收侧**：Studio 侧根本没有 packaging 概念，该列恒为 `""`。阶段三让批量路径首次写出这一列时，6 张上限与 `外包装形状`/`外包装类型` 两个枚举会第一次对批量路径生效——不只是「32 列由空转有值」。
- **`产品素材图` 取图来源两侧不同**（比派生规则更隐蔽）：被吸收侧写 `carousel[0].url`；Studio 侧写 `hero` 角色项，找不到才退回首项。实测同一套记录两条路径会把**不同的图**写进该列且无任何 issue 提示。golden-draft 等价测试是 draft→row 方向的，抓不到这个 set→draft 层的差异。
- **`draft` 模式可产出被吸收侧自己会拒绝的文件**：被吸收侧 `validateDraft` 要求每个 SKU 的价格/长/宽/高/重量必须 > 0、库存必须非负整数，缺一即 `valid=false`；Studio 的 draft 模式允许缺值放行、只记 `MISSING_REQUIRED_FIELD`。需明确工作台的 draft 模式是否也允许这些缺值落盘。
- **`square > 800` 有第四个实现点**：`sku-image-quick-edit` 在 width/height 为空时静默放行，而 `domain.js` 在同样情况下报 `unverified_dimensions`。「四处共用同一边界表」若不把「尺寸未知」这一格也纳入，四处仍会分叉。
- **行数上限首次生效**：工作台路径会首次撞上 Studio 的 `maxRows = 2000`。被吸收侧完全没有行数上限（只有请求字节限制），而它支持多商品 × 每商品多 SKU，很容易过 2000。`/api/temu/export` 需明确行数上限来源与超限返回码。
- **多值列分隔符契约不全**：被吸收侧有 5 处 `\n` 连接（carousel、packaging、packageList、packageQuantities、sourceUrls）与 2 处逗号连接（manualLanguages、sensitiveValues）；Studio 今天只有 1 处 `\n`。本设计只调和了轮播图那一处，其余 6 处（尤其两处用逗号而非换行）尚无契约或测试覆盖。
- **轮播图去重两侧不同**：Studio 做 `[...new Set(urls)].slice(0, 10)`，被吸收侧只 `filter(Boolean)` 不去重，而域内没有任何重复 URL 校验（同一 URL 放两次 `valid=true`）。实测同一草稿被吸收侧输出 2 行、Studio 输出 1 行。这是合法输入上的确定性不等，必须作为第三条换算规则写进 golden-draft 等价测试（建议保留 Studio 的去重），否则该测试从第一天就是红的。

## 迁移中会丢失的东西

- **浏览器草稿无法迁移**：被吸收侧的 `temu-local-listing:products:v1` / `:draft:v1` 存在 `http://127.0.0.1:4173` 这个 origin 上；工作台在 Studio 的 origin 下运行，读不到它们。所谓「旧键只读一次做迁移」无物可读。补偿手段是走已存在的草稿备份 JSON 导入路径；若不实现，必须在提案里明说这份丢失。
- **localStorage 配额变成共享**：与 Studio 的键无冲突（前缀不同），但被吸收侧每次保存都同时写完整工作台与一份重复的 legacy 草稿，进入同一个约 5 MB 桶，而该桶已装着 Studio 自己的活动记录与提示词模板。需要配额失败路径，或提前把草稿搬进 manifest。
- **iframe 内导航完全无策略**：桌面外壳只注册了 `setWindowOpenHandler`、`will-navigate`、`will-attach-webview`，没有 `will-frame-navigate`。`will-navigate` 只管主框架，因此 iframe 能加载，但 frame 内的链接可以把 frame 导航到任意位置。需要一个策略决定加测试，或明确接受该风险。
- **第二处外链死链未覆盖**：`openSkuImageUrl` 对任意公网图片 URL 调 `window.open(url, "_blank", …)`，同样经过外链白名单。只放行 Cloudinary 控制台并不覆盖它，「查看公网链接」在打包版里仍是静默无操作。

## 阶段划分

阶段一即达成用户诉求（一个项目、一个服务、按钮直接打开工作台），后两阶段是收敛，不是遗留：

- **阶段二**：草稿真源从浏览器 `localStorage` 搬进 manifest（`set.temuWorkbenchDraft`），并成为字段解析链上的最高优先层；Cloudinary 上传收回服务端（用有界的 `readJsonBody`，不用无字节上限的 form-data 读取）。这是评审给出的最高价值意见：`localStorage` 独占的草稿在桌面配置重置后消失、不跟随记录、导出器读不到——两套字段真源就是这么长出来的。三处静默白名单（manifest 归一化、SKU payload 归一化、浏览器侧视图归一化）必须同时改到，回环测试必须做到“改之前红、改之后绿”。
- **阶段三**：两个 plan builder 合一。按用户决定，两个入口长期共存，不退役 `setIds` 路由。

阶段一收口后删除被吸收项目的启动器与 WorkBuddy 引导，源目录其余部分暂留只读，待阶段三完成后整体删除。
