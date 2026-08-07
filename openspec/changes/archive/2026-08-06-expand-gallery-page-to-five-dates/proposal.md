## Why

瀑布画廊当前每页只包含两个日期，查看较长历史时翻页过于频繁。用户希望每页连续展示五个完整日期，同时保持当前缩略图的勘察尺寸，不因同页日期变多而缩小图片。

## What Changes

- 普通历史分页从每页两个完整日期扩展为每页五个完整日期。
- 桌面端仍以完整历史中的连续两个日期为一个尺寸计算组，复用现有三行自适应规则；第五个日期与下一页的第六个日期共同计算（若存在），从而保持跨页前后的图片宽高尺度。
- 搜索、平板、手机、勾选、灯箱和删除行为保持不变。
- 更新分页说明、单元测试、结构测试与真实浏览器验收。

## Capabilities

### New Capabilities

<!-- 无新增能力。 -->

### Modified Capabilities

- `gallery-history-browsing`: 普通历史每页由两个日期改为五个日期，并明确桌面尺寸仍按连续两日期分组计算。

## Impact

- 画廊分页与布局：`lib/gallery-organizer.mjs` 及其 `public/lib` 镜像。
- 前端摘要与静态资源版本：`public/app.js`、`public/index.html`。
- 测试与规格：画廊组织器、资产工作区结构和 `gallery-history-browsing`。
- 不修改服务端 API、图片数据或删除语义。
