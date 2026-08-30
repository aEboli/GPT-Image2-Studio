## Why

Temu 上品所需的 51 列标准 Excel，目前要靠两个各自独立的本地项目配合才能产出：`GPT-Image2-Studio` 负责生成套图与 Listing，`excel-temu-dxm`（TEMU 本地上品台，独立服务、独立端口 `4173`）负责人工补齐商品与 SKU 字段并导出工作簿。用户每次上品都要分别启动两个服务，在 TEMU 工作台里点“从 Studio 导入”跨进程回环拉取套图记录，再回到 Studio 查看结果。两个项目各自维护同一份 51 列表头、同一套公网图片校验规则和同一个导入模板文件，已经出现可证实的规则分歧。

`excel-temu-dxm` 还依赖两个无法进入本仓库的东西：`@oai/artifact-tool`（未发布到公共 npm，仅靠本机 WorkBuddy 运行时的 NTFS junction 才能解析）和 `sharp`（原生预编译依赖）。这使它既不能随 Studio 桌面安装包分发，也不能在 CI 中运行。

同时 Studio 自己已有一条 Temu 导出路径（`POST /api/creation/sets/export-temu-excel`），面向“按勾选记录批量生成”，但它没有人工逐字段编辑商品与 SKU 的能力，因此不能取代 TEMU 工作台。用户需要的是一个项目、一个服务、一个入口：在套图记录里点“导出 Temu Excel”，直接打开完整的上品工作台。

## What Changes

- 把 `excel-temu-dxm` 整体并入本仓库：其页面成为同源子文档 `public/temu/`，其纯领域逻辑落到 `lib/temu/` 并经 `scripts/sync-public-lib.mjs` 镜像到 `public/lib/temu/`，其服务端逻辑落到 `lib/temu-server/`，其 5 个接口重挂到 `/api/temu/*`。用户不再需要启动第二个服务或管理第二个端口。
- 入口沿用 `资产 → 套图记录 → 导出 Temu Excel`（`public/index.html` 的 `#creationRecordExportTemuButton`）。按钮的唯一监听、标签文案与 `disabled` 归属不变，仍由 `syncControls` 独占；改变的只是点击后的去向：全屏覆盖层打开上品工作台。
- 覆盖层顶部提供两个平级标签：「上品工作台」（默认，同源 iframe）与「批量快速导出」（点击后 `showModal()` 现有 `#creationRecordTemuExportDialog`）。用户今天依赖的预检、严格/待补全模式与批次默认值表单一次点击即达，行为零变化。
- 宿主用 `position: fixed; inset: 0` 覆盖层而非模态 dialog：TEMU 自带的图片灯箱按 `100vw/100dvh` 撑满视口，装进受 `min(1600px, 96vw)` 约束的 dialog 后全屏看图在结构上不成立，且 1366px 屏会击穿 TEMU 自己的 1360px 断点使三栏退化。
- 数据源从跨进程回环 HTTP 改为进程内 `creationSetStore.listManifests()`，删除整个传输层（`normalizeStudioBaseUrl`、`fetchStudio`、128 MiB 快照 LRU、全部 `STUDIO_*` 错误码、`IMAGE_STUDIO_URL` 环境变量）。同进程下快照缓存本就多余，渲染进程可直接读 `/output/`。
- 消除两个不可分发依赖，且不新增任何运行期或开发期依赖：
  - `@oai/artifact-tool` 删除。其 4 个被使用的 API 全部由已在依赖中的 `exceljs` 与现有 `lib/creation-temu-workbook.mjs` 覆盖；仅测试调用的 `workbook.inspect` 由 `assertGeneratedWorkbook` 加同一测试已在使用的 JSZip 断言接手。
  - `sharp` 删除。其唯一用途（读取远程图片宽高与格式）由现有 `lib/creation-temu-remote-images.mjs` 的纯 JS 解析覆盖，该模块在其余方面是严格超集。
  - `lucide` 改为构建期烘焙：从已是 devDependency 的 `lucide-static` 生成所用字形子集，配一个提供 `window.lucide.createIcons` 的极小 shim。不改任何 `<i data-lucide>` 标记，因为部分字形名是模板字符串里的动态值。
- 导出统一由 `lib/creation-temu-workbook.mjs` 这一个 `exceljs` 写入器承担，不新建第二个写入器。为此给 `buildTemuWorkbookBuffer` 增加 `includeIssueSheet` 选项：默认 `true` 使现有批量路径行为零回归；工作台路径传 `false`，输出仍是商家实际上传成功过的 2 sheet 形态（`导入模板`、`导入示例`）。
- 第一阶段即完成三处去重：51 列表头抽成 `lib/temu/template-headers.mjs` 单一声明；远程图片校验只保留 `lib/creation-temu-remote-images.mjs`；预览 URL 契约由散落 5 处收归单一导出常量。
- 修正被吸收代码中一处可证实的静默缺陷：原 `studio-bridge` 的 ID 白名单会丢弃含中文或空格的引用文件名，导致对应 SKU 预览图无声消失。放宽该模式，并用真实 manifest 的 itemId 作为回归用例。
- 桌面侧放行 Cloudinary 控制台外链。现策略只允许 `github.com`，工作台里那个 `target="_blank"` 在打包应用中是静默死链。
- 收窄 `/lib/` 静态兜底到镜像白名单。当前整个 `lib/` 树可被 `GET /lib/<name>` 读取（含 `local-server-auth.mjs` 与二进制模板）；吸收进来的服务端模块会扩大该暴露面，故在同一变更内一并收窄。

## Capabilities

### New Capabilities

- `temu-listing-workbench`: 内置的 Temu 上品工作台——同源子文档宿主与跨文档协议、`/api/temu/*` 接口契约、51 列草稿模型与人工编辑、草稿驱动的 2 sheet 导出、以及与套图记录的预选联动。

### Modified Capabilities

- `creation-mode`: `导出 Temu Excel` 入口改为打开上品工作台，现有批量导出成为同层第二标签；两条导出路径共用同一个工作簿写入器与同一份表头声明。
- `local-server-security`: 新增 `/api/temu/*` 的认证与 CSRF 边界（非 GET 必须位于 `/api/` 前缀下才会被 CSRF 检查覆盖）、`/temu/` 静态挂载边界，并把 `/lib/` 读取收窄到镜像白名单、修正未捕获的 `decodeURIComponent` 使畸形转义返回 400 而非 500。
- `desktop-application`: 工作台在桌面外壳中经同源 iframe 承载（`window.open` 被无条件拒绝、`<webview>` 被拦、整页跳转会丢失渲染进程状态）；外链白名单增加 Cloudinary 控制台设置页。
- `project-maintenance`: 被吸收的测试须为 `test/` 下扁平 `*.test.mjs` 且零引导可跑（`scripts.test` 被逐字断言、CI 无 WorkBuddy 运行时）；新增“全仓不得出现 `@oai/artifact-tool` 与 `sharp` 导入”的守卫。

## Impact

- 页面与宿主：`public/index.html`（覆盖层与双标签标记）、`public/styles.css`、`public/app.js`（构造 launcher 并注入）、新增 `lib/temu-workbench-launcher.mjs`。
- 子文档：新增 `public/temu/{index.html,styles.css,app.js}`，仅改动资源与接口字面量、模块说明符、预览 URL 前缀判断，并新增浅色调色板与两条跨文档消息处理。
- 共享领域逻辑：新增 `lib/temu/`（`domain`、`product-workbench`、`studio-import`、`image-upload`、`sku-image-quick-edit`、`template-headers`、`lucide-shim`、`lucide-icon-nodes`），经 `scripts/sync-public-lib.mjs` 镜像。
- 服务端：新增 `lib/temu-server/`（`routes`、`studio-set-adapter`、`draft-plan`、`public-image-verifier`）；`server.mjs` 增加 `/api/temu/*` 分派与 `GET /temu/` 静态分支、收窄 `/lib/` 兜底、补 `.ico`；`lib/api-contract.mjs` 登记新路由。
- 工作簿：`lib/creation-temu-workbook.mjs` 增加 `includeIssueSheet` 与 `maxOutputBytes` 选项并补多行单元格换行对齐；`lib/creation-temu-export.mjs` 改为从单一表头声明再导出。
- 桌面与打包：`desktop/url-policy.mjs` 放行 Cloudinary 控制台。打包白名单零改动——`build.files` 已含 `lib/**/*` 与 `public/**/*`，安装器 `includePaths` 已含 `lib` 与 `public`。
- 构建脚本：新增 `scripts/build-temu-lucide-icons.mjs`（产物字节可复现）。
- 测试：移植 5 套纯领域测试；新增路由、适配器、草稿计划、子文档外壳、图标漂移、入口接线与契约守卫测试；`test/creation-temu-frontend.test.mjs` 四处断言改指 `openExportDialog()`，另新增一条覆盖注入 `openWorkbench` 后的新分支。
- 依赖：运行期与开发期均零新增，无原生预编译依赖。
