## MODIFIED Requirements

### Requirement: Universal sets favor scene-fit images over overlapping information images

通用电商自动套图 SHALL 按可用事实平衡场景、信息解释、产品视角和细节任务。`scene-fit-1`、`scene-fit-2`、`scene-fit-3` SHALL 保留为兼容图型，但 MUST NOT 无条件占用三张场景任务；独立用途不足时，规划器 SHALL 使用有来源的其他信息任务，或明确显示缺口，不循环同一场景凑图。替换项 SHALL 使用实际图型、角色和标题，并维持槽位身份的稳定对位。用户显式选择的图型、逐图提示词及平台硬约束 SHALL 优先，旧冻结计划 SHALL 保持原样。

#### Scenario: Universal 18-image set uses scene-fit slots

- **WHEN** 用户根据有效商品分析预览 18 张通用自动套图
- **THEN** 计划按不同的实际用途分配场景任务，并按依据安排独立信息图
- **AND** 三个兼容的 scene-fit 图型可以在没有独立用途时被其他有依据的任务替换或标记缺口

#### Scenario: Scene facts are distributed across scene-fit items

- **WHEN** 商品资料支持露营、车内与办公室三种不同的核心操作
- **THEN** 场景项分别分配不同操作，而非只换背景
- **AND** 如果三个地点仍是同一手机操作，则只使用该核心操作一次

#### Scenario: Named platforms keep specification slots

- **WHEN** 当前图型包含平台硬约束，或读取已有的命名平台冻结项
- **THEN** 本次自动分工不为满足信息图配比而改写该硬约束或历史冻结项

#### Scenario: One scene reference does not repeat across lifestyle images

- **WHEN** 一张场景参考只证明一种核心操作
- **THEN** 自动方案不把它循环用于多个完整的同类操作画面
- **AND** 其他图只使用自己分配的事实，不复制整张场景的构图与全部备注

#### Scenario: 三个手机近义候选不成为三种用途

- **WHEN** 候选包含通勤查看手机、查看手机地图和拍摄间隙点按手机屏幕
- **THEN** 自动方案将它们视为同一核心操作组
- **AND** 该组只作为一张普通轮播图的主要动作，其余自动位置改用有依据的不同任务或显示缺口

#### Scenario: 手动选择保留

- **WHEN** 用户明确选定多个场景图或填写逐图提示词
- **THEN** 系统保留用户选择与内容
- **AND** 显示重复操作或信息覆盖不足的提示，不静默替换

### Requirement: Scene allocation follows product use and avoids repeated portraits

套图 SHALL 将有区别的环境、核心动作、买点／痛点和镜头分配到场景项，并优先使用商品环境静物、局部使用动作和手部近景。同一交互对象的同一核心操作 SHALL 使用相同操作组；只换背景、手机应用、标题、镜头或准备前后 MUST NOT 被视为独立用途。候选耗尽后 MUST NOT 通过循环分配来补足场景图。系统 MUST NOT 为所有商品固定分配人物年龄、性别或多张举着商品的正脸照。每张提示词 SHALL 对应一项已分配任务及其事实集，保留统一商品身份。

#### Scenario: 手套场景各有用途

- **WHEN** 分析得到摄影操作、通勤握把与岸边垂钓等不同用途
- **THEN** 不同的核心操作分配给不同场景项
- **AND** 不只更换背景来重复同一模特举物动作

#### Scenario: 场景不足不循环

- **WHEN** 9 个自动位置可能使用场景，但只有 6 个候选且其中 3 个属于同一核心操作
- **THEN** 规划器不使用余数循环重复候选
- **AND** 不用“准备前／收纳后”加旧动作来伪造新的用途

#### Scenario: 共享事实仍可能支持不同动作

- **WHEN** 两种不同操作都引用同一个有来源的手部灵活性事实
- **THEN** 系统不只因为事实 ID 相同就认定两种动作重复
- **AND** 仍需分别核对交互对象、核心操作和真实用途

### Requirement: Creation set items use distinct visual formats, casts, and reference sources

普通轮播图 SHALL 明确本图的可见任务与表达形式。具有有效商品事实分析的自动方案 SHALL 按不同信息任务和核心操作区分画面；同一套可以保持统一摄影风格，但 MUST NOT 只换标题、背景或镜头来重复同一任务。信息图 MAY 用于功能、参数、尺寸和卖点等有来源的解释；功能图 MUST NOT 因模板强制而虚构内部结构或爆炸剖面。人物 SHALL 只服务真实动作或穿戴尺度，不强制年龄、性别和正脸。辅助参考 SHALL 按本图分配的事实选择，其备注 MUST NOT 重新引入未分配的卖点或辅助商品外观。未分析的兼容调用与历史冻结记录 SHALL 继续可用。

#### Scenario: Universal set declares distinct formats

- **WHEN** 规划器根据有效商品分析生成通用套图
- **THEN** 每个非手动、可生成的任务明确自身的表达形式
- **AND** 信息任务与核心操作分工明确，不依靠提示词同义改写判断多样性

#### Scenario: People differ across person-led images

- **WHEN** 套图包含多个需要人物参与的动作
- **THEN** 人物与裁切服务各自分配的核心操作
- **AND** 不固定要求年龄、性别、正脸或举物摆拍

#### Scenario: Supporting references are spread out

- **WHEN** 计划有多张功能、材质、使用、尺寸或包装参考
- **THEN** 每张轮播图仅选择其分配事实所需的辅助参考
- **AND** 同一参考可以提供不同事实，但未分配的完整备注不进入本图提示词

#### Scenario: 资料只支持外部功能

- **WHEN** 资料标注功能和电池参数，但没有内部构造证据
- **THEN** 功能信息图只使用完整外部产品、文字标注和连接关系
- **AND** 不因为旧功能渲染模板而生成拆开的电芯、内部层或加热组件

#### Scenario: 辅助图备注包含其他卖点

- **WHEN** 本图仅分配到一项功能，而对应参考图备注还包含其他步骤和参数
- **THEN** 生成请求只携带本图分配的辅助事实
- **AND** 不把完整旧备注重新追加到本图提示词

## ADDED Requirements

### Requirement: Main carousel information coverage is evidence based

资料充分的通用电商自动方案 SHALL 在 6–10 张轮播中保留至少 2 张独立信息图，在 12–18 张轮播中保留至少 3 张独立信息图。信息图 SHALL 有不同的主要信息任务和对应事实，允许功能关系、可靠参数、尺寸、可见结构或有依据的使用步骤。首图上的标题、仅更换文案的同构照片及独立追加的信息图重构 MUST NOT 计入最低数量。事实不足时 SHALL 展示缺失资料并建议减少张数或跳过，MUST NOT 为满足配比虚构功能、步骤、内部结构、参数或商品变体。

#### Scenario: 追加重构不替代主套图的信息分工

- **WHEN** 用户选择 12 张自动轮播且启用额外信息图重构，资料支持至少 3 种独立信息任务
- **THEN** 主轮播仍安排至少 3 张不同任务的信息图
- **AND** 不能把全部信息图留到追加重构项

#### Scenario: 有效信息不足

- **WHEN** 商品只有少量可见外观事实，没有可靠参数、步骤或其他独立信息任务
- **THEN** 系统明确显示不能满足的信息任务和所缺资料
- **AND** 不将同一卖点改写三次或重复同一照片来满足数量

### Requirement: Per-frame facts match the visual task

逐图提示词 SHALL 使用同一份整套分配中的任务、事实来源和表达形式。卖点总览 MAY 聚合多个有来源的不同卖点，MUST NOT 被固定的单买点取模分配削成一项；操作步骤版式 SHALL 要求有来源的步骤及顺序。事实与版式不匹配时 SHALL 选择适合该事实的形式或显示缺口，MUST NOT 借用其他模板重新引入未分配的信息。分配 SHALL 随预览、冻结计划、队列、保存和补图保持一致，旧记录仍可读取。

#### Scenario: 尺寸事实不变成充电步骤

- **WHEN** 本图分配的事实只有宽度、高度和尺码
- **THEN** 采用尺寸标注或参数表达
- **AND** 提示词不再要求充电端口、连接步骤或充电时长

#### Scenario: 卖点总览使用多项真实内容

- **WHEN** 本图是卖点总览且分析提供多个不同的可靠买点
- **THEN** 分配覆盖适量的不同买点及对应事实
- **AND** 每个信息模块有明确内容，不用同一个尺寸事实填满多个卖点位置
