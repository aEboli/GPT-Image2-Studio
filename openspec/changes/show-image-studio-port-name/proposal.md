# 在 Windows 端口面板显示项目名称

Windows 端口面板按监听进程的可执行文件名显示名称。现有启动器直接运行 `node.exe`，因此面板一直显示 `nodejs`；设置 Node 的进程标题不能改变 Windows 进程映像名。

更新 Windows Studio 启动器：将当前 Node 运行时复制到项目本地 `image-studio` 目录并命名为 `image-studio.exe`，再由该可执行文件启动服务。端口面板以运行时所在目录作为项目名称，因此这个目录名可以让面板显示 `image-studio`。健康检查、端口选择和服务入口保持不变。

## 影响范围

- `launch-studio.ps1`：启动新服务前创建或更新 `.local/image-studio/image-studio.exe`，并用它运行 `server.mjs`。
- `windows-powershell-runtime`：明确要求新启动的服务进程以 `image-studio.exe` 为映像名。

## 验收标准

- 从启动器新启动的 3600 监听进程映像名为 `image-studio.exe`。
- `/api/article-illustration/sets` 返回 HTTP 200。
- 已健康运行的 Studio 仍可复用，其他端口选择行为保持不变。
