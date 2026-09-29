## Why

目标语言为英文时，套图提示词仍夹带大量中文和内部规划信息：类目模板名、四级类目路径、类目编码、`Scenario:` 场景标签、`Role focus:` 标签、重复的类目用途/细节说明；商品名、描述、卖点和参考图备注也原样保留中文。尺寸图还会照抄参考图上印的中文（如"4号""下沉"），画面出现非目标语言文字。

## What Changes

- 提示词不再输出 `Category template:`、`Ecommerce category path:`、`Product category:`（类目编码模板）、`Scenario:` 与 `Role focus:` 等内部标签；类目编码模板的角色说明只保留最具体的一段，去掉同义重复的 `Role category focus:` 段落。这些信息仍保存在规划参数中。
- 尺寸容量图只渲染列出的规格值，参考图上的其他文字不上画面。
- 生成时（非预览）若目标语言不是中文，调用已配置的文本模型一次，把提示词中的中文片段（商品名、描述、卖点、参考图备注、类目提示等）翻译为目标语言后再生成；信息图重构项与中文目标语言项不翻译。
- 未配置文本模型或翻译失败时使用原提示词继续生成，并通过 `prompt_translation_warning` 事件在界面提示。

## Capabilities

### Modified Capabilities

- `creation-mode`：套图提示词去除内部标签，并在生成时翻译为目标语言。

## Impact

- `lib/creation-planner.mjs`、新增 `lib/creation-prompt-translation.mjs`、`server.mjs`、`public/app.js`。
- `test/creation-planner.test.mjs`、新增 `test/creation-prompt-translation.test.mjs`。
- 预览中的提示词仍显示中文原文，翻译只发生在提交生成时。
