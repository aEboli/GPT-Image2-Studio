# 设计

Windows 端口面板按运行时所在目录显示名称，而不是读取 Node.js 的 `process.title` 或映像文件名。Node.js 可从副本路径启动，因此启动器在 `.local/image-studio/image-studio.exe` 创建当前系统 Node 运行时副本，并以该路径启动 `server.mjs`。`.local` 已是项目运行时数据目录且被 Git 忽略；启动器在副本缺失或与当前 Node 文件长度、修改时间不一致时更新副本，避免每次启动重复复制大型运行时。父目录 `image-studio` 是端口面板显示名称的来源。

如果启动器复用已通过健康检查的服务，不需要替换其进程。现有监听进程需要停止并由启动器重新启动，名称才会更新。
