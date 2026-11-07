# gpt-image-26-support Specification

## Purpose
TBD - created by archiving change add-gpt-image-26-support. Update Purpose after archive.
## Requirements
### Requirement: 模型能力按实际请求上下文校验

系统 SHALL 识别 gpt-image-2.6-sunburst 与 gpt-image-2.6-flare，并按模型、上游端点、生成或编辑操作、输出格式和已知权限校验参数。GPT 提示词生图的 GIF/SVG 格式兼容性 SHALL 仅提示，仍按用户选择发送并由接口判断，MUST NOT 仅因模型名称不在本地格式能力枚举中阻止请求。未验证能力 MUST NOT 被宣称为已确认支持，MUST NOT 因静默替换模型或输出格式报告成功。

#### Scenario: 用户选择新模型
- **WHEN** 用户在有效的路由 A 或 B 选择两个 2.6 模型之一
- **THEN** 请求在该协议规定的图像模型位置使用准确 ID
- **AND** 既有文本模型、其他提供方和明确保存的旧配置保持各自语义

#### Scenario: 提交不兼容组合
- **WHEN** 用户提交编辑、蒙版或参数组合不允许的请求
- **THEN** 系统在上游调用前返回可理解的原因
- **AND** 不自动改格式、改模型或额外发起生图 POST

#### Scenario: 格式能力未确认仍正常发送
- **WHEN** GPT 提示词生图请求 GIF/SVG 而本地未确认该模型的格式能力
- **THEN** 系统只提示并保留实际出站格式
- **AND** 以实际接口响应和文件字节判断任务结果

### Requirement: 图像复杂度与渲染质量及作者推理独立

系统 SHALL 将图像复杂度序列化为 `complexity`，允许 low、medium、high 或省略，并 SHALL 与图像 quality、外层文本 reasoning 及 SVG 作者 reasoning 分开保存和展示。未设置的复杂度 SHALL 保留上游的默认或继承规则。

#### Scenario: 显式选择图像复杂度
- **WHEN** 用户选择 high 图像复杂度和 medium 渲染质量
- **THEN** 有效图像请求携带 complexity=high 和 quality=medium
- **AND** 不改写外层文本模型的 reasoning 设置

#### Scenario: 沿用上游默认复杂度
- **WHEN** 用户没有设置图像复杂度
- **THEN** 请求省略 complexity
- **AND** 不根据文本默认 high 伪造一个显式图像复杂度

### Requirement: 输出资产从请求到历史完整交付

系统 SHALL 对所选模型支持的 PNG、JPEG、WebP、GIF 和 SVG 实现正确格式往返、实际字节验证、MIME、保存、预览、下载与历史扫描，并 SHALL 保留原始格式。不能将不支持的新格式归一化为 PNG 后报告原格式成功。

#### Scenario: 保存并重新打开新格式
- **WHEN** 上游返回有效的 WebP、GIF 或 SVG 并完成保存
- **THEN** 下载的原件、扩展名和 MIME 与实际格式一致
- **AND** 重启后历史仍可找到和预览该资产

#### Scenario: 上游返回伪装图片
- **WHEN** 响应扩展名或 output_format 与无效字节内容不一致
- **THEN** 系统报告格式验证失败
- **AND** 不把该响应登记为正常完成资产

### Requirement: GIF 遵守端点及权限约束

系统 SHALL 提供 GIF 的 frame_count、frame_duration_ms、播放预览与原件下载，具体模型尺寸与 preview 权限 SHALL 交由提供方实际校验，不以本地参数构造成功代替权限验收。Images GIF SHALL 不请求流式、中间预览、mask 或自定义压缩；Responses GIF SHALL 不请求中间预览、input_image_mask 或自定义压缩，但 MAY 保留任务生命周期事件流。遵循官方指南，编辑入口 SHALL 不提供 GIF 输出；指南与接口参考的帧数差异 SHALL 在 UI/CLI 和验收记录中明确披露，17–64 帧 SHALL 标为待提供方验证，不能静默丢帧。

#### Scenario: Responses 生成动画
- **WHEN** 用户在有权限的 Responses 路径提交合法 GIF 任务
- **THEN** 系统可以流式报告任务状态而不请求中间图片
- **AND** 最终保存和下载的 GIF 保留动画

#### Scenario: 动画权限不可用
- **WHEN** 提供方明确拒绝所选模型的 GIF preview 权限
- **THEN** 系统显示能力或权限不可用
- **AND** 不以静态 PNG 结果代替用户请求的动画

### Requirement: SVG 保留矢量资产与独立作者信息

系统 SHALL 只在支持的生成操作提供 SVG，不提供 SVG 编辑。Images SVG SHALL 使用 n=1，且不带流式、中间预览、prompt_rewriter 或自定义压缩。作者模型和推理配置 SHALL 遵守其权限和对应协议的默认规则，并保存独立 svg_usage。预览 SHALL 不执行 SVG 中的活动内容。

#### Scenario: 用户下载矢量原件
- **WHEN** 合法 SVG 生成完成
- **THEN** 用户获得原始 SVG 文件及有效预览
- **AND** 元数据区分图像模型与返回的 SVG 作者模型和用量

#### Scenario: 编辑入口请求 SVG
- **WHEN** 编辑请求的输出格式是 SVG
- **THEN** 系统在上游调用前拒绝该组合
- **AND** 不将请求静默修改为 PNG

### Requirement: 多结果与参考图不被静默丢弃

普通 Images 生图 SHALL 支持接口允许的原生结果数量并完整校验和保存每项结果。支持多参考图的入口 SHALL 按模型能力处理输入数量，不得静默截断合法输入。现有业务单槽位和单源图编辑 SHALL 保持其数量约束。

#### Scenario: 普通生图返回多个结果
- **WHEN** 用户提交合法 n 且上游返回多个 data 项
- **THEN** 每项结果都有独立资产和同一任务下的稳定序号
- **AND** 任何保存失败均明确反馈而不是丢掉第一项之外的结果

#### Scenario: 参考图超出上限
- **WHEN** 输入数量超出当前模型与入口允许的数量
- **THEN** 提交前显示准确上限
- **AND** 系统不静默截断后继续生成

### Requirement: 2.6 输出能力在生图页可发现并即时联动

系统 SHALL 在选择支持的 2.6 模型后即时刷新输出格式和参数入口，不要求保存或重载后才显示。提示词页 SHALL 在开始生成前显示静态/GIF/SVG 格式选择，GIF 帧参数与共享配置双向一致，切换格式 SHALL 不破坏历史任务快照。

#### Scenario: 切换模型后选择动画
- **WHEN** 用户从旧模型切换到 2.6
- **THEN** GIF/SVG 选项和生图页入口立即可用
- **AND** 选择 GIF 后可以直接填写帧数与时长并提交该格式

#### Scenario: 不兼容的动画或矢量输入
- **WHEN** GIF/SVG 与参考图、多候选、透明背景或路由 A 未发送工具模型同时出现
- **THEN** 界面说明原因并在提交新任务前拒绝，不静默丢弃输入或改变格式

### Requirement: SVG 预览优先使用矢量原件并明确下载类型

系统 SHALL 在原件可用时为 SVG 的画廊、胶片条和详情使用原始 SVG URL，不因已有位图缩略缓存而降级。预览 SHALL 使用 img 而不是内联活动 SVG，保留既有服务端校验和延迟加载。下载入口 SHALL 明示 SVG 原件并返回原始文件。

#### Scenario: 重开带位图缩略缓存的 SVG
- **WHEN** 记录包含 SVG 原件和 WebP/PNG 缩略图
- **THEN** 浏览器预览优先使用 SVG 原件
- **AND** 画廊标注矢量类型，下载按钮标明 SVG 原件

