## Why

配置区每个通道的接口地址和 API Key 都是单值输入框，只能存一份：

```text
public/index.html   #baseUrlInput / #directBaseUrlInput / #directTextBaseUrlInput / #protocolBaseUrlInput
                    #apiKeyInput / #directApiKeyInput / #directTextApiKeyInput / #protocolApiKeyInput
public/app.js       saveConfig() 保存后把四个 Key 框清空，只留 savedKeyMask 显示掩码
lib/browser-config.mjs  saveBrowserPrivateConfig() 里 apiKey: payload.apiKey ? payload.apiKey : current.apiKey
```

后果是「换一个 API」等于「覆盖掉上一个」。在官方直连、中转站、备用额度之间来回切，每次都要手动改地址、手动改后缀、再从别处翻出完整 Key 重新粘贴——而上一个 Key 保存时就已经被覆盖，界面上只剩 `sk-a***1234` 这样的掩码，无法找回。

真正麻烦的不是「找不到某把 Key」，而是**地址和 Key 必须成对手动对齐**：填了新地址却忘了换 Key，请求会拿旧 Key 打新上游，报错信息通常只是 401 或 402，看不出是配错了对。掩码是刻意的安全设计（`runtime-configuration` 已有要求禁止公开配置回传明文 Key），不应放开；缺的是一份「本机用过哪些 API」的清单，且选中一条就整套切换。

## What Changes

- 新增 `lib/api-endpoint-book.mjs`：浏览器本地 API 清单的读写与归一化。存储键 `image-studio-api-endpoint-book-v1`，独立于 `image-studio-browser-config-v1`，形状为 `{ entries: [{ baseUrl, endpointPath, apiKey }] }`。四个通道共用同一份清单（用户常在多个通道复用同一个中转站），上限 20 条，超出丢弃最旧的。
- 一条记录的身份是「接口地址 + Key」：同一家同一把钥匙不因后缀不同占两条，后缀跟最近一次保存走；同一家的第二把钥匙是另一条 API，各自保留。缺地址或缺 Key 的组合不入清单，因为它无法整套切回来。
- 新增 `lib/api-endpoint-book-picker.mjs`：四个地址字段的下拉选择器控制器，结构与既有 `lib/config-model-picker.mjs` 对齐（同一套 `refs`/`state`/`getUiText` 注入、同一套展开收起与外部点击关闭逻辑）。
- 下拉挂在**接口地址**上，不挂在 Key 上。选中一条即把该通道的接口地址、协议后缀和配套 Key 一起填好——Key 跟着 API 走，不单独挑。模型不动，仍需点「保存」生效。
- 协议后缀只在当前通道确实提供该选项时才跟着换：路由模式存的 `responses` 不会把直连生图的 `images/generations` 顶成一个它不支持的值；模型协议通道没有后缀控件，只切地址与 Key。
- 选中后交回宿主按当前「完整 URL」开关重排地址显示，避免切换后形态与切换前不一致。
- 列表每行两行：上行接口地址（去掉协议头与末尾斜杠），下行「后缀 · Key 掩码」，同一家的两把 Key 才分得清。每行带一个删除按钮，删除立即从清单移除，不影响当前已保存的配置。
- 清单只在浏览器本地 `localStorage`：保存配置时把该次生效的四套「地址 + 后缀 + Key」记进清单，首次加载时用已保存的浏览器私有配置补种一次。`.local/config.json`、`.env` 与 `/api/config` 一个字节都不加，请求载荷与 FormData 不带该清单。
- 明文 Key 不进 DOM：列表按索引（`data-api-endpoint-index`）回填，渲染只输出地址与掩码。
- 路由 C 的地址原本裸在 `<label class="field">` 里，展开按钮进去会被 label 转发焦点，故改为 `<div class="field">` 加显式 `<label for>`；另三处地址已有 `.endpoint-address-control` 容器，只补定位与右内边距。四个 Key 输入框的标记不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `runtime-configuration`: 新增一条要求，约束浏览器本地 API 复用清单的存储位置与边界、条目身份与去重上限、下拉选中时地址/后缀/Key 的整套切换语义与后缀兼容性、逐条删除语义，以及明文 Key 不得进入 DOM、公开配置、请求载荷和服务端配置。

## Impact

- Code: 新增 `lib/api-endpoint-book.mjs`、`lib/api-endpoint-book-picker.mjs`；改动 `public/index.html`、`public/app.js`、`public/styles.css`、`scripts/sync-public-lib.mjs`（新模块必须进清单，否则浏览器 import 404），以及同步镜像 `public/lib/`。
- Existing behavior: 四个 Key 输入框的既有语义不变——留空仍表示沿用已保存 Key，保存后仍清空输入框，`savedKeyMask` 仍显示当前生效 Key 的掩码。服务端配置、环境变量、模型列表获取、连接测试、路由切换、「完整 URL」开关均不变。清单为空时展开按钮隐藏，界面与改动前一致。
- Server: 不改 `server.mjs`、`lib/config-store.mjs`、`lib/request-private-config.mjs`。清单不落服务端，桌面端与其他浏览器不共享。
- Security: 清单与浏览器私有配置同域同源、同为 `localStorage` 明文，不新增暴露面；但也不因此把明文 Key 带进公开配置、日志或请求体。
- Tests: 新增 `test/api-endpoint-book.test.mjs`（清单归一化/身份/上限/删除、地址标签与掩码、选中时三件套一起切、后缀兼容性、控制器填值、四个字段标记、样式规则、sync 清单登记）；`test/studio-preview-layout.test.mjs`、`test/creation-card-idle-ripple.test.mjs`、`test/disabled-shake.test.mjs`、`test/portrait-cosplay-assets.test.mjs` 的资源版本号断言随本次升版更新。
- Not in scope: 给清单条目起备注名、连模型一起切换、跨设备同步、服务端持久化、选中即自动保存。
