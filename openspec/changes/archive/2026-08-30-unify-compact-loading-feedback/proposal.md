## Why

图片生成占位已经统一为低干扰的动态模糊背景，但工作台中实际可见的紧凑异步反馈仍混用环形 spinner、锐利扫描线、横向扫光和三点跳动。它们的节奏和材质不同，会让同一次工作流看起来像来自不同界面。

## What Changes

- 将非图片生成的可见异步反馈统一为克制的模糊光带/光晕动态，包括通用按钮内忙碌提示、套图参考识别、Prompt Agent 图片分析预览及其三条分析轨道，以及胶片条临时占位。
- 保留所有既有的文字、`aria-busy`、禁用状态、提交逻辑和结果呈现；本次不改变 API、任务调度或生成加载壳。
- 在 `prefers-reduced-motion` 下停止新增的视觉运动，同时保留可见状态色和文字反馈。

## Capabilities

### New Capabilities

- `operation-loading-feedback`: 工作台的紧凑操作忙碌反馈使用统一的低干扰模糊动态，并保持无障碍状态语义。

### Modified Capabilities

<!-- 无修改既有能力。 -->

## Impact

- 浏览器界面：`public/styles.css`。
- 回归测试：工作台布局、浏览器壳模块与相关静态视觉契约。
- 不涉及服务端接口、生成队列、持久化数据、静态连接状态、写真无运行时入口的遗留样式或 `.generation-loading-shell` 图片加载壳。
