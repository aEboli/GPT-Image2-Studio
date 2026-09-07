## Why

`release:patch` 只改写每个维护文件中的一条锚定事实（`Current version:` / `当前版本：` / 两个 Windows 文件名句 / `.app-version` 元素），`check:release` 也只校验这几条。但当前版本号还出现在另外一批派生位置：

- 两份 README 的 shields.io 版本徽章
- README 正文中引用的桌面安装包与免安装 ZIP 文件名
- README「版本发布」中的当前发行说明链接
- README 与 `docs/windows-desktop.md` 中的构建产物路径
- `docs/windows-installer.md` 与 README 中「`vX` GitHub Release 不附带」一类句子

这些位置没有任何检查覆盖。升版后它们会继续指向上一个版本，而 `check:release` 依然通过，README 于是向用户推荐一个不存在的下载文件。`v0.2.10` 就是为修复这类漂移而单独发布的纯文档版本；本次 `v0.2.13` 升版同样需要人工 `git grep` 才发现 10 处残留。

## What Changes

- 新增维护中的「派生版本事实」声明表：按文件列出若干字面模板，每个模板含一个 `{version}` 占位符，且占位符后紧跟分隔符（如 `-x64.exe`、`-2563eb.svg`、`](`）。
- `check:release` 校验这些模板：某文件若出现某模板的任一版本实例，则其命名的版本必须全部等于当前版本；文件完全不含该模板时不施加约束。失败信息给出文件、行号、实际值与期望值。
- `release:patch` 在替换锚定事实之后，按同一张表把上一版本的派生事实改写为新版本，并在写入前复验没有残留旧版本实例。
- 派生事实的改写仍在既有的全量事务内完成：任一目标无法写入时，所有文件恢复原字节。
- 明确不纳入维护范围：自由散文、版本历史章节标题（`### vX`）、tag 示例（`git tag vX`、`例如 vX`）、每个版本自己的发行说明文件。模板末尾的分隔符确保 `v1.2.3` 不会匹配进 `v1.2.30`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `project-maintenance`: 「Release facts are checked consistently」要求扩展为同时维护锚定事实与派生版本事实；未纳入范围的散文、历史章节和示例仍保持逐字节不变。

## Impact

- Code: 新增 `scripts/version-facts.mjs`；`scripts/check-release-readiness.mjs` 与 `scripts/release-patch.mjs` 各接入该表。
- Existing behavior: 锚定事实的「必须唯一」语义、事务与回滚行为、扩展独立版本线、严格模式的干净工作树与标签要求均不变。
- Tests: 需覆盖派生事实的漂移检测、模板缺失时不约束、升版同时改写派生事实，以及 `v1.2.30` 前缀不被误改、tag 示例与散文保持不变。
