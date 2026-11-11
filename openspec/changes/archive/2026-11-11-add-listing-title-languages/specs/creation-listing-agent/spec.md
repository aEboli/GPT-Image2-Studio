## ADDED Requirements

### Requirement: Listing 仅为标题增加西班牙语法语意大利语和波兰语

系统 SHALL 在现有 Listing 生成请求中增加 `titleTranslations` 对象，其中 `es`、`fr`、`it`、`pl` 分别为英文标题对应的自然西班牙语、法语、意大利语和波兰语译文。新增译文 SHALL 仅覆盖标题，并遵守既有标题的产品事实、数量、品牌、内部编号、尺寸规格和宣称限制。英文顶层字段、德文 `deDisplay`、简体中文 `zhDisplay`、其他 Listing 字段、目标平台、市场、调度和既有可用响应的非阻断接收方式 MUST 保持现有行为。系统 MUST NOT 为新增四种语言请求完整 Listing 或另行发起四次翻译请求。

#### Scenario: 任一既有入口生成新 Listing

- **WHEN** 用户通过任一现有 Listing 入口和现有 legacy、V1 或 V2 契约发起生成
- **THEN** 同一上游请求的提示词和结构化 schema 要求返回 `titleTranslations.es`、`titleTranslations.fr`、`titleTranslations.it`、`titleTranslations.pl` 四个标题字符串
- **AND** 新增四种语言不包含卖点、痛点、五点描述、商品描述、搜索词、关键词、尺寸重量、警告或缺失信息译文
- **AND** 原有英德中内容、平台规则及生成请求数量保持现有行为

#### Scenario: 标题译文经过清理保存和重新读取

- **WHEN** 模型返回四种新增语言的标题译文
- **THEN** 归一化、必要的旧式契约兼容、内容清理、保存和重新读取保留对应的 `titleTranslations` 值
- **AND** 西班牙语、法语、意大利语和波兰语的重音及特殊字符保持可读
- **AND** 译文不泄露源数据中的内部编号、不引入禁用品牌或无依据的新产品事实
- **AND** 非标题字段不因新增标题语言而改变

#### Scenario: 旧记录或可用响应缺少新增译文

- **WHEN** 历史草稿或可用模型响应没有 `titleTranslations` 或缺少其中某种语言
- **THEN** 系统继续保留并使用现有 Listing 内容
- **AND** 不以英文、德文或中文冒充缺失译文，不自动调用模型补译
- **AND** 缺失新增标题译文不触发额外重试或新的验收阻断
- **AND** 用户明确重新生成时请求新的标题语言契约
