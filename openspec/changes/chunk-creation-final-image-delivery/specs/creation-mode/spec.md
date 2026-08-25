## ADDED Requirements

### Requirement: Creation Mode streams final images in bounded chunks

套图生成、套图补图和套图 Logo 批量路由 SHALL 以分片方式下发每个条目的最终图，单个 SSE 事件携带的 base64 载荷 SHALL NOT 超过 48 KB。分片事件 SHALL 携带所属 `setId`、`itemId`、`index`、`total` 和 `mimeType`，使客户端能按条目独立装配。客户端 SHALL 在收齐某个条目的全部分片后拼成完整 data URL 并更新该条目的预览，且 SHALL NOT 因为分片乱序到达而丢弃已收到的分片。套图 SHALL NOT 在单个 SSE 事件中下发完整最终图数据。

#### Scenario: A creation item final image arrives in chunks

- **WHEN** 套图某个条目在上游生成成功并进入下发阶段
- **THEN** 服务端按不超过 48 KB 的分片下发该条目最终图
- **AND** 每个分片事件标明所属条目和分片序号、总数
- **AND** 客户端集齐全部分片后显示该条目的完整成图
- **AND** 单个 SSE 事件不携带完整最终图数据

#### Scenario: Chunks from concurrent items do not mix

- **WHEN** 多个套图条目并发完成并同时下发分片
- **THEN** 每个条目按自身 `setId` 与 `itemId` 独立装配
- **AND** 某个条目的分片不得并入另一个条目的图片数据
- **AND** 任一条目集齐分片即可显示，无需等待其他条目完成

#### Scenario: A partially received item does not display a broken image

- **WHEN** 某个条目只收到部分分片且流已结束
- **THEN** 该条目不展示由不完整数据拼成的图片
- **AND** 页面说明最终图未完整接收

### Requirement: Creation Mode reports interrupted streams instead of raw parse errors

套图流在连接中断且最后一个事件不完整时 SHALL 报告连接中断，SHALL NOT 把底层 JSON 解析错误原文作为用户可见错误。套图流 SHALL 在未收到 `complete` 或 `error` 终止事件时报告连接中断。完整事件本身格式非法时 SHALL 继续按解析失败处理，不得被中断提示掩盖。

#### Scenario: The connection drops mid-event

- **WHEN** 套图流在某个事件传输过程中断开
- **THEN** 页面提示生成连接已中断、最终图未完整接收
- **AND** 不展示 JSON 语法错误原文

#### Scenario: The stream ends without a terminal event

- **WHEN** 套图流正常结束但未收到 `complete` 或 `error` 事件
- **THEN** 页面提示套图生成连接已中断

#### Scenario: A complete but malformed event still surfaces a parse failure

- **WHEN** 套图流下发了一个完整但格式非法的事件
- **THEN** 该解析失败按原有错误路径抛出
- **AND** 不被连接中断提示替换
