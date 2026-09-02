## 1. 规格与测试

- [x] 1.1 新增图片软显现的增量规格、设计和验收标准。
- [x] 1.2 新增共享图片软显现模块的状态、解码和错误清理测试。
- [x] 1.3 扩展主预览、灯箱和专项生成入口的回归测试。

## 2. 最小实现

- [x] 2.1 实现加载并解码后才标记 revealed 的共享图片工具，处理缓存、重复 source、换 source 和清空。
- [x] 2.2 接入提示词、图片拆解、融图分析、图片编辑和快速溶图的主预览。
- [x] 2.3 接入图片详情灯箱，保持缩放、拖拽、适配与导航行为不变。
- [x] 2.4 添加软聚焦样式及 reduced-motion 覆盖，不改动生成加载壳。
- [x] 2.5 同步公共浏览器模块镜像。

## 3. 验证

- [x] 3.1 运行图片显现、预览、灯箱和专项入口的定向测试。
- [x] 3.2 运行 `node scripts/sync-public-lib.mjs --check`、`npx --no-install openspec validate add-image-soft-reveal --strict` 和 `git diff --check`。
- [x] 3.3 启动本地 Studio，在浏览器中检查生成预览和灯箱切图的显现效果，并由样式回归测试验证 reduced-motion 降级。
