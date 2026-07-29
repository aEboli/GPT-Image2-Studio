## Why

当前未提交更新已经通过现有自动化检查，但代码审查确认本地服务鉴权、筛选删除、Listing 尺寸事实、SKU 颜色与类目推断、Prompt 模板兼容和发布门禁存在可复现的语义缺口。这些缺口会造成未授权访问、误删隐藏记录、生成或展示错误商品事实，以及维护检查误报，因此需要在保留现有最新实现的基础上集中修复并补齐回归证据。

## What Changes

- 在任何本地免认证快捷路径之前严格验证请求 `Host`，阻止 DNS Rebinding 和畸形 authority 绕过；远程明文 HTTP 绑定改为显式不安全兼容选项，默认引导通过 TLS 反向代理访问，并让本地运维者能够取得当前随机令牌。
- 将 Article、Portrait 和 PPT 的“删除选中”目标限制为当前完整筛选集合，保留筛选外记录及其选择状态。
- 按标签关联的尺寸子句提取产品和包装证据，校验完整尺寸元组、长度单位体系和 500 字符上限，并修复历史共用尾部单位的尺寸回填。
- 收紧 SKU 颜色 token 的语言与边界识别，按目标语言逐色本地化多色标签；四级类目自动匹配要求可靠父级语义，宽泛商品名后缀回落通用类目。
- 仅对符合旧版结构的 Prompt Agent JSON 提取历史 `prompt`，保留无关用户 JSON；详情视图恢复规格要求的 warnings 与 missing information。
- 发布检查解析明确的当前版本位置而不是搜索任意字符串，并清除会阻断差异检查的空白错误。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `local-server-security`: 明确可信回环 Host、DNS Rebinding 防护和远程 TLS/明文兼容边界。
- `asset-record-time-filtering`: 明确删除选中只作用于当前完整筛选集合。
- `creation-listing-agent`: 收紧尺寸证据、完整元组、长度单位、字段长度、历史回填和详情显示要求。
- `creation-mode`: 收紧颜色 token、目标语言和自动四级类目匹配要求。
- `image-to-prompt`: 明确旧版自动模板的结构识别边界，保留无关用户 JSON。
- `project-maintenance`: 要求发布门禁验证明确的当前版本事实。

## Impact

- 安全与运行时：`server.mjs`、`lib/local-server-auth.mjs`、`.env.example`、`README.md`、`SECURITY.md`。
- 记录操作与前端：`lib/asset-record-delete-controller.mjs`、`public/app.js` 及公共镜像。
- Creation 与 Listing：尺寸、SKU 颜色、类目模板、Planner、Listing 详情模块及对应测试。
- 维护：发布检查脚本、OpenSpec 工件和项目维护测试。
- **BREAKING**：显式绑定非回环地址的明文 HTTP 远程访问需要显式开启不安全兼容选项；默认远程部署应使用 TLS 反向代理。
