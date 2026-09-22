## 1. 审查与确认

- [x] 1.1 检查工作区、跟踪脚本、OpenSpec 配置和相关规范，记录迁移分类与官方依据。
- [x] 1.2 完成迁移前基线记录并归因失败。
- [x] 1.3 展示提案摘要并获得用户确认后开始实现。

## 2. 实现与行为验证

- [x] 2.1 为四个脚本声明 7.4+、Windows、严格模式和失败策略。
- [x] 2.2 迁移三个 CMD 包装器，验证参数、缺失脚本/运行时和退出码。
- [x] 2.3 保持启动器端口及健康检查契约，验证 mock 清理、进程失败和超时。
- [x] 2.4 隔离验证 Native Messaging 安装/卸载、缺失 EXE、HKCU 和无 BOM manifest。
- [x] 2.5 修复资源脚本目录、子进程和释放问题，在临时目录比较 PNG 结果。
- [x] 2.6 迁移安装包回退解压，验证 Windows 路径、错误传播与产物契约；保持停止服务 CMD。
- [x] 2.7 更新文档和 CI，扫描跟踪源码确认无 PowerShell 5 运行时调用。

## 3. 验证与交付

- [x] 3.1 使用 PS7 AST 解析全部自有脚本；执行行为测试，记录实际覆盖的 PS7 版本。
- [x] 3.2 运行 npm test、npm run sync:public-lib -- --check、npm run check:release。
- [x] 3.3 运行 npm run test:desktop-smoke、npm run build:installer、npm run build:desktop；记录失败原因及归属。
- [x] 3.4 严格校验 OpenSpec、git diff --check、中文编码与用户既有改动保留情况。
- [x] 3.5 同步并归档规范，交付文件清单、边界、保留行为、命令结果和限制。
