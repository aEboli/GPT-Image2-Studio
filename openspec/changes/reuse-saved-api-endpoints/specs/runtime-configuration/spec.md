# runtime-configuration

## ADDED Requirements

### Requirement: 浏览器本地保留可复用的 API 清单并整套切换

系统 SHALL 在浏览器本地保留一份可复用的 API 清单，供配置区四个通道（路由模式、直连生图、直连文本/视觉、模型协议通道）共用。清单中的一条记录 SHALL 由接口地址、协议后缀和配套 API Key 组成。该清单 SHALL 只存放在浏览器本地存储中，SHALL NOT 写入服务端配置文件、环境变量、公开配置响应、生成请求载荷或日志。

条目身份 SHALL 由接口地址与 API Key 共同决定：同一地址与同一 Key SHALL 只占一条且协议后缀取最近一次保存的值；同一地址搭配不同 Key SHALL 各自保留。缺少接口地址或缺少 API Key 的组合 SHALL NOT 进入清单。最近保存或最近选用的条目 SHALL 排在最前，容量上限 SHALL 为 20 条，超出时 SHALL 丢弃最旧的条目。

每个通道的接口地址 SHALL 提供一个下拉选择控件列出清单条目；API Key 输入框 SHALL NOT 提供该控件。清单为空时 SHALL NOT 显示展开控件。条目 SHALL 显示接口地址与掩码形式的 Key，明文 Key SHALL NOT 出现在文档结构中。

选中一个条目 SHALL 把该通道的接口地址与配套 API Key 一并填入。当且仅当该通道的协议后缀控件提供该条目记录的后缀时，系统 SHALL 一并切换后缀；否则 SHALL 保留该通道当前的后缀。选中 SHALL NOT 修改模型，SHALL NOT 自行保存配置，且 SHALL 按当前完整 URL 显示开关重排地址显示。

每个条目 SHALL 可被单独删除。删除 SHALL 只从清单移除该条目，SHALL NOT 清除当前已填写或已保存的地址与 Key，也 SHALL NOT 影响其他条目的顺序。

Key 输入框留空表示沿用已保存 Key 的既有语义 SHALL 保持不变，保存后清空 Key 输入框并以掩码显示当前生效 Key 的既有行为 SHALL 保持不变。清单损坏、不可解析或本地存储不可用时，系统 SHALL 视为空清单，且 SHALL NOT 因此使配置读取或保存失败。

#### Scenario: 用户在两个 API 之间来回切换

- **WHEN** 用户先保存了地址 A 与其 Key，随后改用地址 B 与其 Key 并保存
- **THEN** 清单同时包含两条记录，且 B 排在 A 之前
- **AND** 用户从地址下拉里选中 A 后，接口地址与 Key 同时回到 A 的一套
- **AND** 保存后生成请求使用 A 的地址与 A 的 Key
- **AND** 清单里 A 排到最前，B 仍然保留

#### Scenario: 选中条目时后缀按通道兼容性处理

- **WHEN** 某条目记录的协议后缀是 `chat/completions`，用户在只提供 `responses` 的路由模式选中它
- **THEN** 接口地址与 Key 被填入
- **AND** 路由模式的后缀保持 `responses`
- **AND** 同一条目在提供 `chat/completions` 的通道被选中时，后缀一并切换为 `chat/completions`

#### Scenario: 同一供应商的两把 Key 各自成条

- **WHEN** 用户先后保存同一接口地址搭配两把不同的 API Key
- **THEN** 清单保留两条记录
- **AND** 两条记录在下拉中通过各自的 Key 掩码区分
- **AND** 只有地址与 Key 都与当前填写值一致的那条显示为选中态

#### Scenario: 四个通道共用同一份清单

- **WHEN** 用户在直连生图通道保存了一套地址与 Key，随后打开路由模式的地址下拉
- **THEN** 该条目出现在路由模式的下拉列表中
- **AND** 选中它只改动路由模式的地址、后缀与 Key
- **AND** 直连生图通道已保存的地址与 Key 不被改动

#### Scenario: 用户删除一条历史 API

- **WHEN** 用户点击某条目的删除按钮
- **THEN** 该条目从清单消失且不再出现在四个下拉中
- **AND** 当前已填写与已保存的地址与 Key 不受影响
- **AND** 已保存 Key 的掩码显示保持不变

#### Scenario: 清单不越过浏览器边界

- **WHEN** 浏览器本地清单已有多条记录
- **THEN** `/api/config` 响应、公开浏览器配置、生成请求的 FormData 与请求载荷都不包含该清单
- **AND** 服务端配置文件与环境变量不新增该清单字段

#### Scenario: 明文 Key 不进入文档结构

- **WHEN** 下拉列表渲染出清单条目
- **THEN** 每行显示接口地址与掩码形式的 Key
- **AND** 明文 Key 不作为文本内容或元素属性出现在文档结构中

#### Scenario: 本地清单损坏

- **WHEN** 浏览器本地清单的内容不是合法 JSON 或结构不符
- **THEN** 系统按空清单处理并隐藏展开控件
- **AND** 配置读取与保存照常完成
