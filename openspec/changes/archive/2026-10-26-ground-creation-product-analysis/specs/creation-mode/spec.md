## ADDED Requirements

### Requirement: Product insights distinguish evidence from creative inference

智能识别 SHALL 在同一次视觉请求中提供商品外观锁定点、带参考来源的事实、买点、痛点、使用场景、未知项和冲突项。使用场景 SHALL 作为创意建议，MUST NOT 自动转化为参数或性能承诺。没有来源的温度、档位、续航、材质成分、认证和防护等级 MUST NOT 进入画布文案。

#### Scenario: 手套用途分析不虚构性能

- **WHEN** 主图只清晰显示卡其手套、掌心纹理和手背控制器
- **THEN** 分析保留这些外观依据，并可以提出与用途相符的冬季通勤、摄影或垂钓场景
- **AND** 不从这些场景推断防水等级、续航、温度或加热档位

#### Scenario: 辅助资料有矛盾

- **WHEN** 辅助图同时出现三档与五档说明
- **THEN** 分析把差异列为冲突并要求补充确认
- **AND** 不同时或随机把两种档位写入新图片

### Requirement: User selected product identity remains authoritative

用户明确指定的主主体 SHALL 在识别应用、预览、队列、生成和补图中保持为最高优先级外观依据。辅助参考 MAY 提供可靠文字事实，MUST NOT 改写主体颜色、结构、手指开口/翻盖、控制器位置或可售单位数量。

#### Scenario: 识别不取消手动指定主主体

- **WHEN** 用户已指定主主体，随后执行智能识别
- **THEN** 应用识别结果后仍保留同一主主体
- **AND** 后续所有普通轮播图都附带该主体参考并明确其外观优先级

### Requirement: Evidence gates apply before billable image work

多 SKU 选择图 SHALL 要求至少两个不同且有来源的可售变体；尺寸图和参数图 SHALL 要求可解析的尺寸/规格数值。缺少依据的项 SHALL 标记为跳过，MUST NOT 进入生图、自动重试、补图或专属参考上传。服务端 SHALL 根据商品资料重新校验冻结计划。

#### Scenario: 单一手套 SKU

- **WHEN** 商品只有一个卡其 SKU，包括左右一双或同一 SKU 的多个视角
- **THEN** 多 SKU 选择图被跳过
- **AND** 不产生其他颜色、款式或上游生图请求

#### Scenario: 无尺寸资料

- **WHEN** 没有可解析的尺寸数值，或只写了均码、图片角色为尺寸
- **THEN** 尺寸图和参数图都被跳过
- **AND** 其他有依据的商品图正常生成

#### Scenario: 冻结计划不能绕过拦截

- **WHEN** 提交的冻结计划删除或改写 `evidenceBlocked`，而商品仍只有单 SKU 或无尺寸
- **THEN** 服务端重新恢复对应拦截
- **AND** 生成与补图均不调用被拦截项的上游生图

### Requirement: Scene allocation follows product use and avoids repeated portraits

套图 SHALL 将不同的环境、动作、买点/痛点和镜头分配到场景项，优先使用商品环境静物、局部使用动作和手部近景。系统 MUST NOT 为所有商品固定分配人物年龄、性别或多张举着商品的正脸照。每张提示词 SHALL 聚焦分配给该图的一项任务与证据，保留统一商品身份。

#### Scenario: 手套场景各有用途

- **WHEN** 分析得到多个与商品用途相关的场景
- **THEN** 摄影操作、寒冷通勤和岸边垂钓等场景被分别分配到不同图片
- **AND** 每张都有与用途相关的动作，不能只更换背景而保持相同模特举物构图

### Requirement: Product insights survive the creation lifecycle

商品分析及来源 SHALL 贯穿识别结果、计划预览、冻结快照、队列和保存记录。旧记录缺少分析字段时 SHALL 保持可读。参考图或商品资料变化后，旧分析 MUST NOT 静默作为新计划的事实依据。

#### Scenario: 参考图变化使分析失效

- **WHEN** 用户替换商品参考图或关键商品资料
- **THEN** 之前的分析标记失效且不用于新图提示词
- **AND** 用户能重新识别生成与当前资料对应的分析
