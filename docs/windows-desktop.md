# Windows 桌面程序说明

`GPT-Image2-Studio-Desktop-Setup-v0.2.2-x64.exe` 是使用 Electron 和 NSIS 构建的 Windows x64 桌面安装包。安装后会以独立应用窗口运行完整工作台，不需要单独安装 Node.js，也不会用浏览器标签页承载主界面。

## 与旧安装包的区别

| 产物 | 启动界面 | 运行时 | 适用场景 |
| --- | --- | --- | --- |
| `GPT-Image2-Studio-Desktop-Setup-v0.2.2-x64.exe` | 独立桌面窗口 | Electron 内置 Node.js | 推荐给日常 Windows 桌面用户 |
| `GPT-Image2-Studio-Setup-v0.2.2.exe` | 默认浏览器标签页 | 独立 `runtime\node.exe` | 保留兼容的旧启动方式 |

两种产物复用同一套工作台、API 和本地输出格式。桌面程序不会删除旧安装包或源码运行方式。

## 安装与启动

1. 运行桌面安装包。
2. 选择当前用户的安装目录。
3. 通过桌面或开始菜单中的 `GPT-Image2-Studio` 快捷方式启动。

桌面程序会在 `127.0.0.1` 的系统动态端口启动内置服务，并在服务就绪后显示工作台。重复启动只会恢复并聚焦已有窗口；关闭最后一个窗口会同时关闭本地服务，不会留下独立后台进程。

当前安装包未进行商业代码签名，Windows SmartScreen 可能显示“未知发布者”。发布者应同时提供安装包 SHA-256，用户应只使用可信发布来源的文件。

## 本地数据

Electron 会话、界面本地存储和服务端私有配置位于：

```text
%APPDATA%\GPT-Image2-Studio
```

API 配置文件位于：

```text
%APPDATA%\GPT-Image2-Studio\.local\config.json
```

生成图片、PPT、套图、写真和文章插图继续使用现有输出目录，默认保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

卸载程序默认保留 `%APPDATA%\GPT-Image2-Studio` 和用户输出，避免误删 API 配置与创作记录。如需彻底清理，可在确认备份后手动删除这些目录。旧浏览器 profile 的 `localStorage` 和旧 IExpress 安装目录中的配置不会自动迁移。

## 安全边界

- 工作台只监听 `127.0.0.1`，不向局域网开放桌面服务。
- 渲染进程不具备 Node.js 或 Electron API 权限，启用上下文隔离和 Chromium 沙箱。
- 独立窗口只允许当前本地服务同源导航，不创建任意子窗口。
- 只有项目仓库白名单内的 HTTPS 链接可交给系统浏览器，其他协议和外链会被拒绝。

## 开发启动

桌面开发和安装包构建使用 Electron `43`，要求 Node.js `22.12` 或更高版本。现有 `npm start` 本地服务仍保持 Node.js `20+` 兼容。

```powershell
cmd /c npm ci
cmd /c npm run desktop
```

`npm run desktop` 使用开发目录中的页面和服务端代码，但数据仍写入 Electron 的用户数据目录。源码浏览器模式继续使用 `npm start`。

## 构建与验证

在 Windows x64 和 Node.js `22.12+` 环境运行：

```powershell
cmd /c npm ci
node --test test/desktop-application.test.mjs
cmd /c npm run test:desktop-smoke
cmd /c npm run build:desktop
```

冒烟测试会实际创建独立窗口、加载真实首页、保存 `artifacts/desktop-smoke.png`，然后自动退出。NSIS 产物路径为：

```text
artifacts/desktop/GPT-Image2-Studio-Desktop-Setup-v0.2.2-x64.exe
```

未安装的可执行程序位于：

```text
artifacts/desktop/win-unpacked/GPT-Image2-Studio.exe
```

发布前还应运行完整项目测试、Cloudflare 构建、public/lib 同步检查、OpenSpec 严格校验，并实际启动 `win-unpacked` 程序确认窗口内容与退出清理。
