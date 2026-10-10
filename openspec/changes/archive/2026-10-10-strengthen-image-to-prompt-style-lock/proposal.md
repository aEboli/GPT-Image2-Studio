## Why

普通图片反推目前要求 `visual` 保持精简，模型往往只返回“柔和补光、粉色、写实人像”这类概括词。主体、服装和构图仍然存在，但决定图像气质的媒介、审美流派、色彩关系、布料光泽、闪光方式和后期质感没有被固定下来，用户把结果再次用于生图时就容易出现明显风格漂移。

## What Changes

- 保留现有五组反推 JSON 结构，把 `visual` 明确改为以“风格锁定”开头的可复用风格锚点段。
- 要求模型在视觉字段中分别记录可见的整体审美、媒介/渲染方式、色彩与对比、光线、材质与表面、镜头与景深、后期与氛围等具体词汇。
- 要求 `avoid` 同时记录会把原图推向其他媒介、时代、光线或色彩体系的具体风格偏差。
- 更新 Prompt Agent 上传区说明，明确结果包含风格锁定词。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `image-to-prompt`: 普通反推结果必须保留可直接复用的风格锚点和风格漂移约束。

## Impact

- 反推上游请求指令和严格 JSON schema 描述：`lib/prompt-agent.mjs`。
- Prompt Agent 上传区提示：`public/index.html`。
- 反推回归测试及 `public/lib` 镜像同步检查。
- 不改变顶层五组字段、历史记录格式、模板同步或 Studio 映射接口。
