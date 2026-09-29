## Why

网页当前只声明 `/icon.png`，而浏览器标签页、移动端书签或项目图标获取器常常只请求 `/favicon.ico`。桌面打包目录中的 ICO 不会自动成为网页静态资源，导致不同客户端看到默认占位图。

## What Changes

- 将桌面品牌 ICO 发布为网页根路径 `/favicon.ico`。
- 保留 `/icon.png`，并为常见的 `/favicon.png`、Apple touch icon 路径提供同源入口。
- 在页面声明 ICO、PNG、Apple touch icon 和 Web App manifest 多个图标渠道。
- 增加 `site.webmanifest`，让支持可安装网页的客户端发现 PNG 图标。

## Affected Specifications

- `site-icon-delivery`

## Impact

- `public/index.html`：增加多渠道 `<link>` 声明。
- `public/favicon.ico`：发布桌面品牌 ICO 的网页副本。
- `public/site.webmanifest`：声明产品入口和 PNG 图标。
- `server.mjs`：将常见 PNG 图标路径映射到现有 `/icon.png`，避免复制 1.12 MB PNG。
