## Why

本地工作台的首次文档仍在请求 Google Fonts，网络、DNS 或代理异常会让页面迟迟不能显示。画廊、最近输出和胶片条又把完整原图当作缩略图加载，本地磁盘上的大图仍会被重复读取和解码；Windows 浏览器启动器还在端口查找中重复调用耗时较高的系统查询。

## What Changes

- 移除工作台初始 HTML 的第三方字体请求，改用操作系统字体栈，保证首屏不依赖外网字体资源。
- 为普通画廊资产生成受尺寸上限约束的本地 WebP 缩略图；列表、最近输出和胶片条使用缩略图，而预览、灯箱与下载继续使用完整原图。
- 对历史图片使用同源按需缩略图端点回填，不在服务启动或画廊列表请求时批量重建全部历史缩略图。
- 将 Windows 浏览器启动器的端口判断改为一次本地监听端口快照，并保留 Studio HTTP 健康检查与后备端口语义。

## Capabilities

### New Capabilities

- `local-server-launch`: 定义 Windows 浏览器启动器如何快速定位可复用或可用的本地 Studio 端口。

### Modified Capabilities

- `gallery-history-browsing`: 画廊历史项目提供独立的缩略图资源，缩略图视图不再以完整原图作为默认媒体。
- `desktop-application`: 工作台初始文档不依赖第三方网络字体即可渲染。

## Impact

- Frontend: `public/index.html`、`public/styles.css`、`public/app.js`、浏览器图片缓存辅助模块。
- Local media: `lib/gallery-store.mjs`、新增缩略图处理模块、本地 `/api/gallery/thumbnail` 路由及 `package.json` 锁文件。
- Windows launcher: `launch-studio.ps1`。
- Tests: 画廊存储、静态服务、页面壳体与启动器回归测试。
