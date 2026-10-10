# 验收记录

验收日期：2026-10-06。修复范围为全项目审查确认的八项问题。

## 回归结果

- `npm test`：2468 项通过，0 失败、0 跳过。
- `node scripts/sync-public-lib.mjs --check`：122 个模块一致。
- `node scripts/check-release-readiness.mjs`：当前 v0.2.046 版本事实一致。
- `npx --no-install openspec validate --all --strict`：归档后 65 项通过。
- `git diff --check`：通过。
- 桌面、preload、服务端及前端入口语法检查通过；新增中文无替换字符。

## 场景证据

1. 四个提供方通道及旧直连字段：复用服务端密钥时拒绝地址或接口覆盖；请求自带密钥的地址切换正常。捕获的 Serverless 处理器拒绝 `/api/config` 写入，模拟上游未收到被重定向的服务端密钥。
2. PPT 补图处理器拒绝 `../../../protected` 清单 ID，返回 SSE error，隔离目录中的保护文件保持原内容。
3. 沙盒 Electron 跨进程重启且强制分配不同端口，地址、密钥及并发设置完整恢复。主进程拒绝子 frame、其他窗口及非 Studio origin 的私有配置调用。
4. 商品图采集和面板入口序列化到独立页面环境后成功执行；错误页面与版本继续被拒绝。
5. 套图、写真、文章插图及 PPT 清单并发保存和读取均保持完整 JSON；最终提交值被保留。Windows 文件占用时采用有限重试。
6. 两个存储实例并发追加十条历史后保留种子及全部十条记录；失败事务不阻塞后续追加。
7. 25 个运行中任务超出历史容量仍全部可更新；裁剪只作用于终态历史。
8. Listing 上游先发响应头再延迟正文，100 ms 请求期限按期取消读取并返回超时。

## 桌面构建与实际界面

- 使用本机 Electron 运行时执行 NSIS x64 构建成功；首次默认下载构建因 GitHub 连接超时失败，随后 `--config.electronDist=node_modules/electron/dist` 构建成功。
- 产物包含 `desktop/preload.cjs`、`desktop/config-bridge.mjs`、`lib/atomic-json-file.mjs` 和同步后的浏览器模块。
- 对真实工作台点击保存并跨端口、跨进程重启，地址、密钥、并发值恢复；对构建后的 `app.asar` 重复该验收也通过。
- 验证使用隔离用户目录、合成密钥与本地模拟上游；未调用真实付费供应商。
- 构建及截图位于忽略目录 `.local/code-review-20261006/`。

## 工程边界

`CONTRIBUTING.md` 列出的 `build:pages` 未在当前 `package.json` 中定义，无法执行；当前项目的桌面构建及其余维护检查均已完成。此次未修改版本或发布到远端。
