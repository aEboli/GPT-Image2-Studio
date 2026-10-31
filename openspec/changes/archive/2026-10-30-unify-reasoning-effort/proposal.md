## Why

思考等级未完整映射到文本模型：Chat Completions 丢失参数，识别、Listing 和文章规划还会固定或压低等级，默认值与用户期望不一致。

## What Changes

- 全部思考等级控件支持 none、minimal、low、medium、high、xhigh、max，未指定时默认 high，保留明确保存的用户选择。
- 文本分析、规划、Listing、翻译和 Responses 生图使用所属面板的选择；Responses 使用 reasoning.effort，Chat Completions 使用 reasoning_effort。
- 命令行生图沿用同一默认值与兼容策略，通过 --reasoning-effort 或 REASONING_EFFORT 指定等级。
- 仅当上游明确拒绝思考参数或等级时，在既有重试预算内按支持列表选择最近等级；等距时优先较低等级，不支持整个参数时移除它。
- 重试展示请求等级和实际等级；权限、限流、网络、业务错误及已开始的生成不得据此重复请求。

## Scope And Authorization

用户于 2026-10-30 明确要求补齐思考等级、默认 high、自动就近适配并检查所有调用位置。本提案在该授权范围内执行，不修改历史记录、真实 API 配置或无关工作区改动。

## Verification

先复现 Chat 参数丢失、默认值错误、面板硬编码及等级拒绝；用模拟上游验证协议、就近升降级、无参数兼容、错误隔离、取消和两次 POST 上限，再运行相关及全量回归、模块同步、语法、中文编码与 OpenSpec 严格校验。
