# GPT-Image2-Studio

[![Version](https://img.shields.io/badge/version-v0.2.158-2563eb.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases/latest) [![CI](https://github.com/aEboli/GPT-Image2-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/aEboli/GPT-Image2-Studio/actions/workflows/ci.yml) [![Windows](https://img.shields.io/badge/Windows-x64-0078d4.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases/latest)

**在自己电脑上运行的 AI 图像与视觉创作工作台。**

从图片生成与编辑，到电商套图、多语言 Listing、文章插图和 PPT，把参考素材、生成队列、失败重试与历史资产放在同一套工作流中。可以通过浏览器使用，也可以安装独立 Windows 桌面程序。

[English](./README.md) · **简体中文**

[下载](https://github.com/aEboli/GPT-Image2-Studio/releases/latest) · [快速开始](#快速开始) · [服务器部署](#linux-服务器) · [配置 API](#配置-api) · [功能](#功能) · [文档](#文档)

当前版本：`v0.2.158`

![提示词生图工作台](./docs/images/studio-prompt.jpg)

## v0.2.158 更新

- 从八类共 64 位视觉营销 Agent 中，为每套营销图片独立规划；批量生成时可填写统一设计方向。
- 检查套内重复的商品操作场景，改进功能图与商业 CG 提示词，并恢复模板方案的逐图参考分配。
- 在图片卡片查看实际使用的参考图，按输出语言识别套图记录；新建套图可选 6–20 张，参考图重构保留零张选项。
- 补充 Linux 安装、SSH 访问、systemd 常驻、HTTPS 代理和更新步骤。

升级细节与验证结果见[发行说明](./docs/releases/v0.2.158.md)。每套独立方案分别调用文字模型；已保存方案继续使用原提示词。

## 快速开始

### Windows

从[最新发行版](https://github.com/aEboli/GPT-Image2-Studio/releases/latest)选择一种方式：

- **[桌面安装包](https://github.com/aEboli/GPT-Image2-Studio/releases/latest/download/GPT-Image2-Studio-Desktop-Setup-v0.2.158-x64.exe)**：安装后，从桌面或开始菜单启动。
- **[便携 ZIP](https://github.com/aEboli/GPT-Image2-Studio/releases/latest/download/GPT-Image2-Studio-Portable-v0.2.158-x64.zip)**：完整解压后，运行 `GPT-Image2-Studio.exe`。

两种方式均自带运行时，无需另装 Node.js。便携版的解压文件需要放在一起。安装、数据位置与构建说明见 [Windows 桌面文档](./docs/windows-desktop.md)。

### Linux 服务器

服务器运行浏览器工作台，无需桌面环境。已安装 **Git 和 Node.js 22.12+** 时，在准备存放项目的父目录执行这一行，即可下载、安装全部运行依赖并启动：

```bash
git clone https://github.com/aEboli/GPT-Image2-Studio.git && cd GPT-Image2-Studio && npm ci --omit=dev && HOST=127.0.0.1 PORT=3600 NODE_ENV=production npm start
```

`--omit=dev` 跳过 Electron 和开发工具。以下安装命令用于首次部署，目标目录不能已存在；已有部署更新时见本节末尾。

<details>
<summary>新服务器：一并安装 Node.js、Git 和项目（Ubuntu / Debian）</summary>

以下以 Ubuntu 22.04 / 24.04、Debian 12 为例。使用有 `sudo` 权限的普通账号，复制整段执行。Node.js 22 通过 NodeSource 软件源安装，项目放在 `~/apps/GPT-Image2-Studio`：

```bash
bash <<'BASH'
set -euo pipefail
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
mkdir -p "$HOME/apps"
cd "$HOME/apps"
git clone https://github.com/aEboli/GPT-Image2-Studio.git
cd GPT-Image2-Studio
npm ci --omit=dev
HOST=127.0.0.1 PORT=3600 NODE_ENV=production npm start
BASH
```

</details>

启动后，服务地址是**服务器自身**的 `http://127.0.0.1:3600`。个人远程使用可在**自己电脑**上建立 SSH 隧道，把 `your-user@server-ip` 换成服务器登录信息：

```bash
ssh -N -L 127.0.0.1:13600:127.0.0.1:3600 your-user@server-ip
```

保持隧道终端打开，在自己电脑浏览器访问 **http://127.0.0.1:13600**，然后按下文配置 API。无需开放服务器的 `3600` 端口。

<details>
<summary>后台常驻与开机启动（systemd）</summary>

先按 `Ctrl+C` 结束前台试运行，再进入服务器上的项目目录（完整安装示例为 `cd ~/apps/GPT-Image2-Studio`），使用同一个普通账号执行：

```bash
bash <<'BASH'
set -euo pipefail
test -f server.mjs
studio_dir="$(pwd -P)"
studio_node="$(command -v node)"
sudo tee /etc/systemd/system/gpt-image2-studio.service >/dev/null <<EOF
[Unit]
Description=GPT-Image2-Studio
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=$studio_dir
ExecStart="$studio_node" "$studio_dir/server.mjs"
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3600
EnvironmentFile=-$studio_dir/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now gpt-image2-studio
sudo systemctl status gpt-image2-studio --no-pager
BASH
```

查看日志：`sudo journalctl -u gpt-image2-studio -f`。重启：`sudo systemctl restart gpt-image2-studio`。停止并取消开机启动：`sudo systemctl disable --now gpt-image2-studio`。

此 systemd 配置会读取项目根目录的 `.env`；直接执行 `npm start` 不会自动读取它。服务配置修改后需要重启；如果改变了 Node.js 路径或项目目录，需要同步修改服务文件并执行 `sudo systemctl daemon-reload`。

</details>

<details>
<summary>通过域名访问（Nginx HTTPS 反向代理）</summary>

前提：域名和 HTTPS 证书已配置，Nginx 与 Studio 在同一台服务器，且已用 `htpasswd` 创建 `/etc/nginx/studio.htpasswd` 登录密码文件。代理负责浏览器登录，后端使用独立的固定令牌。

用以下命令生成令牌，将结果填入项目 `.env` 的 `IMAGE_STUDIO_REQUEST_TOKEN`，执行 `chmod 600 .env` 后重启上面的 systemd 服务：

```bash
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

```dotenv
IMAGE_STUDIO_REQUEST_TOKEN=replace-with-generated-token
```

将以下 `location` 放入已经配置证书的 HTTPS `server` 块，并把 `replace-with-generated-token` 替换为同一个令牌：

```nginx
location / {
    auth_basic "GPT-Image2-Studio";
    auth_basic_user_file /etc/nginx/studio.htpasswd;
    client_max_body_size 128m;
    proxy_pass http://127.0.0.1:3600;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header Authorization "";
    proxy_set_header X-Image-Studio-Token "replace-with-generated-token";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

执行 `sudo nginx -t && sudo systemctl reload nginx` 后，通过 HTTPS 域名访问。流式进度需要关闭代理缓冲；单次上传上限可按实际素材大小调整。保留回环监听，不要把 `3600` 端口直接开放到公网。身份认证和令牌规则见[安全说明](./SECURITY.md)。

</details>

Linux 生成文件默认在运行账号的 `~/Pictures/`，私有配置在项目的 `.local/`；请一并备份。自定义路径可设置 `IMAGE_STUDIO_OUTPUT_DIR` 和 `IMAGE_STUDIO_LOCAL_DATA_DIR`，在 `.env` 中使用绝对路径。

更新已有部署时，先备份配置与生成文件，等待生成任务结束并停止服务，再在项目目录执行 `git pull --ff-only && npm ci --omit=dev`。使用上述 systemd 配置时，更新前用 `sudo systemctl stop gpt-image2-studio` 停止服务，更新成功后用 `sudo systemctl start gpt-image2-studio` 启动。

### 源码开发（Windows）

完整开发环境使用 **Node.js 22.12+**，包含 Electron 依赖；独立 Node.js 服务支持 Node.js 20+。

```powershell
git clone https://github.com/aEboli/GPT-Image2-Studio.git
cd GPT-Image2-Studio
cmd /c npm ci
cmd /c npm start
```

打开 **http://127.0.0.1:3600**。需要其他端口时，先设置 `PORT`：

```powershell
$env:PORT="3601"
cmd /c npm start
```

Windows 也可使用 `launch-studio.cmd` 启动浏览器工作台，支持 `-Port 3601`。该启动器要求 PowerShell 7.4+（`pwsh.exe`）；`npm start` 与桌面程序不要求 PowerShell 7。

## 配置 API

Studio 需要**自行提供 API 密钥和模型权限**，模型调用费用由所选服务商收取。

1. 打开右上角**配置**，通过 **CN / EN** 切换界面语言。
2. 选择通道，填写接口地址、API Key 和模型名称。
3. 测试连接；服务商支持时获取模型列表，然后**保存**。
4. 回到**提示词生图**，输入简短提示词，先用默认尺寸生成一张图。

| 通道 | 配置方式 |
| --- | --- |
| GPT · 路由模式 | 配置支持图像生成工具的 Responses 接口。 |
| GPT · 直连模式 | 分别配置生图与文字／视觉接口，可使用不同服务商。 |
| Gemini | 配置与所选 Gemini 路线兼容的生图接口。 |
| Grok | 配置 Grok 生图／编辑接口。 |

规划、分析和 Listing 使用已配置的文字／视觉接口。连接测试成功只表示模型列表接口可访问；实际生图还需验证选用的模型与格式。

各通道字段、模型映射、环境变量和常见错误见 [API 配置教程](./docs/configuration.zh-CN.md)。可用模型和支持的格式以服务商及账户权限为准。

## 功能

| 工作区 | 主要用途 |
| --- | --- |
| **图片创作** | 提示词与参考图生图、提示词增强、生成队列。 |
| **图片编辑** | 整图与局部编辑、风格迁移、参考图混合、产品结构分解。 |
| **图片转提示词** | 提取主体、构图和视觉风格，形成可复用的提示词。 |
| **电商套图** | 规划商品及 SKU 图片，生成整套素材，单独补图与修复。 |
| **Listing 草稿** | 为勾选记录生成或重新生成，审阅与复制多语言标题和商品文案。 |
| **写真** | 根据人物、服装、姿态和场景参考生成系列图片。 |
| **文章插图** | 根据文章内容规划分镜，生成风格一致的插图。 |
| **PPT** | 根据文档或主题生成幻灯片图片并导出 PPTX。 |
| **资产库** | 浏览、筛选、预览、下载，并回看生成记录。 |

GPT 提示词生图提供 PNG、JPG、WebP、GIF 和 SVG 控件，实际支持取决于所选模型。GIF／SVG 有额外限制；套图、写真、文章和 PPT 的图片槽位仍使用静态图像。详见[格式与参数参考](./docs/reference.zh-CN.md)。

### 电商工具

- **Temu 表格工作台**：维护商品和 SKU 字段，手动导入 Studio 记录，导出模板工作簿；同一面板也提供批量快捷导出。
- **商品图采集插件**：在 Chrome／Edge 中采集和审阅已支持商品页面的图片，安装方式见[插件说明](./extensions/product-image-collector/README.md)。
- **多语言标题**：存在对应译文时，展示英、德、西、法、意、波、中七语标题；其他字段沿用原有语言规则。

Listing 草稿和导出表格需要人工复核。Studio 不会自动登录店铺或发布商品。

## 界面预览

以下为界面示例，示例内容不代表模型的固定输出。展开后可查看完整宽度截图。

<details>
<summary>电商套图规划</summary>

![电商套图规划](./docs/images/creation-suite.jpg)

</details>

<details>
<summary>风格迁移与图片编辑</summary>

### 风格迁移

![风格迁移](./docs/images/style-transfer.jpg)

### 图片编辑

![图片编辑](./docs/images/image-edit.jpg)

</details>

<details>
<summary>写真、文章插图与 PPT</summary>

### 写真

![写真工作台](./docs/images/portrait-mode.jpg)

### 文章插图

![文章插图工作台](./docs/images/article-illustration.jpg)

### PPT

![PPT 工作台](./docs/images/ppt-generation.jpg)

</details>

<details>
<summary>资产画廊</summary>

![资产画廊](./docs/images/gallery.jpg)

</details>

## 数据与部署

本地输出默认位于 `%USERPROFILE%\Pictures\YYYY-MM\MM-DD\`，记录索引通常位于 `%USERPROFILE%\Pictures\json\`。可通过 `IMAGE_STUDIO_OUTPUT_DIR` 指定输出位置。桌面配置保存在 `%APPDATA%\GPT-Image2-Studio`，源码模式的服务端私有配置保存在 `.local/`。

密钥和已保存资产存放在所选运行环境中。提示词、参考图和请求会发送给你配置的 API 服务商。不要把 `.env`、`.local/`、生成资产或真实请求日志提交到仓库。

仓库提供 `vercel.json`。Vercel 运行时文件使用临时存储，需要先验证 SSE、任务时长和持久化需求；需要长期保留创作内容时，默认使用本地或桌面版本。

远程访问时，应通过完成身份认证的 TLS 反向代理连接回环服务，并显式设置 `IMAGE_STUDIO_REQUEST_TOKEN`。TLS 反向代理不能依赖后端弹出登录框；长期运行的反向代理应显式配置固定强令牌，并为后端请求携带该令牌。Basic、Bearer 和 `X-Image-Studio-Token` 的规则见[安全说明](./SECURITY.md)。

<details>
<summary>DNS 故障排查</summary>

Node 服务优先使用系统 `dns.lookup`。解析失败时，备用候选包括 `223.5.5.5`、`1.1.1.1` 和系统 DNS。设置 `IMAGE_STUDIO_DISABLE_DNS_FALLBACK=1` 可禁用；`IMAGE_STUDIO_DNS_FALLBACK_SERVERS` 支持用逗号、分号或空白分隔的自定义服务器列表。

</details>

## 开发

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run check:release
cmd /c npx --no-install openspec validate --all --strict
git diff --check
```

`npm run desktop` 用于 Electron 开发；`npm run help` 查看命令行生图参数。桌面发行还需执行 `npm run test:desktop-smoke` 和 `npm run build:desktop`。

应用行为变更遵循 [OpenSpec 与贡献流程](./CONTRIBUTING.md)。浏览器共享模块在 `lib/` 维护，通过 `npm run sync:public-lib` 同步到 `public/lib/`。

## 文档

| 文档 | 内容 |
| --- | --- |
| [API 配置](./docs/configuration.zh-CN.md) | 接口设置、服务商清单、环境变量和故障排查。 |
| [工作流与参数参考](./docs/reference.zh-CN.md) | 输出格式、分辨率、数量限制和 Temu 导出。 |
| [Windows 桌面程序](./docs/windows-desktop.md) | 安装、便携运行、数据位置和打包。 |
| [商品图采集插件](./extensions/product-image-collector/README.md) | 插件安装和支持的商品页面采集。 |
| [安全说明](./SECURITY.md) · [贡献指南](./CONTRIBUTING.md) | 信任边界、验证和发行维护。 |
| [旧版浏览器安装包](./docs/windows-installer.md) | 在本地构建兼容安装包。 |

## 发行版

当前版本说明：[v0.2.158](./docs/releases/v0.2.158.md)。下载与 SHA-256 校验值见 [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases/latest)；较早记录保留在[发行说明目录](./docs/releases/)和[历史更新记录](./docs/history.zh-CN.md)。

版本格式为 `major.minor.patch`，更新位固定三位数字。小功能更新加 `0.010`，普通更新加 `0.001`；通过 `release:major`、`release:minor`、`release:feature` 或 `release:patch` 配合 `--summary` 维护。正式发布提交和标签需在干净工作树中通过 `npm run check:release:strict`。
