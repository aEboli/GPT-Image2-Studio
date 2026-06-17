import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { consumeSseStream } from "./shared-sse-parser.mjs";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const prompt =
  process.argv[2] ||
  "生成一张美女抖音直播带货的写实风图片，主播坐在直播桌前展示商品，竖版构图，灯光专业，适合电商宣传。";
const outputPath = resolve("output", "minimal-fetch.jpeg");

if (!apiKey) {
  throw new Error("缺少 OPENAI_API_KEY 环境变量");
}

const response = await fetch(`${baseUrl}/responses`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  },
  body: JSON.stringify({
    model: "gpt-5.4",
    input: prompt,
    stream: true,
    tool_choice: {
      type: "image_generation",
    },
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-2",
        size: "1024x1536",
        quality: "high",
        output_format: "jpeg",
        background: "opaque",
      },
    ],
  }),
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}\n${await response.text()}`);
}

if (!response.body) {
  throw new Error("接口没有返回流式响应体");
}

let finalBase64 = "";
let responseCompleted = false;

try {
  await consumeSseStream(response.body, {
    async onEvent({ eventName, payload }) {
      if (eventName === "response.image_generation_call.partial_image") {
        console.log("收到中间预览图事件");
        return;
      }

      if (
        eventName === "response.output_item.done" &&
        payload?.item?.type === "image_generation_call" &&
        typeof payload.item.result === "string"
      ) {
        finalBase64 = payload.item.result.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
        return;
      }

      if (eventName === "response.completed") {
        responseCompleted = true;
        console.log("响应完成");
      }
    },
  });
} catch (error) {
  const canUseFinalImage =
    finalBase64 &&
    (responseCompleted ||
      (error instanceof Error && /terminated|socket|aborted/i.test(error.message)));

  if (!canUseFinalImage) {
    throw error;
  }

  console.warn("流在收尾阶段被远端关闭，已使用已收到的最终结果");
}

if (!finalBase64) {
  throw new Error("没有从 response.output_item.done 中拿到最终图片");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(finalBase64, "base64"));
console.log(`图片已保存到: ${outputPath}`);
