# API 配置

[返回首页](../README.zh-CN.md) · [English](./configuration.md)

### 新手配置 API 教程

第一次使用请从这一节开始。Studio 不提供模型额度，也不代管密钥。它把你自己的 API 凭据保存在本机，再用这份凭据调用你选定的服务。下面是第一次跑通的最短路径。

#### 第 1 步：先准备三样东西

| 需要准备 | 说明 | 示例 |
| --- | --- | --- |
| 接口地址（Base URL） | 服务方给出的 API 根地址，通常以 `/v1` 结尾 | `https://api.openai.com/v1` |
| API Key | 在服务方控制台生成的密钥 | `sk-****` |
| 模型名 | 与该服务方命名一致的模型标识 | `gpt-6-luna`、`gpt-image-2` |

官方渠道在 OpenAI 控制台创建 Key；兼容服务或第三方中转按其自身文档获取地址和 Key。费用、限额和内容政策都以实际服务方为准。

#### 第 2 步：打开配置面板

- 源码运行：执行 `cmd /c npm start`，浏览器打开 `http://127.0.0.1:3600`。
- 桌面程序：直接启动 `GPT-Image2-Studio`，内置服务使用动态回环端口，不需要手动输入地址。
- 点右上角的**配置**按钮，或顶部导航的**配置 → 配置 API**，面板顶部即可选择配置区。
- 保存成功之前，右上角状态一直显示「配置未保存」。

#### 第 3 步：选择一个配置区

配置抽屉顶部统一为四个互斥配置区：**GPT**、**Gemini**、**Grok** 和 **配色**。选中 GPT 后，紧贴配置区下方显示「路由模式 / 直连模式」切换。只显示当前配置区的字段，未使用的连接控件和「获取模型列表」按钮保持禁用；配色区不含连接字段。

各生图路线独立保存连接配置，图片生成只使用当前生效的路线。不确定时先选 GPT 下默认的「路由模式」。

| 配置区 | 适合的服务 | 需要填写 |
| --- | --- | --- |
| GPT / 路由模式（默认） | 支持 `POST /responses` 并允许 `image_generation` 工具的服务，例如 OpenAI 官方或对齐官方协议的中转 | 接口地址、API Key、Responses 模型 |
| GPT / 直连模式 | 只提供 `images/generations` 或 `chat/completions` 的服务，或者生图与文本来自两家不同服务 | 独立的生图与文本/视觉配置 |
| Gemini | 按 OpenAI 兼容的图像生成协议调用的 Gemini 图像模型 | 基础 URL、API Key、图像模型 |
| Grok | xAI 官方或实现 Grok Imagine 图像协议的兼容服务 | 基础 URL、API Key、生图接口、图像模型 |
| 配色 | 不是调用通道，只承载界面配色 | 无需填写；重新选回服务商配置区即恢复连接字段 |

选中 **配色** 会隐藏连接字段，显示每行 4 个的 12 套配色色块。默认配色为「黑曜」；「靛蓝」继续保留，另有青花、竹影、天青、朱墙、朱漆、敦煌、松石、玫瑰、月白和流金等配色。选择会保存在浏览器本地，并同步到嵌入的 Temu 工作台。

在 **配色** 和服务商配置区之间来回切换不会改动当前生效的生图路线，右上角状态仍显示该路线。

长说明可通过鼠标悬停或键盘聚焦说明标记查看；配置表单与生成日志各自滚动，日志标题和配置区切换保持可见。

#### 第 4 步：按通道填写字段

**路由模式**，接口后缀固定为 `responses`：

```text
接口地址：https://api.openai.com/v1
API Key：sk-****
Responses 模型：gpt-6-luna
```

文本/视觉模型默认使用 `gpt-6-luna`。已有的非空模型配置会继续生效，直到你主动修改。

这里的「Responses 模型」是外层模型；生图工具模型在它下面的「生图工具模型」下拉框里选，提示词页的参数区会同步显示「工具模型 <所选模型>」。该项只能从下拉选项里选，不支持自定义填写：

| 选项 | 说明 |
| --- | --- |
| `gpt-image-2` | 默认值。 |
| `gpt-image-2.5-sunburst` | 2.5 图像工具选项，实际可用性取决于服务商。 |
| `gpt-image-2.5-flare` | 2.5 图像工具选项，实际可用性取决于服务商。 |
| `gpt-image-2.6-sunburst` / `gpt-image-2.6-flare` | 高级格式与图像选项，详见[参数参考](./reference.zh-CN.md#gpt-image-26)。 |

「发送 tools[].model」开关默认开启，路由请求会发送下拉框当前选中的白名单图像模型。旧配置缺少该字段时也默认开启；明确保存为关闭的配置继续保持关闭。关闭后请求省略 `tools[].model`，交给当前服务决定工具模型，下拉框选择与排队任务快照仍保留；局部保存配置不会重置开关。

提示词页的参数区还有「质量」下拉：`low`、`medium`、`high`（默认），以及2.5 和 2.6 模型提供的 `xhigh` 和 `max`。选中 `xhigh` / `max` 后切回 `gpt-image-2` 时，质量会收敛为 `high`。Grok 只提供 `low`、`medium`，默认 `medium`；GPT、Gemini、Grok 分别记住各自的质量选择。旧配置中的自动值会迁移为确定默认值，不再作为选项显示，也不发送给上游。提示词生图还提供可选的「透明背景」开关，仅在 GPT 的路由模式和直连生图路线显示；开启后固定输出 PNG，发送 `background=transparent`，并把选择随任务保存。Gemini 和 Grok 隐藏此开关，不发送背景参数。

**直连模式**分成两组，各自独立填写。生图组只负责图片生成和编辑，文本/视觉组负责提示词增强、参考图分析和 Listing 等模型调用，两组可以分别指向不同服务商：

```text
生图 API：https://api.openai.com/v1        后缀 images/generations   生图模型 gpt-image-2
文本/视觉 API：https://api.openai.com/v1    后缀 responses            文本/视觉模型 gpt-6-luna
```

渠道的生图模型名称不一致时，在「流式输出」下方添加「生图模型映射」，按 `请求模型 → 实际请求模型` 填写，例如 `gpt-image-2.6-sunburst → IMAGE-2.6`：左侧是请求中匹配的模型名称，右侧是实际发送给渠道的模型 ID。两端均支持手动输入或选择候选；上方「获取模型列表」会同时更新映射候选。可添加或删除多条规则，保存后会恢复，全部删除并保存即清空映射。

映射按完整模型 ID 区分大小写匹配一次，仅影响 GPT 直连的生图和编辑请求；未匹配时使用原名称。文本/视觉模型和其他通道不受影响，已知模型的能力校验仍保留，排队任务使用入队时的映射快照。

**Gemini**，生图接口后缀固定为 `images/generations`，与 GPT、Grok 的接口控件在相同位置对齐显示：

```text
基础 URL：https://api.vendor.example/v1
API Key：<服务方提供的 Key>
图像模型：gemini-3.1-flash-image-preview
```

**Grok**，使用 xAI 的图片生成与编辑 JSON 协议，连接配置独立保存：

```text
基础 URL：https://api.x.ai/v1
API Key：<xAI 或兼容服务方提供的 Key>
接口后缀：images/generations
图像模型：grok-imagine-image-2.0
```

带参考图时请求 `/images/edits`，单次最多 5 张参考图。应用把所选尺寸映射为 `1k` 或 `2k`，不支持的比例按 Grok 支持值就近匹配；质量仅发送 `low` 或 `medium`。Grok 图片请求不带 GPT 思考等级、输出格式和背景参数，也不支持本地蒙版编辑。文本/视觉规划仍使用单独配置的 GPT 通道。

如果服务方只给了一条完整地址，点接口地址右侧的**完整 URL**按钮，粘贴 `https://vendor.example/v1/responses` 这样的整条地址，Studio 会自动拆成基础地址与接口后缀。

「生成调度」卡片里的请求并发数量和任务提交间隔保持默认即可（`20` 个、`1000` 毫秒）。请求并发数量是当前会话内所有生图模式合计的全局上限；有任务在跑时这两项会暂时锁定。

#### 第 5 步：测试连接并保存

- 点**测试连接**。它会针对当前通道请求 `GET <基础地址>/v1/models`（地址未以 `/v1` 结尾时自动补上），带 `Authorization: Bearer <你的 Key>`。刚输入、还没保存的 Key 也会参与这次测试。
- 点**获取模型列表**使用同一个接口，成功后可以直接从下拉列表里选模型名，不用手打。
- 点**保存**。右上角状态变为「配置已保存」，API Key 输入框旁边显示脱敏掩码。
- API Key 留空再保存表示保留上次保存的 Key，不会把它清空。

连接测试只证明凭据和 `/models` 接口可用，不代表该通道支持生图、图片编辑、参考图或最大分辨率。部分中转不实现 `/models`，这时测试会失败但生图仍可能正常：直接手填模型名保存，用一次真实生成来验证。

#### 第 6 步：生成第一张图确认打通

关闭配置面板，回到**提示词生图**，写一句提示词，比例选 `1:1`，使用明确的默认分辨率（GPT 为 `1024x1024`，Gemini 为 `1K`，Grok 根据方图默认尺寸映射为 `1k`），点生成。进度在预览区查看；完整「生成日志」在宽屏时位于配置右侧，窄屏时位于下方。当前调用参数摘要可见时，还会显示所选生图服务的可点击 origin（`协议://域名[:端口]`），不包含接口路径或凭据。成功后图片保存在：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\prompt\
```

#### 常见问题对照

| 现象 | 常见原因 | 处理方式 |
| --- | --- | --- |
| 右上角一直显示「配置未保存」 | 没点保存，或填写的组与当前选中的通道不是同一个 | 确认选中的通道就是你填写的那一组，再点保存 |
| 测试连接返回 401 或提示密钥无效 | Key 填错、粘贴时带了空格、Key 与接口地址不属于同一服务方 | 重新粘贴 Key，确认地址与 Key 来自同一服务方 |
| 测试连接返回 404，或提示未找到可调用模型 | 该服务不提供 `/models` 列表接口 | 跳过测试，手填模型名保存，用一次真实生成验证 |
| 生成时提示模型不存在 | 模型标识与该服务方的命名不一致 | 用「获取模型列表」查看真实模型名后再填 |
| 路由模式生图失败，但文本类调用正常 | 该服务不支持 Responses 的 `image_generation` 工具 | 改用直连模式，生图组后缀选 `images/generations` |
| 提示需要令牌或远程访问认证 | 正在通过非回环地址访问本地服务 | 见下方「局域网访问与请求令牌」 |

配置保存在本机：本地 Node 服务写入 `.local/config.json`，桌面程序写入 Electron 应用数据目录，云端部署由浏览器侧保存。不要在公共设备上保留密钥。

### 在界面中配置 API

第一次使用请按[新手配置 API 教程](#新手配置-api-教程)操作。已存在的配置仍兼容 `directBaseUrl`、`directApiKey`、`directEndpointPath`、`directImageModel`、`directResponsesModel`。新填写的用途专属字段按组独立优先；API Key 留空表示保留之前保存的私有 Key，不会清除它。

常见接口后缀：`responses`、`images/generations`、`images/edits`、`chat/completions`。供应商若只给一条完整地址，点「完整 URL」按钮粘贴即可，Studio 会拆成基础地址和后缀。

#### 可复用的 API 清单

每个接口地址输入框都带一个展开按钮，列出此前保存过的 API，换一个 API 不再等于覆盖掉上一个。选中一条即把该通道的接口地址、协议后缀和配套 Key 一起填好——Key 跟着 API 走，不单独挑。模型不动，仍需点「保存」生效。

- 五个入口（GPT 路由、GPT 直连生图、GPT 直连文本/视觉、Gemini、Grok）分别维护独立清单，每份上限 20 条；在一个入口保存或删除 API，不影响其他入口。
- 一条记录的身份是「接口地址 + Key」，同一家的第二把钥匙是另一条 API。缺地址或缺 Key 的组合不入清单，因为它无法整套切回来。
- 协议后缀只在当前通道确实提供该选项时才跟着换：存下的 `responses` 不会把直连生图的 `images/generations` 顶掉。
- 列表每行上行是接口地址，下行是「后缀 · Key 掩码」；每行的删除按钮只从清单移除，不影响当前已保存的配置。
- 清单只存在浏览器本地 `localStorage`（键 `image-studio-api-endpoint-books-v2`）。旧版 v1 历史仅归入 GPT 路由，不复制到其他入口。`.local/config.json`、`.env` 与 `/api/config` 不增加历史清单，请求载荷不带该清单，桌面端与其他浏览器不共享。明文 Key 不进 DOM，列表只渲染地址与掩码。

### 使用环境变量

`.env.example` 是环境变量清单和参考模板。当前 Node.js 入口直接读取 `process.env`，不会自动加载本地 `.env` 文件；请在 PowerShell、系统环境变量或部署平台中显式注入。仓库中的示例值为：

```dotenv
OPENAI_API_KEY=<your-api-key>
OPENAI_BASE_URL=https://api.openai.com/v1
RESPONSES_MODEL=gpt-6-luna
IMAGE_TOOL_MODEL=gpt-image-2
IMAGE_QUALITY=high
DIRECT_IMAGE_BASE_URL=https://api.openai.com/v1
DIRECT_IMAGE_API_KEY=
DIRECT_IMAGE_ENDPOINT_PATH=images/generations
DIRECT_IMAGE_MODEL=gpt-image-2
DIRECT_TEXT_BASE_URL=https://api.openai.com/v1
DIRECT_TEXT_API_KEY=
DIRECT_TEXT_ENDPOINT_PATH=responses
DIRECT_TEXT_MODEL=gpt-6-luna
GROK_BASE_URL=https://api.x.ai/v1
GROK_API_KEY=
GROK_ENDPOINT_PATH=images/generations
GROK_IMAGE_MODEL=grok-imagine-image-2.0

HOST=
IMAGE_STUDIO_REQUEST_TOKEN=
IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP=0

IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0
IMAGE_STUDIO_DNS_FALLBACK_SERVERS=
```

| 变量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | 默认 API Key |
| `OPENAI_BASE_URL` | 默认 API Base URL |
| `RESPONSES_MODEL` | 默认 Responses 模型，未配置时为 `gpt-6-luna`；应以实际服务支持的模型为准 |
| `DIRECT_IMAGE_BASE_URL` / `DIRECT_IMAGE_API_KEY` / `DIRECT_IMAGE_ENDPOINT_PATH` / `DIRECT_IMAGE_MODEL` | 直连模式的生图 API 配置；分别对应地址、密钥、接口后缀和生图模型 |
| `DIRECT_TEXT_BASE_URL` / `DIRECT_TEXT_API_KEY` / `DIRECT_TEXT_ENDPOINT_PATH` / `DIRECT_TEXT_MODEL` | 直连模式的文本/视觉 API 配置；分别对应地址、密钥、接口后缀和文本/视觉模型 |
| `GROK_BASE_URL` / `GROK_API_KEY` / `GROK_ENDPOINT_PATH` / `GROK_IMAGE_MODEL` | 独立的 Grok 生图与编辑配置；分别对应地址、密钥、接口后缀和图像模型 |
| `DIRECT_BASE_URL` / `DIRECT_API_KEY` / `DIRECT_ENDPOINT_PATH` / `DIRECT_RESPONSES_MODEL` | 旧版直接调用变量，仅用于兼容回退；新配置请使用上面两组变量 |
| `PORT` | 本地服务端口，默认 `3600` |
| `HOST` | 监听地址；留空时为 `127.0.0.1` |
| `IMAGE_STUDIO_OUTPUT_DIR` | 自定义生成文件根目录 |
| `IMAGE_STUDIO_LOCAL_DATA_DIR` | 自定义本地配置和记录根目录 |
| `IMAGE_STUDIO_REQUEST_TOKEN` | 固定所有非回环请求使用的远程访问令牌 |
| `IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP` | 设为 `1` 时显式允许非回环地址直接使用未加密 HTTP；默认拒绝 |
| `IMAGE_STUDIO_DISABLE_DNS_FALLBACK` | 设为 `1` 时禁用 Node DNS fallback |
| `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` | 自定义 fallback DNS，支持逗号、分号或空白分隔 |
| `IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS` | 套图单项上游请求的最长时间，默认 `1200000`（20 分钟）；有效范围为 1 秒到 1 小时，超出会被收敛到边界 |
| `IMAGE_STUDIO_ENABLE_TEST_MOCKS` | 仅测试用途。必须与 `IMAGE_STUDIO_MOCK_IMAGE_GENERATION=1`、`IMAGE_STUDIO_OUTPUT_DIR` 和 `IMAGE_STUDIO_LOCAL_DATA_DIR` 同时设置，才会启用本地假图生成；缺一即忽略并打印告警 |

真实 `.env` 已被 `.gitignore` 排除，但仅创建该文件不会让本地服务自动读取它。云端部署请使用平台 Secret 或环境变量，不要把密钥写入仓库。

### 局域网访问与请求令牌

本地服务默认仅监听回环地址。远程访问推荐保持 `HOST` 为空，由 TLS 反向代理连接 `127.0.0.1`。该模式应在启动前显式设置固定的 `IMAGE_STUDIO_REQUEST_TOKEN`，由反向代理完成外部认证，并向每个后端请求注入同一个 `X-Image-Studio-Token` 或 Bearer 令牌。

仅在隔离且可信的网络中需要保留直接局域网 HTTP 兼容时，才显式设置：

```powershell
$env:HOST="0.0.0.0"
$env:IMAGE_STUDIO_REQUEST_TOKEN="<strong-random-token>"
$env:IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP="1"
cmd /c npm start
```

该兼容模式不会加密 HTTP Basic、Bearer、提示词或生成资产，局域网监听者可以读取这些内容。没有显式开启兼容变量时，非回环 `HOST` 会在监听前失败。

在显式开启的直接局域网 HTTP 兼容模式下，远程浏览器首次访问时会显示 HTTP Basic 登录框：用户名固定为 `studio`，密码为当前远程访问令牌。认证后，浏览器会为同源页面、静态资源、API 和输出文件复用凭据。

命令行与代理可以使用任一请求头：

```text
Authorization: Bearer <strong-random-token>
X-Image-Studio-Token: <strong-random-token>
```

所有非回环 Host 请求都必须认证，同源请求头和回环代理连接不能绕过认证。只有回环 socket 与回环 Host 同时成立时才保留免登录体验。后端会故意拒绝无令牌的“回环 socket + 非回环 Host”请求，不会为这类请求发起 Basic 登录挑战，因此 TLS 反向代理不能依赖后端弹出登录框。

如果没有设置 `IMAGE_STUDIO_REQUEST_TOKEN`，服务会在每次启动时随机生成令牌并打印到终端；反向代理必须在远程访问前同步该令牌并重新加载配置。长期运行的反向代理应显式配置固定强令牌，避免每次服务重启后代理继续发送已失效的旧值。

### Node DNS fallback

Node 服务优先使用系统默认的 `dns.lookup`。只有系统解析上游域名失败时，才会尝试备用解析器；内置候选包括 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器。

```powershell
# 禁用 fallback
$env:IMAGE_STUDIO_DISABLE_DNS_FALLBACK="1"

# 自定义备用 DNS
$env:IMAGE_STUDIO_DNS_FALLBACK_SERVERS="1.1.1.1,8.8.8.8"
```
