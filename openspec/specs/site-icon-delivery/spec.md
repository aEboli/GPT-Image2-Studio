# site-icon-delivery Specification

## Purpose

为网页、浏览器标签页、移动端书签和可安装网页入口提供稳定、可兼容且不依赖第三方服务的多渠道站点图标。

## Requirements

### Requirement: 网页提供多渠道站点图标

网页 MUST 同时声明 ICO、PNG、Apple touch icon 和 Web App manifest 图标入口；图标入口 MUST 使用同一套产品品牌资源。

#### Scenario: 浏览器请求标准 favicon

- **WHEN** 浏览器或站点图标获取器请求 `/favicon.ico`
- **THEN** 静态服务返回有效的 `image/x-icon` 图标

#### Scenario: 浏览器使用 PNG 或 Apple touch icon 入口

- **WHEN** 客户端请求 `/icon.png`、`/favicon.png`、`/apple-touch-icon.png` 或 `/apple-touch-icon-precomposed.png`
- **THEN** 静态服务返回有效的 `image/png` 图标

#### Scenario: 客户端读取 Web App manifest

- **WHEN** 客户端请求 `/site.webmanifest`
- **THEN** 服务返回有效 JSON，并在 `icons` 中声明可访问的 PNG 图标及其 MIME 类型和尺寸

#### Scenario: 多入口保持同一品牌

- **WHEN** 客户端从任一站点图标入口加载资源
- **THEN** 返回的图标来自同一品牌源文件，且网页默认图标声明不会依赖第三方图标服务
