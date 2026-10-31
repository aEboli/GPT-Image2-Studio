# 验证记录：2026-10-30

## 已验证

- 修改前新增的 5 项回归全部失败，复现默认 xhigh、Chat 转换丢参、无就近适配和无参数兼容的问题。
- 最终相关回归 419/419 通过，日志：test-results/reasoning-final-regression.log。
- 七档控件默认 high，None 不按空值丢弃；保留已保存的有效选择。五个面板的等级可独立选择。
- Responses 与原生/转换后的 Chat Completions 使用对应参数。套图、人物识别、图片转提示词、融图分析、营销和 Listing 不再强制 low/medium；文章不再静默压到 medium；PPT 及其重建沿用统一默认值。
- 支持列表决定最近档位，等距优先较低档；支持 max 到 high、none 到 minimal/low、整个参数不支持时省略参数。取消、无关参数错误、401、429、500 及已经带任务 ID 的错误不触发该兼容重放。
- 思考兼容与结构化/JSON 修复共享两次文本 POST 预算；耗尽时不发送或展示第三次尝试。实时输出保留原等级与实际等级，第二次请求使用实际 attempt=2。
- Responses 生图的普通和流式路径使用同一兼容策略，保持提示词、图像质量与尺寸。直接 Images/Grok 不添加 OpenAI 文本思考参数；原生 Gemini 图像协议保留现有请求契约，不猜测其原生思考字段。
- CLI 本地模拟上游端到端验证：未指定时 high、显式 none、max 拒绝后自动 high、最终图片落盘。未请求真实付费接口。
- 公共模块同步及 --check 通过（131 项）；22 个实现/新增测试文件通过语法与严格 UTF-8 检查；git diff --check 通过；发布一致性检查通过（v0.2.086）。
- OpenSpec 全量严格验证 69/69 通过；归档后再次严格验证。

## 全量回归边界

全量运行 2812 项，2808 通过，4 项失败，日志：test-results/reasoning-full.log。该运行过程中更新了两项仍要求 Listing medium、参考图识别 low 的旧断言，两项现已包含在最终 419 项回归中并通过。另两项不属于本次改动：

1. creation-fallback-provenance.test.mjs 的 retained-preview 用例：动态提取函数的测试夹具未提供 getImageUrl。实际标签函数与 HEAD 完全相同，本次未修改该函数或测试。
2. desktop-application.test.mjs 的首页生命周期探测：仍要求首页包含固定的旧 <title>Image Studio</title>，PAGE_OK=false。该测试和首页在本次均未修改；未扩大本任务修复范围。

贡献文档要求的 npm run build:pages 无法执行，当前 package.json 未定义该脚本。未构建或替换安装包，未重启用户正在运行的服务，未进行真实模型能力或图像质量测试。运行中进程需要重启并刷新页面才能加载新的服务端模块；已保存的有效等级保留。

## 参数来源

官方文档网页在本次环境返回 403，改为读取官方 SDK 源码：openai/openai-node 的 src/resources/shared.ts。该源码的 ReasoningEffort 类型与说明包含 none、minimal、low、medium、high、xhigh、max，并明确并非每个模型都支持全部值。因此不维护猜测的模型白名单，使用上游实际参数拒绝与支持列表完成有界协商。minimal 是低于 low 的可选极低档，不代表所有模型都支持；none 是独立的关闭推理选项。
