# GPT Image 2.6 接入验证

日期：2026-11-05，Windows / Asia/Shanghai。主应用版本：v0.2.127。

## 验证范围

本次验收的是项目中的参数、请求协议、校验、保存和界面链路。模拟上游使用固定 PNG、两帧 GIF、SVG fixtures，不验证真实模型质量或账户权限。已有未提交业务改动保留，不作为本次 2.6 新增范围；未提交 Git commit、未发布远端发行版。

## 自动化证据

| 检查 | 结果 |
| --- | --- |
| 全量回归 | 3040/3040 通过，零失败、跳过和取消；329058 ms |
| 定向回归 | 45/45 通过：image26-support、image26-server、creation-server-static、creation-generation-snapshot |
| 追加资产边界回归 | 10/10 通过，含部分保存失败、不透明/错尺寸 markup 拒绝；测试只追加断言，应用代码未再变化 |
| 共享浏览器模块 | 137 个 public/lib 模块同步与一致性检查通过 |
| 发布一致性 | check-release-readiness.mjs 通过，v0.2.127 |
| 语法 | server.mjs、public/app.js、编辑视图、CLI 的 node --check 通过 |
| 编码 | 新增/相关修改文档、中文界面与源文件均可按 UTF-8 解码；未发现 U+FFFD |
| 差异 | git diff --check 通过；Git 的 LF→CRLF 提示不属于空白错误 |
| OpenSpec | 本变更严格校验、合并与归档完成；归档后 38/38 份规范通过严格校验 |

日志均位于被 Git 忽略的 .local/image26-verification/：

- tests-release.log：最终全量回归。
- final-targeted.log：45 项定向回归。
- asset-boundaries.log：全量通过后补充的 10 项资产边界回归。
- desktop-smoke.log：独立桌面启动与原生渲染结果。

新增测试覆盖：模型与质量枚举；默认省略和独立复杂度；Responses GIF 生命周期流；已收到的实际质量/作者用量；SVG 活动内容、外部实体和外部资源拒绝；配置中的零值；格式互斥；尺寸原值保留；全部候选结果保存；GIF/SVG 原字节及正确 MIME；缩略图；标注 multipart、不透明/错尺寸标注拒绝；部分失败保留已保存结果并报告数量；16 张参考可用、17 张在出站前拒绝；写真/文章新旧记录高级选项恢复。

模型列表测试保留对两个 /models 路径和对应 Authorization 的精确断言；另行断言无关探测请求不得带 Authorization，避免本地根路径探测导致无关偶发失败。一个已有静态测试的贪婪全文件正则已限定到原目标函数体，保留其原断言语义。

## 浏览器验证

使用独立 Studio 数据目录和本机模拟上游，未接触正式账户：

- 两个 2.6 模型可选择，普通参考图上限显示 16。
- 普通生图提供五种格式；编辑仅提供 PNG/JPG/WebP。
- 质量包含 auto/xhigh/max；共享高级面板能保存复杂度和 GIF 帧数。
- SVG 实际经前端、服务端和模拟 Responses JSON 保存，预览和下载路径保留 .svg。
- GIF 实际经模拟 Responses SSE 保存，原件路径为 .gif，灯箱暂停/播放状态正确切换。
- 编辑源图 512×512，标注策略、区域说明、透明覆盖层导出和提交成功；生成后重载，模型设置和结果历史均恢复。
- 390×844 临时视口下参数控件能单列显示和滚动；检查后已撤销视口覆盖。

截图：.local/image26-verification/markup-browser.jpg。截图中的蓝色方块是协议 fixture，不是模型生成质量样例。

## CLI 验证

使用相同的隔离模拟上游实际运行 CLI：SVG 原件保存成功，Images n=3 保存三个独立 PNG。文件位于 .local/image26-verification/cli-icon.svg 与 cli-candidates*.png，未调用真实提供方。

## Electron 验证

通过临时启动脚本把 userData 与 output 指向 .local/image26-verification/electron，运行既有桌面 --desktop-smoke 路径。进程正常退出，页面标题为“IS - 提示词生图”，完成截图；Resvg 在 Electron 进程内实际将 SVG 渲染为 PNG。

截图：.local/image26-verification/electron/desktop-smoke.png。此项仅证明桌面启动和原生依赖可加载，不等于已构建、安装并验收 Windows 发行包；完整功能交互在浏览器和服务端测试中验证。

## 实际提供方仍待验收

当前开发配置没有可用 API Key，未发起真实收费请求。以下均未验收，不能从模型选项或模拟成功推导：

1. 两个模型在用户账户、区域和中继上的实际可用性、速度和效果。
2. 两个模型真实生成/编辑与 markup 的视觉效果。
3. GIF preview、SVG 作者选择权限和实际返回的 SVG 用量。
4. 模型尺寸、输入文件及输出像素的实际范围；本地只检查正整数尺寸语法。
5. GIF 17–64 帧支持；官方指南与接口参考/SDK 的最大帧数冲突尚未通过真实提供方解决。

上述限制已经写入使用说明与界面提示。遇到权限/参数拒绝时不自动换模型、格式或额外生成。获得可用凭据和明确预算后，可再进行这些外部验收；本地实施归档不代表这些条件已通过。
