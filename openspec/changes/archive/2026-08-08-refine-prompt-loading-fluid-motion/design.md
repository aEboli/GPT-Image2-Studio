## 方案

### 1. 保持任务壳和位置契约

继续复用 `createPreviewLoadingShellNodes()`、`syncPreviewLoadingShellItems()` 和现有 orb 坐标计算。每个任务仍只对应一个 `.preview-loading-motion`，最多展示六个，任务 ID 变化时复用已有节点，避免轮询刷新造成动画跳帧。

### 2. 分层液体结构

在 `.preview-loading-fill-shell` 内保留 `.preview-loading-fill` 作为底部锚定的液体主体，并增加三个仅供装饰的子层：

- `preview-loading-fluid-surface`：不规则液面和高光，做低幅横向摆动。
- `preview-loading-fluid-stream`：窄条细流，从上方进入液体并以加速度落到底部。
- `preview-loading-fluid-sediment`：底部沉积/水洼，落下时横向摊平，随后以较慢速度收缩回流。

所有层都放在 `aria-hidden="true"` 的 motion 子树中，不新增可访问文本或焦点目标。使用渐变、透明度、边界形状和位移表达材质，不引入高成本模糊或混合模式。

### 3. 视觉物理参数

`getPreviewLoadingShellTheme()` 根据当前阶段和并发能量计算有界的 `gravity`、`viscosity`、`settleDuration`、`flowDuration`、`surfaceDuration` 和 `sedimentDuration`。`applyPreviewLoadingOrbState()` 将其写入 CSS 自定义属性。

- `gravity` 只影响下沉距离和撞击压缩幅度，范围保持在约 `0.9..1.2`。
- `viscosity` 只影响细流和回流时长，范围保持在约 `0.6..0.95`；生成阶段较黏，保存阶段较快收束。
- 现有 `progress` 仍由阶段计算，液体高度继续使用底部 `transform-origin`，不把视觉高度当作 API 完成百分比。

### 4. 重力方向与外环运动

取消多任务场的整场 `rotate(-360deg)`，改为极低幅的整体漂移；这样液体的“向下”始终对应屏幕方向。环线保留各自不同速度和方向的旋转，并与液体主体分离，不再把液体当作轻质环一起上下漂浮。

### 5. 可访问性和性能

保持预览壳的 `role="status"` 和动态 `aria-label`。减少动态效果媒体查询覆盖新液面、细流、沉积层及重力关键帧；静态形态仍保持底部锚定和容器裁剪。动画只使用可合成的 `transform`、`opacity`、背景色和边界形状，避免布局属性、`filter: blur` 和 `mix-blend-mode`。

## 取舍

- 不引入 Canvas、WebGL 或第三方物理引擎：加载壳尺寸小、节点多，CSS 分层足以表达所需的材质隐喻，且可保留现有无脚本布局和降级路径。
- 不改造图片拆解、融图分析和快速溶图的调用边界；它们继续复用不带液体分层的共享加载壳。本变更只给提示词生图主预览增加液体物理反馈，避免改变其他分析流程的既有视觉语义。
- 不伪造实时百分比或粒子数量；任务阶段仍是唯一状态来源，物理参数只是视觉辅助。
