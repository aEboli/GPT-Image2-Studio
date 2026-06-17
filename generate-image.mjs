import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import { normalizeApiBaseUrl } from "./lib/api-base-url.mjs";
import { DEFAULT_BASE_URL } from "./lib/studio-constants.mjs";

const DEFAULT_PROMPT =
  "生成一张美女抖音直播带货的写实风商业摄影图片，竖版构图，直播间灯光明亮，主播坐在桌前展示商品，画面精致自然，符合电商直播宣传海报质感。";

function printHelp() {
  console.log(`用法:
  npm run generate -- --prompt "生成一张美女抖音直播带货的图片"

可选参数:
  --prompt      图片提示词
  --size        图片尺寸，默认 1024x1536
  --quality     图片质量，默认 high
  --format      输出格式，默认 jpeg
  --output      输出文件路径，默认写入 output/<timestamp>.<ext>
  --base-url    接口根路径，默认读取 OPENAI_BASE_URL 或 ${DEFAULT_BASE_URL}
  --model       外层 Responses 模型，默认读取 RESPONSES_MODEL 或 gpt-5.4

环境变量:
  OPENAI_API_KEY
  OPENAI_BASE_URL
  RESPONSES_MODEL`);
}

function parseArgs(argv) {
  const options = {
    prompt: DEFAULT_PROMPT,
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    output: "",
    baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.RESPONSES_MODEL || "gpt-5.4",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--help" || current === "-h") {
      options.help = true;
      continue;
    }

    if (current === "--prompt" && next) {
      options.prompt = next;
      index += 1;
      continue;
    }

    if (current === "--size" && next) {
      options.size = next;
      index += 1;
      continue;
    }

    if (current === "--quality" && next) {
      options.quality = next;
      index += 1;
      continue;
    }

    if (current === "--format" && next) {
      options.format = next;
      index += 1;
      continue;
    }

    if (current === "--output" && next) {
      options.output = next;
      index += 1;
      continue;
    }

    if (current === "--base-url" && next) {
      options.baseUrl = next;
      index += 1;
      continue;
    }

    if (current === "--model" && next) {
      options.model = next;
      index += 1;
      continue;
    }

    if (!current.startsWith("--")) {
      options.prompt = current;
    }
  }

  return options;
}

function normalizeBaseUrl(baseUrl) {
  return normalizeApiBaseUrl(baseUrl);
}

function normalizeBase64(value) {
  return value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
}

function buildOutputPath(outputPath, format) {
  if (outputPath) {
    return resolve(outputPath);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve("output", `generated-${timestamp}.${format}`);
}

function parseEventChunk(chunk) {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventName = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  const data = dataLines.join("\n");
  return { eventName, data };
}

function extractImageBase64(eventName, payload) {
  if (
    eventName === "response.output_item.done" &&
    payload?.item?.type === "image_generation_call" &&
    typeof payload.item.result === "string" &&
    payload.item.result.length > 0
  ) {
    return payload.item.result;
  }

  if (
    payload?.type === "image_generation_call" &&
    typeof payload.result === "string" &&
    payload.result.length > 0
  ) {
    return payload.result;
  }

  if (eventName === "response.completed" && Array.isArray(payload?.response?.output)) {
    const imageItem = payload.response.output.find(
      (item) => item?.type === "image_generation_call" && typeof item.result === "string",
    );

    if (imageItem?.result) {
      return imageItem.result;
    }
  }

  return null;
}

async function consumeSse(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let imageBase64 = null;
  let partialImages = 0;
  const events = [];
  let responseCompleted = false;

  while (true) {
    let readResult;
    try {
      readResult = await reader.read();
    } catch (error) {
      const isAbortedAfterSuccess =
        (imageBase64 || responseCompleted) &&
        error instanceof Error &&
        /terminated|socket|aborted/i.test(error.message);

      if (isAbortedAfterSuccess) {
        console.warn("流在收尾阶段被远端关闭，已使用已收到的最终结果");
        return { imageBase64, partialImages, events };
      }

      throw error;
    }

    const { done, value } = readResult;
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const { eventName, data } = parseEventChunk(chunk);
      if (!data) {
        continue;
      }

      if (data === "[DONE]") {
        return { imageBase64, partialImages, events };
      }

      let payload;
      try {
        payload = JSON.parse(data);
      } catch (error) {
        events.push({
          eventName: eventName || "unknown",
          kind: "invalid-json",
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const resolvedEventName = eventName || payload?.type || "unknown";
      events.push({ eventName: resolvedEventName });

      if (resolvedEventName === "response.image_generation_call.partial_image") {
        partialImages += 1;
        console.log(`收到第 ${partialImages} 张中间预览图`);
      }

      const result = extractImageBase64(resolvedEventName, payload);
      if (result) {
        imageBase64 = result;
      }

      if (resolvedEventName === "response.completed") {
        responseCompleted = true;
        console.log("流式响应结束");
      }
    }
  }

  return { imageBase64, partialImages, events };
}

function buildRequestBody(options) {
  return {
    model: options.model,
    input: options.prompt,
    stream: true,
    tool_choice: {
      type: "image_generation",
    },
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-2",
        size: options.size,
        quality: options.quality,
        output_format: options.format,
        background: "opaque",
      },
    ],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY 环境变量");
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const requestBody = buildRequestBody(options);

  console.log(`请求地址: ${baseUrl}/responses`);
  console.log(`外层模型: ${options.model}`);
  console.log("图片工具模型: gpt-image-2");
  console.log(`提示词: ${options.prompt}`);

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`接口请求失败: HTTP ${response.status}\n${errorText}`);
  }

  if (!response.body) {
    throw new Error("接口没有返回可读取的流");
  }

  const { imageBase64, partialImages, events } = await consumeSse(response.body);
  if (!imageBase64) {
    const received = events.map((event) => event.eventName).join(", ");
    throw new Error(`未在 SSE 事件中拿到最终图片数据。已收到事件: ${received}`);
  }

  const finalBase64 = normalizeBase64(imageBase64);
  const outputPath = buildOutputPath(options.output, options.format);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(finalBase64, "base64"));

  console.log(`已保存图片: ${outputPath}`);
  console.log(`文件名: ${basename(outputPath)}`);
  console.log(`格式: ${extname(outputPath).slice(1)}`);
  console.log(`中间预览图数量: ${partialImages}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
