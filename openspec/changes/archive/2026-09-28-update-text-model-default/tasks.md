## 实现

- [x] 1.1 将共享 Responses 与直连文本/视觉默认值改为 `gpt-6-luna`，并同步 `public/lib` 镜像。
- [x] 1.2 更新界面初始模型显示与两个文本模型输入框的占位提示。
- [x] 1.3 更新 `.env.example` 和中英文 README 中的默认值与配置示例。
- [x] 1.4 更新默认值断言，确认显式配置仍被保留。

## 验证

- [x] 2.1 运行相关配置与默认值测试。
- [x] 2.2 检查 public/lib 同步、OpenSpec strict 校验和 `git diff --check`。
- [x] 2.3 检查当前文档、界面和默认值代码不再将 `gpt-5.4-mini` 描述为默认值。
