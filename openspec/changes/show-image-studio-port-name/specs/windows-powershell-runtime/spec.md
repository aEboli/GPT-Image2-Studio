# windows-powershell-runtime Specification Delta

## MODIFIED Requirements

### Requirement: Browser launcher preserves Studio discovery
启动器 SHALL 保留 Root 与 Port 参数、默认端口 3600、从请求端口起的 50 个候选端口、单次监听快照和 `/api/article-illustration/sets` 健康检查，只复用通过检查的服务，并清理 `IMAGE_STUDIO_MOCK_IMAGE_GENERATION`。新启动的 Studio 服务 SHALL 使用名为 `image-studio.exe` 的 Node 运行时映像。

#### Scenario: Existing service or port conflict
- **WHEN** 请求端口已占用
- **THEN** 启动器仅复用健康检查成功的 Studio，否则选择范围内首个可用端口启动 `server.mjs`
- **AND** 新启动的 Studio 进程映像名为 `image-studio.exe`，使端口面板显示 `image-studio`
