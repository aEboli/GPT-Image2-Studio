# 官方依据与调研边界

调研日期：2026-11-05，Asia/Shanghai。

## 可复核的一手资料

本机直接请求官方文档站返回 HTTP 403，Context7 检索也仍含旧模型枚举；随后通过网页检索工具成功读取官方指南和两个模型页。最终方案交叉依据官方指南、API Reference 和官方 SDK，不把缓存文档的缺项当成不支持，也不把 SDK 的宽泛枚举直接当作模型实际权限。

- [图像生成指南](https://developers.openai.com/api/docs/guides/image-generation)：GPT Image 2.6、复杂度、标注编辑、SVG、GIF 与成本章节。
- [Sunburst 模型页](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst)：用于精细构图与图像编辑。
- [Flare 模型页](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare)：用于快速迭代与交互式生成/编辑。
- [Images 生图接口参考](https://developers.openai.com/api/reference/resources/images/methods/generate)：参数类型、GIF preview 和 SVG 作者权限。

本次读取的 `main` 提交：`ea5d1606f441d80dca1e9e7f99b74581f41408f8`，提交时间 `2026-11-05T00:49:16Z`。以下为固定版本的复核入口，实施前需再检查更新。

- 模型 ID：[image_model.py](https://github.com/openai/openai-python/blob/ea5d1606f441d80dca1e9e7f99b74581f41408f8/src/openai/types/image_model.py#L15-L16)。
- 生图参数：[image_generate_params.py](https://github.com/openai/openai-python/blob/ea5d1606f441d80dca1e9e7f99b74581f41408f8/src/openai/types/image_generate_params.py#L19-L190)。
- 编辑参数：[image_edit_params.py](https://github.com/openai/openai-python/blob/ea5d1606f441d80dca1e9e7f99b74581f41408f8/src/openai/types/image_edit_params.py#L14-L188)。
- Responses 工具：[tool_param.py](https://github.com/openai/openai-python/blob/ea5d1606f441d80dca1e9e7f99b74581f41408f8/src/openai/types/responses/tool_param.py#L265-L432)。
- Images 返回类型：[images_response.py](https://github.com/openai/openai-python/blob/ea5d1606f441d80dca1e9e7f99b74581f41408f8/src/openai/types/images_response.py#L67-L108)。
- Responses 图像结果：[response_output_item.py](https://github.com/openai/openai-python/blob/ea5d1606f441d80dca1e9e7f99b74581f41408f8/src/openai/types/responses/response_output_item.py#L126-L177)。

## 已确认的接口事实

| 项目 | 源码证据 | 接入含义 |
| --- | --- | --- |
| 模型 | 两个完整 ID 均出现在 Images 与 Responses 工具类型中 | 同时接通路由 A/B；没有证据使用裸 `gpt-image-2.6` 别名 |
| 复杂度 | 生图、编辑、Responses 均定义 low/medium/high | 与 quality 分开；Responses 中显式 complexity 覆盖图像环节对外层 reasoning 的继承 |
| 2.6 质量 | 指南的 2.6 成本计算器明确列出 low/medium/high/xhigh/max，通用质量还支持 auto | 扩展质量判断补齐两个 2.6 ID，不能误降为 high |
| 输出 | 生图和 Responses 类型为 png/jpeg/webp/gif/svg；指南明确编辑不支持 GIF/SVG | SDK 编辑格式仍含 gif，存在文档冲突；默认按指南限制编辑输出 |
| GIF 参数 | 指南为 2–64 帧，接口参考与 SDK 为 2–16，默认均为 9；时长指南为 20–2000 ms，默认 200 ms、按 10 ms 舍入 | 实施前核实实际提供方边界，不能隐去冲突或把 64 宣称为已验收 |
| GIF 限制 | Images 不支持流式、中间预览、mask、自定义压缩；需要模型的 GIF preview 权限 | 前端和服务端双重验证；账户权限不能由模型名推导 |
| Responses GIF | 禁止 partial_images>0、input_image_mask、自定义压缩；允许生命周期事件流 | 不能把 Images 的无流式限制直接套到整个 Responses SSE |
| SVG | Images 要求 n=1，不支持流式、中间预览、prompt_rewriter、自定义压缩，也不支持编辑 | 单独处理这些组合，不能复用任意静态图参数 |
| SVG 作者 | 顶层 model 选择参考图模型；svg.model / svg.reasoning 控制 SVG 作者且依赖权限 | 没有作者选择权限时省略 svg 对象；不把图像复杂度冒充作者推理 |
| SVG 用量 | ImagesResponse 与 Responses image_generation_call 均有独立 svg_usage | 保存作者模型和用量，不与图像渲染用量混算 |
| markup | 官方指南明确 2.5/2.6 支持 Images 标注编辑；参数是与首图等尺寸的透明 PNG，不能与 mask 同时使用 | 现有画笔覆盖层可作为交互基础，但须新增正确的出站字段和校验 |
| 多图 | Images n 参数为 1–10，参考图通常最多 16 张 | 单结果提取器需扩展；不同业务槽位不能直接批量扇出 |
| 旧参数 | response_format 在 GPT Image 模型中明确不支持 | 2.6 官方 Images 路径省略当前硬编码的 response_format；第三方兼容行为独立处理 |

## 不能从 SDK 枚举直接推导的事项

- 两个 2.6 变体的实测速度、区域与具体账户可用性。官方模型页说明定位，但不能照搬 2.5 的性能结论或保证当前账户已开通。
- 2.6 普通图片、GIF 的最大像素、最短边/最长边、比例和输入限制。不能因为 size 是 string 就承诺现有全部大尺寸档位合法。
- GIF 帧数的指南/接口参考冲突，以及 SDK 编辑 gif 枚举与指南禁止 GIF 编辑的冲突；真实验收前不作为已支持的扩展行为。
- GIF preview 与 SVG 作者选择权限，以及中继对新增字段的实现。模型列表/连接成功不能证明这些能力可用。
- 发布的精确日期与完整模型宣传能力。本次确认的是 2026-11-05 已可读取的源码契约，不把提交时间等同于公开发布日期。

官方模型页的图像输出费率均为每百万 token 30 美元；这不是每张图片的固定价格。SVG 还需区分参考图渲染和作者模型用量。成本只能依实际 usage 与对应费率估算。

本轮未调用真实生图/编辑接口，未验证用户账户或中继支持。上述资料确认了能力契约，不能替代真实调用验收。

## 实施结果与仍未解决的外部条件

实现采用上述两个精确模型 ID。自定义尺寸只检查正整数语法，未知像素/比例边界交由提供方返回错误；没有将旧模型的范围当作 2.6 契约。GIF 帧数冲突以 UI/CLI 警示保留，17–64 仅传参路径可用，未完成真实账户验收。开发配置没有可用凭据，未发起付费请求。完整本地证据见 verification.md；SDK/指南字段支持与真实提供方开放权限仍是两个验收层级。
