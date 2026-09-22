# 贡献与维护

## 开始之前

从最新主分支创建工作分支，先检查 `git status --short`。已有未提交改动、`.local/` 私有配置和生成资产都可能属于当前用户；不要覆盖、清理或混入无关变更。

项目使用 OpenSpec 维护行为事实。`openspec/specs/` 表示当前行为，`openspec/changes/` 表示进行中的变更。会改变行为、接口、数据或架构的工作应按以下闭环推进：

1. 探索现状并编写 proposal。
2. 对齐增量 specs、design 和 tasks。
3. 先增加可复现的失败测试，再实现最小必要改动。
4. 同步实现中发现的新事实，完成测试和严格规格验证。
5. 将通过验收的变更归档，并确认增量规格已合并回主规格。

微小修复可以减少文档负担，但不能跳过与风险相称的验证。

## 共享浏览器模块

`lib/` 中由浏览器直接加载的模块必须登记在 `scripts/sync-public-lib.mjs`，并同步到 `public/lib/`：

```powershell
cmd /c npm run sync:public-lib
cmd /c npm run sync:public-lib -- --check
```

不要手工维护两份不同实现。同步后应检查差异，避免覆盖其他正在进行的修改。

## 验证要求

仓库首页 `README.md` 使用英文，`README.zh-CN.md` 保留简体中文版。更新版本事实、安装包名称、功能边界或验证结果时，两份 README 都应同步维护；发布检查会分别验证它们的当前版本行。

提交前至少运行：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run check:release
cmd /c npm run build:pages
cmd /c npx --no-install openspec validate --all --strict
git diff --check
```

涉及 Electron 或安装包时，还应运行对应桌面冒烟测试与构建。无法执行的验证必须在交付说明中明确列出。

## 发布

准备新的主应用版本时，按变更级别选择一个版本入口，并使用 `--summary` 提供本次更新摘要：

- `npm run release:major -- --summary "大版本更新"`：主版本 `+1`，次版本和更新位归零，例如 `0.6.116` -> `1.0.000`。
- `npm run release:minor -- --summary "小版本更新"`：次版本 `+1`，更新位归零，例如 `0.6.116` -> `0.7.000`。
- `npm run release:feature -- --summary "小功能更新"`：更新位 `+0.010`，例如 `0.0.100` -> `0.0.110`。
- `npm run release:patch -- --summary "普通更新"`：更新位 `+0.001`，任何普通变更都使用此入口。

版本格式固定为 `major.minor.patch`，其中 `patch` 始终是三位数字；每次只改变一个层级，上级层级变化时所有下级归零。锁文件、页面版本、当前 README、Windows 文档和新版本说明会在同一事务中同步。商品图采集扩展使用独立版本线，不随主应用自动升级。

日常分支使用 `npm run check:release` 检查 `package.json`、锁文件、两份 README、Windows 文档和当前版本发布说明。创建正式发布提交与 `v<version>` 标签后，再运行：

```powershell
cmd /c npm run check:release:strict
```

严格模式要求工作树干净且当前提交包含匹配标签。不要把 `artifacts/`、`dist/`、`test-results/`、`.local/`、真实密钥或无关工作树改动提交到发布版本。
