## 1. 基线与失败测试

- [x] 1.1 增加服务动态回环端口、实际就绪 URL 和显式关闭后进程退出的生命周期测试，并记录实现前失败结果。
- [x] 1.2 增加桌面 URL 边界、窗口最小权限、单实例、数据目录和打包白名单的契约测试，并记录实现前失败结果。
- [x] 1.3 增加兼容 IExpress 安装包只分发生产依赖的失败测试，防止 Electron 开发工具污染旧产物。

## 2. 本地服务生命周期

- [x] 2.1 更新 `server.mjs`，在端口 `0` 下报告实际监听地址，并导出服务实例、实际 URL 与幂等关闭函数。
- [x] 2.2 验证 `npm start`、固定端口和现有 API/静态资源行为保持兼容，桌面关闭不会留下独立后台服务。

## 3. Electron 桌面运行时

- [x] 3.1 新增可单元测试的桌面 URL 安全模块，严格区分本地同源导航与允许的 HTTPS 外链。
- [x] 3.2 新增 Electron 主进程，设置桌面数据目录和动态回环端口，等待服务后创建独立安全窗口，并处理启动/加载失败。
- [x] 3.3 实现单实例恢复聚焦、外链交给系统浏览器、拒绝新窗口及应用退出前关闭服务。
- [x] 3.4 增加桌面冒烟模式，实际加载首页、输出可解析就绪信息、保存截图并自动退出。

## 4. 安装包与文档

- [x] 4.1 添加 Electron 与 Electron Builder 开发依赖、桌面开发/冒烟/NSIS 构建脚本和最小文件白名单配置。
- [x] 4.2 将现有 CSS 品牌标记确定性渲染为 Windows PNG/ICO 应用资产，并接入窗口与安装包。
- [x] 4.3 更新 `README.md` 和 Windows 桌面安装文档，说明独立窗口、构建、数据目录、产物、未签名提示及旧安装包边界。
- [x] 4.4 调整 IExpress 构建，在隔离 staging 中按 lockfile 安装生产依赖，不再复制根目录完整 `node_modules`。

## 5. 验证与交付

- [x] 5.1 运行桌面定向测试、`npm run sync:public-lib -- --check`、`npm run build:pages`、`npm test` 和 `git diff --check`。
- [x] 5.2 运行未打包 Electron 冒烟，检查真实窗口截图、页面标题、非空内容、动态端口和退出后端口释放。
- [x] 5.3 构建 Windows x64 NSIS 安装包，检查 unpacked 应用和产物内容，运行打包应用冒烟并计算安装包 SHA-256。
- [x] 5.4 执行 `openspec validate add-electron-desktop-app --strict --no-interactive` 和全项目 OpenSpec 校验，复查中文编码与最终 diff，确认全部任务完成后归档变更。

验证记录：本 change 严格校验通过；全项目校验为 18 项通过、1 项失败，既有 `improve-workbench-usability-foundation` change 因没有 delta spec 失败，不属于本次变更范围。
