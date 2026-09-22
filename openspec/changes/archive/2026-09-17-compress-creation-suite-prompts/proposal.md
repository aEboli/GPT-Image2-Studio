## Why

套图模式每条生图提示词现在有 6000-8700 字符，由角色 brief、SHOPPER QUESTION、BUYER DECISION STRATEGY、Role intent、Role focus、场景说明、平台说明、行业模板、语言规则、参考图角色、SUBJECT CONTENT LOCK、质量线和负向清单十多个层级堆叠而成。这些层级互相重复同一件事（例如 hero 的角色意图在 brief、SHOPPER QUESTION、BUYER DECISION、Role intent 里各说一遍），并且大量篇幅是 `Do not` / `Avoid` / `never` 形式的反向提示词。过长且以否定为主的提示词会稀释真正的画面指令。

需要把套图模式的所有模板（轮播角色、SKU、信息图重构）压缩为简短的正向指令。

## What Changes

- 每个套图角色只保留一条合并后的角色指令，取代原来 brief / SHOPPER QUESTION / BUYER DECISION STRATEGY / Role intent / Role focus / 渲染约束五套并行的表。
- 提示词全面改为正向表述：原来靠 `Do not` / `Avoid` / `never` 表达的必要约束改写为对应的正向要求（例如"不要翻译产品上已印刷的文字"改为"产品与包装上已有的文字按原样原语言保留"），非必要的否定条目直接删除。
- 删除与画面无关或重复的段落：候选池策略、套图分工说明、平台合规免责、参考图 note 的重复展开、单位模式的长解释、逐条列举错误渲染形式的清单。
- 场景、平台、行业模板、视觉语言、目标语言各压缩为一到两句。
- SKU 模板与信息图重构模板按同一原则压缩。
- 共享的 SUBJECT CONTENT LOCK 与运行时补丁改为正向短句。
- 单条提示词目标长度：轮播角色与 SKU 项 800-2000 字符，信息图重构 1200 字符以内。

## Capabilities

### New Capabilities

### Modified Capabilities

- `creation-mode`: 套图轮播角色与 SKU 项的提示词组成规则。
- `creation-infographic-rebuild`: 信息图重构提示词的表述形式。

## Impact

- 提示词构建：`lib/creation-planner.mjs`、`lib/creation-generation-parameters.mjs`、`lib/creation-category-templates.mjs`、`lib/creation-platform-policies.mjs`。
- 同步产物：`public/lib` 下对应模块。
- 已保存的历史套图记录：冻结提示词不改写，仅新计划使用压缩后的提示词。
- 测试：套图规划、平台规划、分类模板、端到端回归与补图测试中针对旧提示词文案的断言。
