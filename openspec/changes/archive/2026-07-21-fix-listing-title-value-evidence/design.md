## Context

当前 `buildCreationListingSources` 只把商品字段、参考图说明和压缩后的图片身份写入 Listing source。`compactListingItem` 会主动移除长 prompt，但也没有保留逐图 `conversionIntent`。因此像折叠手拉车这类 `productDescription` 和 `sellingPoints` 为空的记录，尽管套图已经有“折叠后放入汽车后备箱，减少收纳占用”等结构化事实，Listing 模型仍把它视为没有功能结果证据。

平台 V1 prompt 还先写入“标题后只能跟客观属性”和“任何公开字段不得出现功能表达”，之后才声明标题例外。较小模型会优先遵循前面的强禁令，生成旧式属性标题。

## Goals / Non-Goals

**Goals:**

- 将已保存套图规划中的标题相关价值证据以小体积、明确语义送入 Listing 请求。
- 在有证据时强制模型写出“卖点 -> 直接解决的买家问题”关系，而不是只列轮数、颜色和变体。
- 保持非标题字段的客观属性规则和风险门禁不变。

**Non-Goals:**

- 从生成图片文字做 OCR，或把生成图片中的营销文案当成新的产品事实。
- 使用未核实的承重、材质、静音、耐磨、兼容或性能说法。
- 增加第二次模型请求、修改公开 Listing JSON 结构或自动重写历史记录。

## Decisions

### 1. 单独构建 `titleValueEvidence`

从逐图 `conversionIntent` 收集并去重 `motivationFocus`、`audienceFocus` 和 `evidenceFocus`，保留来源 role，限制条数和单项长度。`objectionFocus` 不进入标题证据，因为它常表示缺失、待核实或不应宣传的声明。

选择单独字段而不是恢复完整图片 prompt，是为了避免请求膨胀和把角色指令误当商品事实。参考图说明仍作为交叉核对证据保留。

### 2. 标题证据只影响标题

prompt 明确说明 `titleValueEvidence` 仅用于 `title` 与 `zhDisplay.title`。非标题字段继续执行旧式客观属性和功能词过滤，直接结果若在非标题字段出现功能表达仍走确定性回退。

### 3. 移除冲突而不放宽风险规则

平台 V1 的“客观属性”与“功能词”措辞改为明确排除标题字段；当 `titleValueEvidence` 非空时，纯属性标题被明确判定为不合格。高风险声明检测、禁止尺寸进入标题和单次请求行为不变。

## Risks / Trade-offs

- [规划动机与证据不完全对应] -> prompt 要求只选择能由 `evidenceFocus`、参考图说明或商品输入直接支持的候选，不使用 objection；高风险声明仍会回退。
- [请求字段膨胀] -> 候选去重、限条数和限长度，不恢复完整图片 prompt。
- [模型仍输出属性标题] -> 将纯属性标题在有证据时明确标为无效，并在真实 HTTP 路径验证；若实测仍不遵循，再增加最小结果门禁而不是先引入二次请求。
- [非标题字段变营销化] -> 保留现有 title-excluded functional gate 和固定五点测试。

## Migration Plan

1. 增加 source 与 prompt 失败测试，复现空描述/空卖点但有套图价值证据的记录。
2. 实现紧凑证据提取并消除 prompt 冲突。
3. 运行 Listing 定向测试、完整测试、Pages 构建和 OpenSpec 严格校验。
4. 重启 `3600`，对已识别的手拉车记录重新生成并确认 manifest 与页面标题。

## Open Questions

- 无。历史 Listing 不自动迁移，只在用户重新生成时更新。
