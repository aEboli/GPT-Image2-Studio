# Tasks

- [x] 删除按图片比例写入 `--lightbox-media-height` 的查看器逻辑，并同步 `public/lib/` 镜像。
- [x] 恢复桌面 Lightbox 固定高度与剩余空间媒体行，保留 tablet/mobile 覆盖。
- [x] 更新布局契约测试，锁定固定外框和无动态高度变量。
- [x] 运行聚焦测试、public-lib 同步检查、项目测试与严格 OpenSpec 验证：聚焦测试 13 项通过，public-lib 同步检查 92 个模块通过，`npm test` 为 1641 通过、1 跳过、0 失败，严格 OpenSpec 全量校验为 28 通过、0 失败。
- [x] 在桌面和窄视口复核不同图片比例的 Lightbox 几何与图片完整性。
