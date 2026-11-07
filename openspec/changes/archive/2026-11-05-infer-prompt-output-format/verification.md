# 验证记录

日期：2026-11-05，Asia/Shanghai。用户确认模型兼容性仅提示，仍按具体格式正常发送，不在本地以模型名称拦截。

## 已完成验证

- 全量测试：npm test，3150 项通过、0 失败、0 跳过。最终日志为 test-results/prompt-output-format-full-test-final.log，耗时约 319 秒。
- 请求回归：Images 和 Responses 均发送具体格式，不发送 auto。gpt-image-2、2.5、2.6、自定义模型名均保留 GIF/SVG 格式；本地模拟服务验证 GIF 帧参数、原件字节及未发送工具模型的 Responses 路径。
- 自动规则：覆盖明确格式、中英文 GIF、动图、循环动画、否定、最后一次格式要求；动画风格和画面内的格式字样不触发动图。
- 控件与快照：手动格式优先且冲突不阻断；模型切换不把 GIF 静默改为 PNG；两个入口同步，入队任务保留具体格式与原帧参数，其他工作流不接收 auto。
- 文件验证：GIF 原件保存、重新读取和下载字节一致；请求 GIF 而收到 PNG 或单帧 GIF 时，在收到结果后报告验证错误，不登记为动画成功。
- 浏览器渲染：隔离 Electron 在 360px 和 1280px 视口验证控件可见、帧参数、能力提示、手动覆盖和视口内无横向溢出；已人工查看截图。截图保存在 test-results/prompt-output-format-visual/。
- 完整应用：另在隔离数据和输出目录启动本地服务，通过内置浏览器确认 gpt-image-2 默认自动，输入 GIF 要求后显示 GIF/9 帧/200 ms 和非阻断提示；手动 PNG 后显示 PNG 及冲突提示。未提交生图；隔离服务已停止。
- 浏览器镜像：node scripts/sync-public-lib.mjs --check，通过 142 个模块。
- 语法：node --check public/app.js 和 node --check server.mjs，通过。
- 编码：18 个相关源码、测试、HTML 和 README 文件通过 UTF-8 往返检查，未发现替换字符；新增 OpenSpec 文档以 UTF-8 写入并读回复核。
- 发布事实：npm run check:release，通过 v0.2.138；本次不发布或变更版本。
- 规范：归档前后 openspec validate --all --strict --no-interactive 均通过 71 项；已合并主规格并归档为 2026-11-05-infer-prompt-output-format。
- 差异：git diff --check 通过，保留工作区已有其他改动。

## 验证边界

- 未调用用户真实接口，未发起真实收费生成。模型实际格式能力由接口响应决定，本地提示不构成能力否定。
- 未重启用户现有服务，未重新打包桌面安装程序。既有运行进程需要重启并刷新页面才能加载服务端修改。
- CONTRIBUTING.md 列出的 npm run build:pages 在当前 package.json 中没有对应脚本，已尝试但无法执行；没有新增构建脚本或替代发布流程。
- 保留参考图编辑、蒙版、多候选及透明背景等原有操作/参数约束；本次改为非阻断的是模型格式兼容性和提示词与手动格式的冲突提示。
