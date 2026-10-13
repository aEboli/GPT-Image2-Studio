# 更正请求 IP 的数据来源

## Why

当前“请求发起 IP”取自浏览器到 Studio 服务的入站连接。本机浏览器通过回环地址访问时，界面因此显示 `127.0.0.1`，无法说明 Studio 向图像服务发起请求时使用的公网出口。

## What Changes

- 配置摘要和新生成图片记录中的 `requestIp` 改为 Studio 服务端通过上游网络传输查询到的公网出口 IP。
- 不再使用转发请求头或浏览器连接地址作为该字段来源。
- 出口 IP 查询失败时保留空值，并按现有界面规则显示“未记录”；历史图片记录不重写。

## Capabilities

### Modified Capabilities

- `runtime-configuration`: 明确当前参数摘要 IP 是 Studio 服务端的上游出口 IP。
- `lightbox-image-viewer`: 明确新图片记录保存生成时的上游出口 IP，并保留历史值。

## Impact

- Studio 服务端会通过与上游生成请求相同的 HTTP transport 请求固定的公网 IP 反射服务。
- 若网络按目标域名应用不同代理或路由策略，反射服务观测到的出口可能与图像提供方域名不同；此时界面不承诺提供方侧的逐目标地址证明。
