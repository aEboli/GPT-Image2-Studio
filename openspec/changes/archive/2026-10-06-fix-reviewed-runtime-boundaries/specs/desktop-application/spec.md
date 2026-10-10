## ADDED Requirements

### Requirement: Desktop API configuration persists independently of the listen port

桌面工作台 SHALL 通过受限的沙盒 preload IPC 将 API 配置保存到稳定的应用用户目录，并在工作台加载时恢复到当前浏览器存储。IPC SHALL 仅允许当前主窗口的顶层 Studio frame 调用；公开 HTTP 配置 SHALL 继续隐藏原始凭据。

#### Scenario: Desktop restarts with a different available port
- **WHEN** 用户保存 API 配置并重启到另一个系统分配端口
- **THEN** 已保存地址、密钥、模型和调度参数恢复
- **AND** 免去重新输入配置

#### Scenario: An unrelated frame attempts private configuration access
- **WHEN** 子 frame、其他窗口或非 Studio origin 调用配置 IPC
- **THEN** 主进程拒绝该调用
- **AND** 不返回或修改私有配置
