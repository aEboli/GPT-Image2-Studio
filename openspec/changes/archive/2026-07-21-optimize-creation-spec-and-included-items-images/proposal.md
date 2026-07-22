## Why

套图模式当前把“参数规格图”约束为完整参数表，并强制每个识别出的尺寸值逐行展示。参考图中存在多组或重复尺寸时，这会生成以数据为主体、缺少商品解释价值的密集表格。与此同时，“到手清单/配件图”的平台构图被定义为 `flat-lay-in-box`，提示词也反复强调 “in the box”，模型因此容易把商品和配件全部塞进纸盒、纸托或包装容器里。

## What Changes

- 保留套图计划中的完整规格事实，但“参数规格图”只选择最多 4 个不同属性的关键规格用于画面，优先使用商品主体、尺寸线、局部标注和简短解释建立规格与购买判断的联系。
- 禁止“参数规格图”退化为整页数据表、电子表格或重复同名参数行；“尺寸容量适配图”仍可承担完整尺寸核验职责。
- 将“到手清单/配件图”改为拆包后的商品与配件平铺：所有确认随附的物品和数量完整可见、互不遮挡，并在包装外展示。
- 只有用户输入或参考证据明确证明包装属于到手内容时，才把包装作为独立的次要清单项展示；禁止默认生成纸箱、纸托、吸塑托盘或把所有物品放进容器。
- 同步通用角色提示词和平台图片类型的构图契约，保持 Local、Worker 和浏览器策略副本一致。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: 参数规格图改为商品主导的关键规格解析，到手清单/配件图改为默认拆包平铺并限制无依据包装。

## Impact

- 规划与提示词：`lib/creation-planner.mjs`。
- 平台图片策略：`lib/creation-platform-policies.mjs` 及同步后的 `public/lib/creation-platform-policies.mjs`。
- 测试：`test/creation-planner.test.mjs`、`test/creation-platform-policies.test.mjs`。
- 兼容性：不修改现有 role ID、imageType、API 字段或保存结构；历史套图继续使用已冻结的旧提示词，重新规划后采用新规则。
