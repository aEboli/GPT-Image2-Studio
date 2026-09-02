## MODIFIED Requirements

### Requirement: 工作台入口位于套图记录

套图记录中既有的工作台入口 SHALL 显示为 `temuexcel导出工作台`，并成为无需选择任何套图记录即可使用的工作台直达入口。该控件的元素标识与单一监听归属 SHALL 保持不变；其可用性 SHALL 继续受生成、刷新、删除和启动互斥等非选择安全条件控制，但 SHALL NOT 受套图记录是否已勾选控制。

点击入口 SHALL 在同一窗口的同源 iframe 覆盖层中打开工作台主界面。宿主 MUST NOT 将套图记录的 set ID、预选 ID 或等价数据作为启动参数传给子文档；`temu-workbench:init` 中的 `setIds` SHALL 是空数组。初始化消息可同步主题和语言，但空选择集合 MUST NOT 导致工作台自动打开“从 Studio 导入”对话框、自动读取套图记录或自动执行导入。

子文档 SHALL 在初始化消息的 `setIds` 为空时保持工作台主界面。工作台内的“从 Studio 导入”按钮 SHALL 保持可用，并且 SHALL 是打开 Studio 导入对话框的显式用户操作。

#### Scenario: 零勾选直达工作台主界面

- **GIVEN** 套图记录没有任何已勾选记录
- **WHEN** 用户点击 `temuexcel导出工作台`
- **THEN** 工作台在同一窗口覆盖层中打开
- **AND** 用户首先看到可编辑的工作台主界面
- **AND** Studio 导入对话框保持关闭

#### Scenario: 已勾选记录不被传给工作台

- **GIVEN** 套图记录存在一条或多条已勾选记录
- **WHEN** 用户点击 `temuexcel导出工作台`
- **THEN** 宿主向 iframe 启动调用和初始化消息传递空 `setIds`，而不是这些记录的 ID
- **AND** 工作台不自动预选记录、不自动加载导入列表、不自动打开 Studio 导入对话框

#### Scenario: 用户在工作台内主动选择 Studio 导入

- **GIVEN** 工作台主界面已经打开且 Studio 导入对话框处于关闭状态
- **WHEN** 用户点击工作台内的“从 Studio 导入”按钮
- **THEN** 工作台打开既有的 Studio 导入对话框
- **AND** 用户可按既有流程选择并确认要导入的记录
