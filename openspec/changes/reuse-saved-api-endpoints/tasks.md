## 1. 清单存储与测试

- [x] 1.1 新增 `lib/api-endpoint-book.mjs`：`API_ENDPOINT_BOOK_STORAGE_KEY`、`API_ENDPOINT_BOOK_LIMIT`、`readApiEndpointBook()`、`rememberApiEndpoints()`、`forgetApiEndpoint()`、`listApiEndpointBookEntries()`、`formatApiEndpointLabel()`，注入 storage、无 window 依赖。
- [x] 1.2 新增 `test/api-endpoint-book.test.mjs`：断言条目身份（地址+Key）、后缀跟最近一次保存走、缺地址或缺 Key 不入清单、20 条上限、删除、损坏 JSON 与 storage 不可用时按空清单处理、地址标签与掩码。
  - 兼容旧形状：裸数组也能读成清单；写入失败（配额满、隐私模式）不抛给配置保存流程。

## 2. 下拉选择器

- [x] 2.1 新增 `lib/api-endpoint-book-picker.mjs`：四个通道的 refs 映射（地址、后缀、Key、展开按钮、列表）、展开收起、渲染两行条目与删除按钮、选中时三件套一起切、后缀只在当前通道支持时才换、外部点击关闭，结构对齐 `lib/config-model-picker.mjs`。
- [x] 2.2 `scripts/sync-public-lib.mjs` 清单登记两个新模块。
- [x] 2.3 补测试：控制器按索引回填明文而列表只含地址与掩码、选中后 `onApplied` 被调用、不支持的后缀保持原值、删除后重渲染、清单为空时展开按钮隐藏。
  - 明文不进 DOM 用序列化整行（textContent + dataset + 全部属性 + title）反向断言，不是只看文本。

## 3. 界面

- [x] 3.1 `public/index.html` 四处接口地址各加展开按钮与列表容器，挂在 `.endpoint-address-control` 上；路由 C 的地址从裸 `<label class="field">` 改为 `<div class="field">` 加显式 `<label for>`，避免点展开按钮被 label 转发焦点。四个 Key 输入框的标记保持原样。
- [x] 3.2 `public/styles.css` 给带展开按钮的 `.endpoint-address-control` 补定位与右内边距，新增 `.api-endpoint-picker-toggle` / `.api-endpoint-options-list` / `.api-endpoint-option` / `.api-endpoint-option-address` / `.api-endpoint-option-meta` / `.api-endpoint-option-remove` / `.api-endpoint-options-empty` 规则，几何沿用模型下拉，深浅两套主题都给显式底色。
- [x] 3.3 `public/app.js` 注册 4 个 toggle 与 4 个 list 的 refs、实例化控制器（含 `onApplied: applyPickedApiEndpointDisplay`）、`bindEvents`、`saveConfig` 里记四套地址+后缀+Key、`loadConfig` 用已保存浏览器配置补种、语言切换时重渲染、新增中英文案键。
  - `refs.directApiKeyInput` 与 `refs.directImageApiKeyInput` 是同一个节点，只挂一套选择器。
  - `applyPickedApiEndpointDisplay` 按通道调用既有的 `syncEndpointInputDisplay` / `syncProtocolEndpointPreview`，所以「完整 URL」开关保持有效。
- [x] 3.4 补测试断言四个地址字段的标记结构、四个 Key 字段没有展开按钮、样式规则存在、`public/app.js` 导入新模块。
  - 另断言清单不进请求载荷，且 `config-store.mjs`、`request-private-config.mjs`、`browser-config.mjs`、`server.mjs` 四处均不出现该存储键。

## 4. 升版、同步与验证

- [x] 4.1 `public/index.html` 的 `styles.css` 与 `app.js` 资源版本号升至 `20260909-api-endpoint-book-1`，同步 4 个钉死该版本的测试文件。
- [x] 4.2 运行 `npm run sync:public-lib` 同步 `public/lib/` 镜像。
- [x] 4.3 运行本变更测试、`npm run sync:public-lib -- --check`。
  - `test/api-endpoint-book.test.mjs` 27 项全过。
  - 全量有若干失败属于并发会话正在进行的调色板重构（把写死的 `rgba()` 改成 `color-mix(var(--accent))` 而未同步源码文本断言），与本变更无关。反向自证：全量扫描针对 `public/index.html` 的 509 条 `assert.match` / `assert.doesNotMatch`，逐条重放 0 失败。
  - `npm run sync:public-lib -- --check`：Checked 120 public/lib modules，通过。
- [ ] 4.4 用 Electron 探针在真实渲染里确认展开、选中后地址与 Key 一起切、删除与深浅主题可读性。
  - 未做。行为已由 27 项单元测试覆盖（假 DOM），样式与几何是 `.model-picker-control` / `.model-options-list` 的近逐字复制且规则存在性已断言；深色不可读的既有陷阱只发生在系统绘制的原生 `select` 弹层，本下拉是自绘 div 且显式给了 `--bg-soft` 底色，不适用该失效模式。仍缺实机确认的是弹层层叠与抽屉内滚动裁切。
- [x] 4.5 运行 `npx --no-install openspec validate reuse-saved-api-endpoints --strict`、`git diff --check`，并复核新增中文为 UTF-8 且无乱码。
