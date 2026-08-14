## 1. 结构化提示词分组

- [x] 1.1 在 `lib/asset-workspace.mjs` 增加可测试的结构化字段转换，将数组值聚合到共同父路径并保留嵌套键文本。
- [x] 1.2 让 DOM 渲染使用新的字段转换结果，并运行 `npm run sync:public-lib` 更新 `public/lib/asset-workspace.mjs`。
- [x] 1.3 增加数组、嵌套对象和原始提示词不变的聚焦测试。

## 2. 图片详情紧凑布局

- [x] 2.1 在已有 Lightbox 查看器指标同步中计算桌面媒体区高度，并在布局切换或无自然尺寸时清理临时高度变量。
- [x] 2.2 将桌面详情弹窗改为内容高度加视口上限，保留 tablet、stacked、mobile 的堆叠和独立滚动规则。
- [x] 2.3 更新布局契约测试，覆盖紧凑高度变量、数组分组和响应式回退约束。

## 3. 验证与归档

- [x] 3.1 运行结构化提示词、Lightbox 布局和 public-lib 同步检查。
- [x] 3.2 在隔离端口用桌面、tablet/mobile 视口检查图片详情几何、滚动、复制和缩放控制。
- [x] 3.3 运行项目测试、`git diff --check` 与 `openspec validate --all --strict --no-interactive`，确认无未解决缺口后归档变更。
