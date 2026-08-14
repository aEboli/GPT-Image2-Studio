## Why

当前工作台界面不显示版本号，用户无法直接确认正在使用哪个构建；主应用版本虽然已经存在于 `package.json`，但更新时仍依赖人工同步多个发行事实，容易产生漂移。

## What Changes

- 在所有主应用运行方式的工作台左下角显示当前 `v<version>`，并在桌面、平板和手机安全区内保持可见且不阻挡操作。
- 将 `package.json` 保持为主应用版本的权威来源，并把页面版本纳入发行一致性检查。
- 提供统一的补丁更新命令；每次主应用更新仅将补丁位增加 `0.0.1`，同步锁文件、页面和当前发行文档。
- 本次更新将主应用从 `0.2.6` 提升到 `0.2.7`；商品图采集扩展继续使用独立版本线。

## Capabilities

### New Capabilities

- `application-versioning`: 定义主应用版本的可见位置、权威来源、补丁递增和同步校验行为。

### Modified Capabilities

- `project-maintenance`: 增加主应用补丁更新命令，并把页面与兼容安装包版本纳入现有发行一致性契约。

## Impact

- 影响 `public/index.html`、`public/styles.css`、根包版本与锁文件。
- 增加补丁版本维护脚本，并扩展现有发行一致性测试和检查。
- 同步两份 README、Windows 分发文档和当前版本发布说明。
- 不改变 API、持久化数据、生成流程或 Chrome 扩展版本。
