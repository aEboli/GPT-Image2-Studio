## 1. 基线与规格

- [x] 1.1 核对五个资产页、四类存储、Local/Worker 路由、API capability 与脏工作树边界，并运行相关基线测试。
- [x] 1.2 完成 proposal、`asset-record-deletion` 增量规格与 design，固定仅推广“删除当前 / 删除选中”的范围。
- [x] 1.3 增加目标解析、相邻选择、确认文案、浏览器结构与响应式布局失败测试。

## 2. 存储与 API

- [x] 2.1 增加通用删除 ID 校验和专属记录目录路径保护 helper，并覆盖边界测试。
- [x] 2.2 为 Article 与 Portrait store 增加精确 ID 批量删除及图片/JSON 目录清理。
- [x] 2.3 为 PPT store 增加 manifest deck、专属 folder-only deck 和单文件旧式记录删除。
- [x] 2.4 扩展 Gallery 批量删除，并接入 Local handler、Article/Portrait/PPT 删除路由与结构化结果。
- [x] 2.5 同步 Cloudflare 幂等或 unsupported 行为、API capability 表及 public/lib 镜像。

## 3. 资产页交互

- [x] 3.1 为 Gallery 增加当前图片状态、图片 checkbox、删除命令、缓存清理和相邻选择。
- [x] 3.2 为 Article 与 Portrait 增加独立列表 checkbox、删除命令和原位状态提交。
- [x] 3.3 为 PPT 增加独立记录 checkbox、删除命令、当前 deck 清理和相邻选择。
- [x] 3.4 增加四页共享的应用内确认对话框、焦点恢复、busy 禁用和成功/部分清理反馈。
- [x] 3.5 完成桌面、平板和移动端 checkbox、工具栏与选中态样式，并更新 README 与缓存版本。

## 4. 验证与归档

- [x] 4.1 运行纯函数、store、API、Worker 和资产页静态定向测试。
- [x] 4.2 运行完整 `npm test`、`npm run sync:public-lib -- --check` 与 `npm run build:pages`。
- [x] 4.3 运行 OpenSpec strict validation、中文 UTF-8/乱码扫描与 `git diff --check`，解决或报告全部缺口。
- [x] 4.4 启动本地服务，通过真实浏览器验证四页当前删除取消、勾选批量、相邻选择和桌面/移动端布局。
- [x] 4.5 将增量规格合并回主规格、归档变更并复验归档后的 OpenSpec 状态。
