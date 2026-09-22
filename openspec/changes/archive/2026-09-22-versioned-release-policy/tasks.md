## 1. 版本规则与发布工具

- [x] 1.1 增加版本解析、格式化和四种升级类型，统一三位 patch 输出。
- [x] 1.2 将原补丁发布事务扩展为 major、minor、feature、patch，并保留 `release:patch` 兼容入口。
- [x] 1.3 让 release readiness 校验当前版本格式和所有维护版本事实。

## 2. 当前版本与文档

- [x] 2.1 将当前版本更新为 `0.2.020`，同步 package、lockfile、页面、README、Windows 文档和发行说明。
- [x] 2.2 更新贡献指南和版本发布说明，明确命令和归零规则。
- [x] 2.3 合并版本规范并保留扩展独立版本线。

## 3. 验证

- [x] 3.1 增加版本格式、边界、feature/minor/major/patch 升级测试。
- [x] 3.2 运行全量测试、release readiness、公共模块同步、OpenSpec 严格校验和差异检查。
