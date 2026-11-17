# 套图标题与文件夹语言命名验证

日期：2026-11-17（北京时间）。

## 范围

- 从 2026-11-17 零点起创建的套图，队列、当前套图、记录列表及记录详情标题追加该套保存的中文语言名称；保留商品名原始字段。
- 新生成及补图新建目录在原有名称末尾追加语言，原有日期、时间和唯一标识保留；更早记录的显示和命名不变。
- 当天历史目录迁移同时更新原图、JSON 侧车、已有缩略图目录与路径引用，保留原始 JSON 备份。迁移等待当天 13 套生成及自动 Listing 全部结束后进行，并在停止本项目服务的窗口内执行；完成后恢复 3600 端口服务。

## 自动检查

- 修改前新增命名测试缺少实现而失败；新增记录标题测试在修改前因缺少语言后缀失败。
- 命名、迁移、当前套图、队列、存储、记录列表及记录往返测试：88 项全部通过，日志 `.local/creation-language-focused-core.log`。
- 上述前五组测试及页面布局测试：266 项全部通过，其中 192 项为页面布局测试，日志 `.local/creation-language-focused.log`。队列宽度断言已随新增语言显示从 220 px 更新至 280 px，并增加语言不收缩断言。
- 完整串行测试初次运行共 3360 项，通过 3358 项；两项失败中的队列旧宽度断言已修正并通过上述重跑。
- 剩余原有失败为 `test/creation-platform-planner.test.mjs:425` 的 `scene and persona items carry a concrete setting while every item anchors the product first`：断言要求提示词不含 `Creative range`，而任务开始前已有未提交的规划模块变更包含此文字。该测试仅依赖规划及参考标签模块，不依赖本次命名改动；未修改相关规划实现或断言。隔离复现见 `.local/creation-language-existing-failure.log`。
- 公共模块同步检查、JavaScript 语法检查、版本一致性检查、OpenSpec 严格检查及 `git diff --check` 通过。

## 真实资产迁移

- 输出根目录：`C:\Users\Administrator\Pictures`。
- 日期范围：仅 `2026-11-17`；13 套、212 张原图。
- 目录示例：`1241-电加热触屏手套-80cc-e0b-葡萄牙语`。
- 更新 225 份 JSON：13 份套图记录及 212 份图片侧车。
- 对 424 个二进制文件校验 SHA-256：212 张原图及 212 张已有缩略图，迁移前后内容一致。
- 每套抽查一条新图片 URL：13 条 GET 全部返回 200、图片内容类型；文件系统逐项确认 212 张已完成原图存在。
- 再次预览迁移返回 `count: 0`，确认重复执行不再追加语言。
- 原始 JSON、目录映射及哈希日志备份：`.local/creation-language-backup-20261117-5a8bff38/`。
- 实际结果：`.local/creation-language-migration-result.json`、`.local/creation-language-assets-verification.json` 及 `.local/creation-language-migration-recheck.json`。

## 验证边界

本次新增测试使用隔离数据，不主动发起新的真实生图、翻译或 Listing 请求。浏览器验证使用独立页面读取今天的真实记录，保留用户原工作台；页面需重新载入脚本后显示新规则。

## 浏览器实查

- 在独立真实工作台页面筛选“今天 · 13”，13 个列表标题均显示各自保存的中文语言，涵盖法语、德语、西班牙语、意大利语、葡萄牙语、波兰语、荷兰语及英语。
- 选中葡萄牙语记录，详情标题为“电加热触屏手套 · 葡萄牙语”，16 张原图均完成加载。
- 旧日期的列表标题仍保持原样。
- 实际截图：`.local/creation-language-names.png`；更新后的验证页面已保留供直接查看。
