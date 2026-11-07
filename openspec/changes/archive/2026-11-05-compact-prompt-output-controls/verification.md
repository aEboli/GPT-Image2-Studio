# 验证记录

日期：2026-11-05，Asia/Shanghai。

## 已验证

- 先扩展格式控件回归，旧实现因自动开关不能切换到 auto 而失败，再实施最小修改。
- 相关测试 8 项全部通过：image26-output-controls、prompt-output-format、prompt-output-format-layout、output-format-options。
- 自动开启时全部格式按钮禁用，当前实际格式仍高亮；覆盖无关键词默认 PNG，以及 PNG、JPEG、WebP、GIF、SVG、动图关键词。
- 关闭自动将当前解析格式转为手动选择；提示词变化不覆盖手动选择；重新开启后立即重新解析。
- 保持 GIF 帧参数同步、兼容性提示、手动冲突提示和其他模式的下拉框行为。
- 隔离 Electron 在 360px 和 1280px 验证 PNG/GIF/SVG 六种布局；五个格式按钮同排、文字不溢出、禁用时高亮清晰，包括 2.6 的更多参数入口。
- 已查看窄屏和桌面截图；截图位于 test-results/prompt-output-format-visual/，关键词提示在视觉检查后缩短并重新运行相关测试。
- 浏览器镜像检查通过全部 142 个模块；源码语法检查、发布一致性检查 v0.2.138、git diff --check 通过。
- 11 个相关文件通过严格 UTF-8 解码和替换字符检查，新增中文已读回复核。
- 归档前 openspec validate --all --strict --no-interactive：72 项通过。

## 验证边界

- npm test 已执行，日志为 test-results/prompt-output-toggle-full-test.log；出现套图、Listing、桌面及其他模块失败，随后在 image26-server 用例失败后超过四分钟没有新输出，已结束本次测试进程及其子进程。因此全量测试未通过，也未完成。
- 两项旧缓存断言仍要求 styles.css?v=20261103-current-suite-1；任务开始时实际 HTML 已为 20261105-analyst-stream-1。没有扩展修改这些无关断言，其余失败未在本任务展开排查。
- CONTRIBUTING.md 要求的 npm run build:pages 已尝试，但 package.json 中没有此脚本。
- 未调用真实生图接口，未发布、改版本、打包或重启用户服务。工作区已有改动保留。
