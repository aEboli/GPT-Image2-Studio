## Why

当前发布工具只支持补丁位递增，版本使用不定长的第三段，无法表达大版本、小版本和小功能更新，也容易在文档和锁文件中产生格式不一致。

## What Changes

- 采用 `major.minor.patch` 版本格式，`patch` 固定三位数字。
- 增加 major、minor、feature、patch 四种发布入口；feature 的更新位增加 `10`，普通 patch 增加 `1`，上级版本变化时下级归零。
- 将现有版本升到 `0.2.020`，并同步包、锁文件、工作台、README、Windows 文档和发行说明。
- 发布就绪检查拒绝非三位 patch 的当前版本；旧的一到三位版本输入仍可被一次性升版工具读取并规范化。

## Capabilities

### Modified Capabilities

- `application-versioning`：增加版本格式、分级升级和归零规则。

## Impact

- 修改 `scripts/release-patch.mjs`、新增 `scripts/versioning.mjs`，并增加 `npm` 发布入口。
- 更新版本事实测试、版本规则测试、贡献指南和当前发行文件。
- 不改变扩展独立版本线。
