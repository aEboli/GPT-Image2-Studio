## Why

Temu 上品工作台的“变种信息”区域目前只能编辑已有 SKU 行。用户从 Studio 导入商品或创建商品后，无法在工作台内补充新的可售变种，只能恢复草稿或依赖外部数据重新生成 SKU。

## What Changes

- 在“变种信息”标题区提供明确的“新增变种”操作。
- 每次操作只追加一条 SKU 变种行，不重新生成双变种笛卡尔矩阵，也不改写已有行。
- 新行继承商品级价格、尺寸、重量和库存默认值，使用空图片，并生成不重复的 ASCII SKU 货号。
- 双变种商品的新行带入一个现有第二变种值；新增后立即进入第一变种值编辑状态。
- 新行沿用现有草稿保存、校验、图片管理和 Excel 导出流程。

## Capabilities

### New Capabilities

- `temu-workbench-variant-rows`: Temu 工作台中的手工 SKU 变种行新增行为。

### Modified Capabilities

无。

## Impact

- Frontend: `public/temu/index.html` 与 `public/temu/app.js`。
- Domain: `lib/temu/domain.mjs` 及其浏览器镜像。
- Tests: Temu domain 与工作台外壳回归测试。
- Export: 不改变模板、接口或映射；新增行直接进入既有 `draft.skus` 导出路径。
