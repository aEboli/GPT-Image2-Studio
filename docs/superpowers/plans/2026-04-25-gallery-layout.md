# Gallery Layout Plan Archive

状态：已完成并归档。

这个文件原本是瀑布画廊布局和历史浏览改造的执行计划。对应实现现在已经落在代码和测试中，保留本文只作为历史索引，不再作为待执行计划使用。

## 已落地范围

- 画廊组织逻辑已抽到 `lib/gallery-organizer.mjs`。
- 已支持按时间、尺寸、参考图等条件筛选。
- 已支持按日期分组展示历史图片。
- 瀑布流历史已按日期段分页，关键词搜索时绕过分页。
- 画廊相关布局、滚动和响应式行为已有静态测试覆盖。

## 当前验证入口

- `test/gallery-organizer.test.mjs`
- `test/studio-preview-layout.test.mjs`
- `cmd /c npm test`

后续如果继续改画廊，不应复用这个历史计划；应以新的明确需求或 OpenSpec change 为事实来源。
