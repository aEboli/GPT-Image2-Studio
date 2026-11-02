## 验证结果

2026-11-02，在当前 Windows 工作区完成以下验证。

- 队列复现：30 套、600 项、100 次不变刷新，修复前额外创建 12,000 个节点、归一化 3,000 次；修复后两者均为 0。选择、状态变化、重排、删除均通过行为测试。
- `node --test --test-concurrency=1 test/creation*.test.mjs test/generation*.test.mjs test/heartbeat*.test.mjs test/browser-image-cache.test.mjs test/viewport-image.test.mjs test/deferred-update.test.mjs test/view-mode-loader.test.mjs test/portrait-cosplay-assets.test.mjs`：1,510 项通过，0 失败。日志：`test-results/creation-render-focused.log`。
- 针对套图、队列、日志及缓存版本的最终布局测试：47 项通过，0 失败。日志：`test-results/creation-render-final-layout.log`。首次较宽运行中的两个缓存版本断言，已在同步新版本后重跑通过；不把首次失败计为通过。
- 最新进度、日志、心跳、图片分块清理回归：36 项通过，0 失败。包括突发合并、立即终态、最新选中套图、跨队列心跳隔离、静态卡片不读取提示词大对象、隐藏记录视图继续更新内存、页面隐藏或离开时日志落盘。日志：`test-results/creation-render-performance.log`。
- `node scripts/sync-public-lib.mjs --check`：134 个浏览器模块一致。`public/app.js`、队列模块和新增合并更新模块语法检查通过；`git diff --check` 通过，新增中文内容按 UTF-8 检查。

## Electron 实际 DOM 验证

使用临时回环 HTTP 服务、独立内存会话和隐藏 Electron 窗口，载入实际页面、实际前端模块及模拟任务。测试禁用正常启动与上游调用，使用本地测试图片，不读取用户凭据、不刷新用户正在运行的页面。

- 30 套、600 项，100 次不变队列刷新：新增节点 0，全部按钮保持原节点。
- 连续 600 条状态事件：网格没有增删子卡片；已完成卡片、实际参考图节点、分析正文保持原节点。
- 保存单图立即显示图片，切换队列正确，打开配置后日志可见。
- 页面控制台错误 0，验证进程退出码 0。
- 可复核脚本与输出：`test-results/creation-render-browser.cjs`、`test-results/creation-render-browser.json`。

## 验证边界

以上验证使用模拟任务和本地图片，没有调用真实收费生图接口，不能代表数小时真实生成下的峰值内存、GPU 占用或实际帧率。Electron 在窗口销毁时输出 `GPU state invalid after WaitForGetOffsetInRange`，页面运行期间无控制台错误，记录为测试环境退出阶段诊断。既有未提交的缩略图、离屏图片和分块内存优化保留，本次没有重新生成或改写历史图片，也没有重新打包安装版。
