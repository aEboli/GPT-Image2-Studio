## 1. 规格与失败基线

- [x] 1.1 明确五条条带重绘保留横向滚动位置、选中项变化时才揭示、以及选中指示标的可验证边界。
- [x] 1.2 在真实引擎中确认滚动被重置的根因（节点重挂/清空导致 `scrollWidth` 塌缩、`scrollLeft` 被夹回 0）。
  - Electron 探针复现：20 个条目时 `scrollWidth` 2030、`clientWidth` 400；把已有节点挂到 `DocumentFragment` 后 `scrollWidth` 立即塌缩到 400 且 `scrollLeft` 从 700 被夹回 0，`replaceChildren` 之前就已丢失位置。
  - 对照组：捕获/恢复 `scrollLeft` 后为 700；直接 `appendChild` 到活动容器也保持 700。

## 2. 实现

- [x] 2.1 新增共享模块 `lib/filmstrip-selection.mjs`（滚动保留、选中揭示、选中指示标），并登记到 `scripts/sync-public-lib.mjs` 同步清单。
  - 渲染逻辑以回调传入，使「捕获早于任何节点变动」在结构上无法被调用方绕过。
- [x] 2.2 五条条带接入共享模块，每条各持独立揭示跟踪器。
  - `public/app.js`：提示词、图片拆解、融图分析；`lib/views/image-edit-view.mjs`：图片编辑；`lib/views/quick-blend-view.mjs`：快速溶图。
  - 提示词条带保留既有键控节点复用与 `replaceChildren(fragment)` 结构，仅把滚动处理交给共享模块。
  - 融图分析条带没有 `.filmstrip-entry` 外壳，指示标挂在 thumb button 上，复用其自身的 `position: relative` 与圆角裁剪。
- [x] 2.3 五条条带的选中控件统一设置 `aria-current` 并渲染选中指示标；加强描边由 `#filmstrip` 作用域改为 `.filmstrip-item.active` 全局生效。
  - 同时删除被完全覆盖的旧弱描边规则，避免留下死代码。
  - 融图分析条带描边由 0.62 提到 0.82 与其他条带对齐，并为其指示标单独配绿色。
- [x] 2.4 更新静态资源缓存版本并同步断言该版本的测试。
  - `20260825-attempt-preview-deck-1` → `20260829-filmstrip-selection-1`，同步 `public/index.html` 与 3 个断言该版本的测试文件。

## 3. 验证与交付

- [x] 3.1 运行条带、预览布局聚焦测试与完整 `npm test`。
  - `test/studio-preview-layout.test.mjs` 181/181 通过，含 4 个新增/改写的回归测试。
  - 完整 `npm test`：1851 个测试，1832 通过，19 失败；19 个失败全部属于工作区既有的 in-flight 提示词压缩改动（`creation-planner`、`creation-platform-planner`、`creation-platform-generation`、`creation-e2e-regression`），失败集合中没有任何 filmstrip/preview/strip/rail 相关项。
  - 基线核对：暂存本 change 的文件后重跑同一批测试，失败数完全相同，恢复后仍相同。
- [x] 3.2 运行 `node scripts/sync-public-lib.mjs --check`、各模块 `node --check`、`git diff --check`。
  - `sync-public-lib --check` 检查 104 个公共模块通过；4 个改动模块语法检查通过；`git diff --check` 无空白问题。
- [x] 3.3 运行本 change 的 OpenSpec 严格校验。
- [x] 3.4 用真实引擎探针验证五条条带的滚动保留、揭示与指示标计算样式。
  - 五条条带结果完全一致：滚动到 600 后切换靠后条目 → 滚动保持 600；选中项不变的重绘 → 揭示 `skipped` 且滚动保持 600；选中项变为可视范围外 → 滚动自动调整且该条目完整可见。
  - 每条条带同时只有 1 个指示标；四条共享条带指示标为 `rgb(111, 124, 255)` / 20px，融图分析为 `rgb(112, 226, 162)` / 18px；均落在条目左半侧且在条目边界内。
  - 选中描边统一为 0.82 alpha（融图分析为其绿色的 0.82），`aria-current="true"`。
  - `file://` 页面无法动态 import，探针改为内联真实模块源码并去掉 `export` 关键字；探针脚本与临时文件已删除。
- [x] 3.5 反向验证测试有效性（注入回归确认测试会失败）。
  - 把共享模块的捕获移到 `render()` 之后 → 「captures scroll before the render mutates nodes」失败。
  - 删掉快速溶图条带的指示标调用 → 「every generation rail marks the currently viewed thumbnail」失败。
  - 首次注入用 CRLF 替换而该模块是 LF，替换实际未生效、测试误报通过；已改为断言注入确实改动了文件内容，并把捕获顺序断言从「捕获之后的下一个 `render()`」改为锚定「紧跟恢复语句的 `render()`」，否则捕获挪到 render 之后仍能匹配。
