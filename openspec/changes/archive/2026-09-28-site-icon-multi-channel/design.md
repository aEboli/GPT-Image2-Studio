## Context

`public/index.html` 已使用 `/icon.png`，静态服务按 `public` 目录解析请求。桌面安装器使用 `build/desktop/icon.ico`，但该构建资源不属于网页静态目录。

## Decisions

- 将 `build/desktop/icon.ico` 复制到 `public/favicon.ico`，让标准浏览器请求直接命中真实 ICO 文件。
- 通过服务端常量别名把 `/favicon.png`、`/apple-touch-icon.png` 和 `/apple-touch-icon-precomposed.png` 映射到 `/icon.png`，不再为同一份 1.12 MB PNG 增加多个副本。
- 页面保留带版本查询参数的 PNG 地址，并额外声明 ICO、shortcut icon、Apple touch icon 和 manifest；这些入口都指向本地资源。
- manifest 只声明实际存在的 1024x1024 PNG，不伪造不存在的 192x192 或 512x512 文件。

## Failure Handling

标准入口和别名都经过现有静态文件服务；入口缺失时沿用现有 404 行为。浏览器仍可从其他 `<link>` 声明继续选择可用图标。
