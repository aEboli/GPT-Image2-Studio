# 多区域局部图片编辑设计

## 背景

当前 Image Edit 模式支持上传一张源图并输入一段编辑指令，后端通过 `gpt-image-2` 的 `/v1/images/edits` 生成一张新结果图。这能完成整图编辑，但不够像真实修图：用户无法直接在原图上标出要修改的位置，也无法给不同区域写不同要求。

OpenAI 图像编辑接口支持 `image + mask + prompt`。mask 需要和源图同尺寸/同格式并带 alpha 通道，透明区域代表需要被替换或重绘的区域。这个能力适合扩展成“在原图上涂抹局部区域，再给每个区域写指令”的交互。

## 目标

- 在 `#image-edit` 中新增局部编辑工作流，而不是再开一个完全孤立的页面。
- 支持用户在源图画布上创建多个涂抹区域。
- 每个涂抹区域都有独立文本框，用于描述该区域要如何修改。
- 生成前可选择执行策略：
  - `一次合并（快）`：合并所有区域 mask 和指令，发起一次编辑请求。
  - `逐区精修（准）`：按区域顺序多次编辑，每次把上一步结果作为下一步源图。
- 保留现有 Image Edit 的上传、尺寸、格式、预览、缩略图、队列和 gallery 保存逻辑。

## 非目标

- 第一版不做 Photoshop 级图层系统。
- 第一版不做复杂选区算法，如魔棒、主体分割、边缘羽化自动识别。
- 第一版不修改原图文件本身，所有编辑仍输出为新的结果图。
- 第一版不支持多张源图同时局部编辑。

## 用户体验

Image Edit 面板增加一个局部编辑区域。上传源图后，左侧显示原图画布，画布上叠加半透明 mask 图层。用户点击“新增区域”后进入涂抹状态，当前区域用一种颜色显示，并在画布和右侧列表中使用相同编号。

右侧显示区域列表。每个区域卡片包含：

- 区域编号和颜色标识。
- 独立编辑指令文本框。
- 区域操作：选中、隐藏/显示、清空涂抹、删除。

底部提供执行策略开关：

- `一次合并（快）`作为默认值，适合简单批量修改。
- `逐区精修（准）`适合多个区域彼此独立、需要更精确控制的修图。

生成按钮文案根据策略变化：

- 合并模式：`开始局部编辑`
- 逐区模式：`逐区精修`

## 交互细节

### 画布工具

画布工具至少包括：

- 画笔：在当前区域上添加 mask。
- 橡皮：擦除当前区域的 mask。
- 撤销/重做：只作用于当前区域。
- 笔刷大小：用滑块调整。
- 新增区域：创建新的区域卡片并切换为当前区域。

第一版只需要圆形笔刷。每次涂抹都记录为当前区域的 mask 数据，不需要记录为复杂路径。

### 区域约束

- 至少需要一个有 mask 的区域。
- 每个有 mask 的区域必须有非空指令。
- 空区域不参与生成，并在生成前给出提示。
- 删除当前区域后自动选中相邻区域。
- 区域编号保持稳定，删除区域不需要重排历史编号。

### 执行策略

#### 一次合并（快）

前端把所有有效区域的 mask 合成一个 alpha mask。prompt 合成为结构化文本，例如：

```text
Edit only the masked areas. Keep all unmasked areas unchanged.
Region 1: 把杯子改成红色陶瓷质感。
Region 2: 替换成木质桌面纹理。
Region 3: 去掉这一段反光。
```

后端调用一次 `/v1/images/edits`，保存最终结果。

#### 逐区精修（准）

前端按区域顺序创建一个队列任务。后端按顺序执行：

1. 使用原图 + 区域 1 mask + 区域 1 prompt 生成中间图。
2. 使用中间图 + 区域 2 mask + 区域 2 prompt 生成下一张中间图。
3. 重复直到所有区域完成。
4. 保存最终结果。

逐区模式默认只把最终结果作为 gallery 主资产保存。中间图可以作为任务内部状态显示进度，但第一版不需要作为独立 gallery 项保存。

## 数据模型

前端 `state.imageEdit` 增加局部编辑状态：

```js
{
  localEdit: {
    enabled: false,
    activeRegionId: "",
    brushSize: 48,
    tool: "brush",
    executionStrategy: "merge",
    regions: [
      {
        id: "region-1",
        index: 1,
        color: "#f5506e",
        instruction: "",
        maskDataUrl: "",
        hasMask: false,
        visible: true
      }
    ]
  }
}
```

后端接收表单字段：

- `mode=image-edit`
- `editMode=local-mask`
- `executionStrategy=merge | sequential`
- `regionInstructions`：JSON 字符串，包含区域 id、编号和指令。
- `mask` 或 `masks[]`：合并模式发送一个 mask；逐区模式发送多个区域 mask。
- `referenceImages[]`：仍然只允许一张源图。

## 后端行为

后端在现有 `mode=image-edit` 分支内新增 `editMode=local-mask` 分支：

- 合并模式：校验一张源图、一个合并 mask、至少一个有效区域指令，调用一次 `requestImageEdit`。
- 逐区模式：校验一张源图、多张区域 mask、每个 mask 对应一条指令，按顺序多次调用 `requestImageEdit`。
- 每次调用都必须确保 mask 与当前源图尺寸一致。前端应生成同尺寸 mask，后端做必要校验和错误提示。

保存 metadata 时增加：

- `editMode: "local-mask"`
- `executionStrategy`
- `regionCount`
- `regionInstructions`
- `sourceImageName`
- `editInstruction`：合并后的可读总指令。

## 错误处理

- 未上传源图：提示“请先上传一张源图。”
- 没有涂抹区域：提示“请先涂抹至少一个要修改的区域。”
- 区域缺少指令：提示“区域 N 还没有编辑指令。”
- mask 生成失败：提示“局部编辑区域生成失败，请重新涂抹。”
- 上游编辑失败：沿用现有 SSE error 路径，并显示当前失败区域；逐区模式中已完成的中间步骤不保存为最终结果。

## 测试计划

- 布局测试：Image Edit 显示局部编辑画布、工具栏、区域列表、执行策略开关和生成按钮。
- 前端状态测试：新增/删除/选择区域、指令输入、mask 有无、策略切换。
- 表单构造测试：合并模式提交一个 mask 和合并指令；逐区模式提交多个 masks 和区域指令 JSON。
- 后端测试：合并模式调用一次 edits；逐区模式按区域数量调用多次 edits。
- 校验测试：无源图、无 mask、区域无指令、多个源图、非图片源图都被拒绝。
- gallery 测试：保存最终结果 metadata，且删除/清空历史后 Image Edit 状态不指向已删除结果。
- Worker parity 测试：Cloudflare Worker 与本地 server 行为保持一致。

## 后续实施建议

正式实施时创建 OpenSpec change，建议名称为 `add-local-mask-image-edit`。第一阶段只做圆形笔刷、橡皮、撤销、区域文本框、合并/逐区策略和保存 metadata；第二阶段再考虑羽化、区域重命名、局部预览和中间图留存。
