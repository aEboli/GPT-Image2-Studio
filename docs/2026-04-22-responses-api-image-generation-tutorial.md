# 2026-04-22 实测：图片生成优先走 `POST /responses`

这篇是可直接发帖的教程版结论，基于 2026-04-22 的一次真实跑通结果整理。

## 一句话结论

如果你在 OpenAI 或兼容端点上做图片生成，不要默认先试：

```text
POST /v1/images/generations
```

更稳的方式是优先试：

```text
POST https://api.openai.com/v1/responses
```

然后在 `tools` 里启用 `image_generation`，并显式指定：

```json
{
  "type": "image_generation",
  "model": "gpt-image-2"
}
```

## 这次实测确认了什么

2026-04-22 我对下面这条链路做了真实请求验证：

- 根路径：`https://api.openai.com/v1`，兼容代理请替换为自己的本机私有配置
- 接口：`POST /responses`
- 外层模型：`gpt-5.4`
- 图片工具模型：`gpt-image-2`
- 流式：`stream: true`

结论是：

1. 这条路径可以成功出图。
2. SSE 里确实会出现 `response.output_item.done`。
3. 当 `payload.item.type === "image_generation_call"` 且 `payload.item.result` 存在时，`item.result` 就是最终图片 base64。
4. `response.completed` 里通常也能拿到图片结果，但更适合作为兜底，不建议把它当唯一抓图点。
5. 代理链路偶发会在最终结果到达后直接断开流，所以代码里最好加一层“已拿到最终图则容忍收尾断流”的保护。

## 推荐请求体

```json
{
  "model": "gpt-5.4",
  "input": "生成一张美女抖音直播带货的写实风图片，主播坐在直播桌前展示商品，竖版构图，灯光专业，适合电商宣传。",
  "stream": true,
  "tool_choice": {
    "type": "image_generation"
  },
  "tools": [
    {
      "type": "image_generation",
      "model": "gpt-image-2",
      "size": "1024x1536",
      "quality": "high",
      "output_format": "jpeg",
      "background": "opaque"
    }
  ]
}
```

这里有 4 个关键点：

1. 顶层 `model` 仍然是 Responses 的外层模型，不是图片模型。
2. 图片模型通过 `tools[].model = "gpt-image-2"` 指定。
3. `tool_choice` 最好直接锁成 `image_generation`，减少模型先回文本的概率。
4. 一定带上 `stream: true`，这样你才能从 SSE 里抓过程事件和最终图片。

## 纯 `fetch` 最小示例

本地可直接运行的最小版在：

- [examples/minimal-fetch.mjs](../examples/minimal-fetch.mjs)

使用方法：

```powershell
$env:OPENAI_API_KEY="你的 key"
node .\examples\minimal-fetch.mjs
```

它的核心逻辑就是：

```js
const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream"
  },
  body: JSON.stringify({
    model: "gpt-5.4",
    input: prompt,
    stream: true,
    tool_choice: { type: "image_generation" },
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-2",
        size: "1024x1536",
        quality: "high",
        output_format: "jpeg",
        background: "opaque"
      }
    ]
  })
});
```

## `curl` 版请求体

如果你只是想快速看 SSE 事件流，而不是立刻落盘图片，可以直接用：

```powershell
curl.exe -N ^
  -X POST "https://api.openai.com/v1/responses" ^
  -H "Authorization: Bearer %OPENAI_API_KEY%" ^
  -H "Content-Type: application/json" ^
  -H "Accept: text/event-stream" ^
  --data "@examples/request-body.json"
```

说明：

- `-N` 用来关闭缓冲，便于实时看流
- `examples/request-body.json` 已经放在项目里，可以直接改提示词
- 这条命令更适合观察事件，不适合直接把最终 base64 解析成图片文件

如果你在 PowerShell 里执行，推荐改成：

```powershell
curl.exe -N `
  -X POST "https://api.openai.com/v1/responses" `
  -H "Authorization: Bearer $env:OPENAI_API_KEY" `
  -H "Content-Type: application/json" `
  -H "Accept: text/event-stream" `
  --data "@examples/request-body.json"
```

## 前端 / Node 通用的 SSE 解析范式

我把可复用的解析器单独拆到了：

- [examples/shared-sse-parser.mjs](../examples/shared-sse-parser.mjs)

设计思路很简单：

1. 用 `ReadableStream.getReader()` 读取字节流。
2. 用 `TextDecoder` 累积文本。
3. 按空行切分一个个 SSE 事件块。
4. 解析 `event:` 和 `data:`。
5. 命中 `response.output_item.done` 后判断：

```js
payload?.item?.type === "image_generation_call"
```

如果同时有：

```js
typeof payload.item.result === "string"
```

那就直接取：

```js
payload.item.result
```

## 推荐监听的事件

最少关注下面 3 类：

- `response.image_generation_call.partial_image`
- `response.output_item.done`
- `response.completed`

建议这样分工：

- `partial_image`：只拿来做进度提示或中间预览
- `output_item.done`：作为主抓图点
- `completed`：作为兜底，防止代理兼容层和官方结构有轻微差异

如果你接的是第三方代理，再多补一层容错更稳：

- 当 `output_item.done` 已经拿到最终 `image_generation_call.result` 后，即使流在收尾阶段被远端提前断开，也可以继续保存图片，不必整次判失败

## 为什么不建议只盯 `response.completed`

因为 `response.completed` 更像整个响应生命周期结束信号，而不是“图像工具最终结果的最直接事件”。

从结构上看，真正和某个 output item 一一对应的是 `response.output_item.done`。你要抓图片，本质上是在等一个 `image_generation_call` output item 完成，所以用它做主抓点更稳。

## 代理兼容层要注意什么

这个结论分两层看：

1. OpenAI 官方已经支持在 Responses API 里通过图像工具生成图片。
2. 第三方兼容代理具体支持哪些前缀、是否有旧版 schema 校验、是否对模型名做兼容转换，取决于它自己的实现。

所以你写教程时，建议把表述写成：

> 在兼容端点的当前实测下，优先使用 `POST /v1/responses + tools.image_generation`，而不是默认尝试 `/v1/images/generations`。

这样更准确，不会把代理的实现细节误写成 OpenAI 官方的强制规则。

## 一段适合直接发帖的总结

可以直接发这段：

> 实测兼容端点做图片生成时，不要优先试传统的 `POST /v1/images/generations`。
> 更稳的方式是走 `POST /v1/responses`，外层模型继续用 `gpt-5.4`，在 `tools` 里启用 `image_generation` 并显式指定 `model: "gpt-image-2"`，同时开启 `stream: true`。
> 流式事件里，最终图片建议从 `response.output_item.done` 抓：当 `item.type === "image_generation_call"` 且 `item.result` 存在时，`item.result` 就是最终图片 base64。
> `response.completed` 可以作为兜底，但不建议作为唯一抓图点。

## 项目内对应文件

- 主示例脚本：
  [generate-image.mjs](../generate-image.mjs)
- 最小 `fetch` 示例：
  [examples/minimal-fetch.mjs](../examples/minimal-fetch.mjs)
- 通用 SSE 解析器：
  [examples/shared-sse-parser.mjs](../examples/shared-sse-parser.mjs)
- `curl` 请求体：
  [examples/request-body.json](../examples/request-body.json)

## 参考

- [OpenAI Image Generation Tool Guide](https://developers.openai.com/api/docs/guides/tools-image-generation)
- [OpenAI Streaming Responses Guide](https://developers.openai.com/api/docs/guides/streaming-responses)
- [OpenAI Responses API Reference](https://developers.openai.com/api/reference/resources/responses/methods/create)
