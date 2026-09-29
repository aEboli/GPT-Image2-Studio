## 1. Assets and routes

- [x] 1.1 将桌面 ICO 发布到 `public/favicon.ico`。
- [x] 1.2 为常见 PNG 与 Apple touch icon 请求增加同源别名。
- [x] 1.3 增加 `public/site.webmanifest` 并复用现有 PNG 品牌资源。

## 2. HTML and specification

- [x] 2.1 在主文档声明 ICO、PNG、shortcut icon、Apple touch icon 和 manifest 渠道。
- [x] 2.2 新增并归档 `site-icon-delivery` 能力规范。

## 3. Verification

- [x] 3.1 检查静态服务语法和变更差异。
- [x] 3.2 手动请求各图标入口，确认状态码、内容类型和 manifest JSON。
