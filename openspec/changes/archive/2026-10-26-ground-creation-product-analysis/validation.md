## 2026-10-26：商品分析、场景分配与证据拦截

用户已确认按方案完整实现。本变更完成商品分析、场景分配、提示词重构，以及单 SKU、无尺寸资料的服务端证据拦截。

### 证据

- 针对套图规划、提交、保存、队列、自动补图、参考图、前端函数、接口与快捷套图的 439 项相关回归全部通过。命令及完整结果保存在本地 `test-results/creation-product-evidence-final-20261026.log`。
- `creation-e2e-regression.test.mjs` 的 `single-SKU and missing-size items never call the upstream during generation or repair` 使用本地假上游：四项计划仅主图发起一次生图请求，尺寸图、多 SKU 图、参数表为 `skipped`；手动补图和全部缺数据的冻结计划均新增零个上游请求。
- 测试故意删除冻结计划中的 `evidenceBlocked`、`evidenceRequirement`，服务端仍重新拦截。对同一商品不同视角、颜色组成顺序变化和同源图片被错误分成两个 SKU 也保持拦截。
- 浏览器函数回归验证：识别应用保留手动主主体、保留其外观说明，并拒绝把另一张图同时提升为主主体；归一化保留缺数据标记，进度只统计实际生成项。
- 商品分析回归验证：只保留带来源事实，冲突事实不进入提示词；买点和痛点必须绑定事实；场景分配使用不同环境、动作与镜头，人物只保留手部或局部身体语境。
- 生命周期回归验证：分析字段通过预览、冻结计划、队列、保存记录、历史复用和补图；商品名称/描述或参考图变化会使旧分析失效。
- `node scripts/sync-public-lib.mjs --check` 与 OpenSpec 严格校验通过。

### 全量测试限制

全量首次运行共 2565 项，其中 6 项失败。与本轮修复相关的 3 条旧静态断言已修正或保持兼容并单独通过；其余 3 条是工作区原有测试将 `app.js` 的资源版本固定为 `20261026-quick-suite-17`，而页面已使用 `20261026-suite-startup-fix-1`，涉及 `creation-card-idle-ripple.test.mjs`、`disabled-shake.test.mjs` 和 `portrait-cosplay-assets.test.mjs`。本轮不修改这些无关版本断言，也不声称全量通过。

### 未验证

未调用用户的真实生图服务，没有消耗用户生图额度。未进行真实模型出图或桌面截图验收，提示词主体保护不能作为像素级保真的证明。已生成的历史图片未重写。
