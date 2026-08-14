## Why

当前 Prompt Kit 虽然已经离开参数区，但被固定在浏览器最右侧，和主预览中用户实际查看的区域之间留下过大的空档，模板内容与生成结果难以同时查看。面板需要跟随主预览的可见边界定位，让用户在编辑模板时保持生成上下文。

## What Changes

- 桌面和窄桌面布局将 Prompt Kit 面板的左侧锚定到主预览画布的可见中线，并从该边界向右展开。
- 面板锚点由运行时测量的预览几何发布为 CSS 变量，随窗口缩放、浏览器缩放和工作台尺寸同步更新。
- 保留 tablet、stacked 和 mobile 的视口内单列、可滚动回退，不让面板在受限宽度下溢出或覆盖参数控件。
- 保留模板选择、编辑、保存、插入、删除、关闭、焦点恢复和本地存储行为。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `creation-mode`: 调整桌面 Prompt Kit 面板的停靠边界，从视口右缘改为主预览可见中线，同时保持受限布局回退和参数区避让要求。

## Impact

影响 `public/app.js` 的工作台几何同步、`public/styles.css` 的 Prompt Kit 定位规则以及 `test/studio-preview-layout.test.mjs` 的静态布局契约。无需修改服务端 API、生成请求、模板数据格式或第三方依赖。
