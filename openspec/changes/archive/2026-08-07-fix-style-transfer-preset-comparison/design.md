## Context

风格迁移预设卡片已经同时渲染 beforeImage 与 image，但点击后调用共享单图 Lightbox，并把两项作为前后导航列表。因此 DOM 一次只渲染当前项，同时共享 Lightbox 的元信息、检查器和下载控制仍然可见。普通 Lightbox 还承担画廊图片的缩放、平移、下载和参数检查，不能为这次需求全局简化。

## Goals / Non-Goals

**Goals:**

- 让两张预设示意图的点击目标完全一致，并在一个视图中同时呈现前后两图。
- 让共享原图和预设效果图的归属、标签及阅读顺序固定且可测试。
- 复用现有遮罩、焦点捕获、Esc 关闭和焦点恢复能力。

**Non-Goals:**

- 不修改普通画廊、生成结果、Creation 参考图等 Lightbox。
- 不修改预设图素材内容、生成提示词或提交给上游的风格参考文件。
- 不在双图比较中增加滑杆、下载、缩放或其他新操作。

## Decisions

### 1. 在共享 Lightbox 中增加专用的预设双图模式

使用 isStyleTransferComparisonItem 标记一个包含固定 before/after 配对数据的虚拟项。共享 Lightbox 继续负责打开、关闭、遮罩、Esc 和焦点生命周期；同步渲染时切换专用 CSS 状态，隐藏普通头部元信息、操作区、单图 shell 与检查器，并显示双图容器。

相比创建第二套模态框，此方案避免复制 overlay 生命周期；相比继续使用导航列表，此方案能保证两图同时存在于 DOM 和可视布局中。

### 2. 配对构建函数作为前后语义的唯一来源

风格迁移模块输出一个 comparison item，其中 before 只读取 preset.beforeImage，after 只读取 preset.image，顺序固定为 before 后 after。素材映射同时纠正为：cinematic-photo.png 是所有预设共用的 before 原图，style-before.png 是电影写实的 after 效果图。主界面的两张卡片和打开后的配对视图都沿用该映射，避免共同原图继续误放在“电影写实 / 风格后”。

### 3. 双图视图仅保留关闭控制

专用状态下隐藏标题、模型、时间、ID、查看控制、下载和右侧检查器，只显示返回/关闭按钮与两张无额外说明的图。图片仍提供准确的替代文本，关闭按钮保持可见焦点环；窄屏改为纵向堆叠并允许内容区滚动。

## Risks / Trade-offs

- [共享 Lightbox CSS 状态泄漏到下一次打开] → 每次同步和关闭时都显式移除/切换专用 class，并用回归测试覆盖普通 image-only 状态。
- [两张大图在窄屏不足以同时完整露出] → 桌面并排、窄屏纵向排列；两张图都在同一打开视图中并可通过内容区滚动查看，不退回单图导航。
- [浏览器仍加载普通单图 URL] → comparison item 提供 before 图作为兼容 URL，但专用模式只渲染配对容器，普通图片 shell 被隐藏。

## Migration Plan

纯前端向后兼容改动，无数据迁移。回滚时删除专用 comparison DOM/CSS 与 item 标记，恢复原有单图导航调用即可。

## Open Questions

- None.
