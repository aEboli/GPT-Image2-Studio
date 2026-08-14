## Context

Prompt Kit 已经是挂在 `body` 末尾的非模态固定浮层，但当前运行时把 `#previewCanvas` 的水平中线写入 CSS 变量，面板再从该点向右展开。这能避开参数列，却产生了过大的空隙。提示词模式的自定义提示则由按钮 `::after` 绘制；其祖先包含 `overflow: hidden/auto` 和 `backdrop-filter` 形成的裁剪及层叠上下文，即使继续提高局部 `z-index` 也不能可靠越过这些边界。

## Goals / Non-Goals

**Goals:**

- desktop 与 narrow-desktop 中，模板面板紧贴参数面板右边缘并保留工作台列间距。
- 模板面板保持在可视视口内，且现有模板操作和受限布局回退不变。
- `data-tooltip` 提示由一个不受应用层叠上下文和祖先裁剪影响的共享浮层显示。
- 鼠标悬浮与键盘焦点使用同一提示，位置经过视口碰撞约束。

**Non-Goals:**

- 不重新设计 Prompt Kit 列表、表单、宽度或视觉主题。
- 不增加拖动、位置持久化、遮罩或新的模板快捷键。
- 不改变模板内容、存储格式、生成状态或 API。

## Decisions

### 以设置面板右边界作为桌面锚点

运行时读取 `.settings-panel` 的 `getBoundingClientRect().right`，发布 `--prompt-template-settings-edge`。面板左边缘使用该边界加现有 `--studio-grid-gap`，最大宽度继续由锚点到视口右侧的空间约束。ResizeObserver 同时观察设置面板，打开面板前也立即同步一次。

替代方案是直接使用工作台第二列的 CSS 起点。应用外层和工作台存在可变边距，运行时已具备几何同步流程，直接测量设置面板能避免复制外层偏移计算，也准确对应用户要求的“紧贴参数区”。

### 用一个 manual popover 承载应用级提示

在 `body` 末尾增加 `popover="manual"` 的提示节点。事件委托监听应用内全部带 `data-tooltip` 的控件，在 `pointerover` 或 `focusin` 时读取文案并调用 `showPopover()`，在离开、失焦、滚动或布局变化时隐藏。显示后根据触发控件和提示尺寸采用上方优先、空间不足时下方的固定定位，并将水平坐标限制在可视视口安全边距内。

读取提示文案后，在中文句号 `。` 和中文分号 `；` 后插入换行，并由 `white-space: pre-line` 呈现。只在标点后仍有内容时插入换行，避免末尾标点产生额外空白行；文本继续通过 `textContent` 写入，不解析 HTML。

浏览器 popover 进入 top layer，不受应用内面板 `z-index`、祖先 `overflow` 或 `backdrop-filter` 层叠上下文限制。替代方案是继续使用伪元素或仅增加一个高 `z-index` 的 fixed 节点；前者仍会被裁剪，后者仍可能输给 dialog/top-layer 内容，因此均不满足“最上层”的明确要求。

### 保留可访问名称并统一触发路径

现有 `aria-label` 继续作为控件名称，`data-tooltip` 只提供视觉帮助文本。模板入口补充 `data-tooltip="提示词模板"`。共享浮层设为 `role="tooltip"`，并在显示期间把触发控件的 `aria-describedby` 临时关联到该节点，关闭后恢复原值。

## Risks / Trade-offs

- [极旧浏览器不支持 Popover API] -> 提示节点仍以固定定位显示，并使用应用最高层级作为回退；当前 Electron/Chromium 与项目目标浏览器支持原生 popover。
- [触发控件靠近视口边缘] -> 使用实际提示尺寸和 visual viewport 边界做上下翻转及水平夹取。
- [滚动时提示与控件脱离] -> 任意捕获阶段滚动先隐藏提示，下一次悬浮或焦点重新定位。
- [移动端触摸没有 hover] -> 保留焦点触发，且不改变按钮的 `title`、`aria-label` 或点击行为。

## Migration Plan

1. 更新规格、静态契约和前端实现。
2. 在隔离端口验证桌面、窄桌面和移动布局中的几何与交互。
3. 验证通过后归档增量规格并合并到主规格。
4. 回滚只需恢复锚点同步和旧提示样式；无数据迁移或服务端部署步骤。

## Open Questions

- None.
