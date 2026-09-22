## 1. 规格与回归基线

- [x] 1.1 记录十个实用默认模板的名称、用途边界和证件照核心视觉要求。
- [x] 1.2 明确旧 `default-template-N`、新 `default-template-v2-N`、用户自定义模板和 `prompt-agent-*` 模板的迁移边界。
- [x] 1.3 更新 Prompt Kit 静态契约测试，移除旧十个日常场景名称断言并加入新模板与迁移断言。

## 2. 默认模板与存储迁移

- [x] 2.1 将 `SURPRISE_PROMPTS` 替换为十个高频图像工作流模板，并保持每条提示词在编辑器上限内。
- [x] 2.2 将内置模板 ID 改为 `default-template-v2-*`，不改变现有模板存储键。
- [x] 2.3 在读取已保存模板时移除旧 `default-template-N` 和重复的当前内置，追加当前十个默认模板，同时保留自定义与 Prompt Agent 条目。
- [x] 2.4 保持缺少存储键、显式空数组、解析失败和 `localStorage.setItem` 失败时的既有容错语义。

## 3. 验证与交付

- [x] 3.1 运行 Prompt Kit 相关聚焦测试；当前模板/迁移静态契约已通过。
- [x] 3.2 运行完整 `npm test`，并区分本次模板变更与工作树中既有变更的失败；2380/2380 通过。
- [x] 3.3 运行 `npx --no-install openspec validate refresh-prompt-kit-default-templates --strict --no-interactive`、全项目严格校验和 `git diff --check`；change 与全项目严格校验均通过，diff 无空白错误。
- [x] 3.4 将增量规范合并到 `openspec/specs/image-to-prompt/spec.md`，再归档本 change。
