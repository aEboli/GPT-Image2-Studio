# Windows 安装包说明

`GPT-Image2-Studio-Setup-v0.1.4.exe` 是 Windows 自解压安装包，用系统自带 `iexpress.exe` 生成。

## 本次更新

- 连接配置升级为“调用通道”，支持路由模式和直接调用模式分开保存 Base URL、API Key 与模型配置。
- 生成日志会显示更清晰的状态摘要、调用模式、比例、分辨率和中转地址，便于排查不同中转或模型的结果差异。
- 画廊、浏览器缓存和历史元数据修复流程会保留 `imageRoute`，让历史结果继续显示当时使用的调用模式。
- 普通参考图、融图分析和批量 Logo 源图上限提升到 15 张。
- 快速溶图配对预览支持按同一序号删除 A/B/C/D 整组，并加入生成中缩略状态。
- 配置抽屉、语言入口、套图记录详情和预览布局做了收敛，减少长日志和说明文案对工作区的挤占。

> 高分辨率更容易触发上游生成失败、超时或无最终图片结果。日常使用建议优先选择 1K 和 2K 分辨率，需要更大尺寸时再逐档尝试。

## 安装内容

安装器会把工作台写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装内容包括本地 Web 服务、浏览器工作台、文档、示例文件、当前 `node_modules/` 依赖和一个内置 `node.exe` 运行时。用户无需额外安装 Node.js 即可启动。

## 启动方式

安装完成后可以通过桌面或开始菜单里的 `GPT-Image2-Studio.cmd` 启动。启动脚本会自动选择可用端口，启动本地服务，并打开浏览器。

## 本地数据

API Key 和配置保存在安装目录下：

```text
%LOCALAPPDATA%\GPT-Image2-Studio\.local\config.json
```

生成图片保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

PPT 工作流生成的幻灯片图片和 `.pptx` 文件也保存到日期目录，PPT 历史清单保存到：

```text
%USERPROFILE%\Pictures\json\ppt-decks\
```

卸载时可直接删除 `%LOCALAPPDATA%\GPT-Image2-Studio`。如果也要清理生成图片，请手动删除对应日期的图片目录。

## 发布校验

发布前建议确认：

```powershell
cmd /c npm test
cmd /c npm run build:installer
```

安装包不包含 `.local/`、`.env*`、`output/`、`artifacts/`、日志文件和本地调试快照。
