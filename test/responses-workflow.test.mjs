import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSIENT_HTTP_RETRY_DELAY_MS,
  buildResponsesInput,
  consumeResponsesSse,
  createDirectImageRequestBody,
  createGeminiImageGenerationRequestBody,
  createResponsesRequestBody,
  createChatCompletionsImageRequestBody,
  formatStatusHeartbeatMessage,
  normalizeBaseUrl,
  requestDirectImageGeneration,
  requestImageGeneration,
  requestModelProtocolImageGeneration,
} from "../lib/responses-workflow.mjs";

test("buildResponsesInput returns structured content for prompt-only generation", () => {
  const input = buildResponsesInput({
    prompt: "鐢熸垚涓€寮犲浘",
  });

  assert.deepEqual(input, [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "鐢熸垚涓€寮犲浘",
        },
      ],
    },
  ]);
});

test("buildResponsesInput uses message content for prompt-only route A requests", () => {
  const input = buildResponsesInput({
    prompt: "Create a prompt-only image",
  });

  assert.deepEqual(input, [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Create a prompt-only image",
        },
      ],
    },
  ]);
});

test("status heartbeat messages label the 59 second upstream wait", () => {
  assert.equal(
    formatStatusHeartbeatMessage("waiting_upstream", 59000),
    "heartbeat（59 秒）：上游服务仍在处理，请保持页面打开",
  );
  assert.equal(
    formatStatusHeartbeatMessage("waiting_final", 59000),
    "heartbeat（59 秒）：仍在等待最终图，请保持页面打开",
  );
});

test("buildResponsesInput returns multimodal user message with multiple reference images", () => {
  const input = buildResponsesInput({
    prompt: "缁欒繖浜涘浘缁熶竴鎹㈡垚澶滄櫙姘涘洿",
    referenceImages: [
      {
        mimeType: "image/png",
        base64: "ZmFrZQ==",
        filename: "reference-a.png",
      },
      {
        mimeType: "image/jpeg",
        base64: "bW9yZQ==",
        filename: "reference-b.jpeg",
      },
    ],
  });

  assert.deepEqual(input, [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "缁欒繖浜涘浘缁熶竴鎹㈡垚澶滄櫙姘涘洿",
        },
        {
          type: "input_image",
          image_url: "data:image/png;base64,ZmFrZQ==",
        },
        {
          type: "input_image",
          image_url: "data:image/jpeg;base64,bW9yZQ==",
        },
      ],
    },
  ]);
});

test("buildResponsesInput can label reference images before each image", () => {
  const input = buildResponsesInput({
    prompt: "Transfer style from the second image to the first image.",
    referenceImageLabels: [
      "Reference image 1: SOURCE image. Preserve content only.",
      "Reference image 2: STYLE image. This is the style authority.",
    ],
    referenceImages: [
      {
        mimeType: "image/png",
        base64: "c291cmNl",
        filename: "source.png",
      },
      {
        mimeType: "image/jpeg",
        base64: "c3R5bGU=",
        filename: "style.jpeg",
      },
    ],
  });

  assert.deepEqual(input[0].content, [
    {
      type: "input_text",
      text: "Transfer style from the second image to the first image.",
    },
    {
      type: "input_text",
      text: "Reference image 1: SOURCE image. Preserve content only.",
    },
    {
      type: "input_image",
      image_url: "data:image/png;base64,c291cmNl",
    },
    {
      type: "input_text",
      text: "Reference image 2: STYLE image. This is the style authority.",
    },
    {
      type: "input_image",
      image_url: "data:image/jpeg;base64,c3R5bGU=",
    },
  ]);
});

test("createResponsesRequestBody keeps gpt-5.4 on the outer model and passes reasoning effort", () => {
  const requestBody = createResponsesRequestBody({
    prompt: "鐢熸垚涓€寮犲浘",
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
  });

  assert.equal(requestBody.model, "gpt-5.4");
  assert.equal(requestBody.reasoning.effort, "high");
  assert.equal(requestBody.stream, true);
  assert.deepEqual(requestBody.tool_choice, { type: "image_generation" });
  assert.equal(requestBody.tools[0].type, "image_generation");
  assert.equal("model" in requestBody.tools[0], false);
});

test("createResponsesRequestBody defaults to png output and leaves compression unset", () => {
  const requestBody = createResponsesRequestBody({
    prompt: "鐢熸垚涓€寮犲浘",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
  });

  assert.equal(requestBody.tools[0].output_format, "png");
  assert.equal("output_compression" in requestBody.tools[0], false);
});

test("createResponsesRequestBody can disable streaming for fallback requests", () => {
  const requestBody = createResponsesRequestBody({
    prompt: "鐢熸垚涓€寮犲浘",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    stream: false,
  });

  assert.equal(requestBody.stream, false);
});

test("createDirectImageRequestBody targets the image model without Responses routing fields", () => {
  const requestBody = createDirectImageRequestBody({
    prompt: "Create a direct image",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "vendor-image-pro",
  });

  assert.equal(requestBody.model, "vendor-image-pro");
  assert.equal(requestBody.prompt, "Create a direct image");
  assert.equal(requestBody.size, "1024x1024");
  assert.equal(requestBody.quality, "high");
  assert.equal(requestBody.response_format, "b64_json");
  assert.equal("stream" in requestBody, false);
  assert.equal("tools" in requestBody, false);
  assert.equal("tool_choice" in requestBody, false);
});

test("requestDirectImageGeneration posts once to image generations and emits the final image", async () => {
  const requests = [];
  const events = [];

  const result = await requestDirectImageGeneration({
    baseUrl: "https://route-b.example.test/v1",
    apiKey: "route-b-key",
    prompt: "Direct model image",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "vendor-image-pro",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "ZGlyZWN0LWZpbmFs" }],
        }),
        { status: 200 },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://route-b.example.test/v1/images/generations");
  assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(requests[0].body.model, "vendor-image-pro");
  assert.equal("stream" in requests[0].body, false);
  assert.equal("tools" in requests[0].body, false);
  assert.equal(result.finalImageBase64, "ZGlyZWN0LWZpbmFs");
  assert.deepEqual(events.at(-1), {
    type: "final_image",
    base64: "ZGlyZWN0LWZpbmFs",
  });
});

test("direct image generation uploads a single reference image with the image field for edits compatibility", async () => {
  const requests = [];
  await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create from one reference.",
    referenceImages: [
      { filename: "single-reference.png", mimeType: "image/png", base64: "c2luZ2xl" },
    ],
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    async fetchImpl(url, init) {
      requests.push({ url, body: init.body });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "c2luZ2xlLWZpbmFs" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests[0].url, "https://direct.example.test/v1/images/edits");
  assert.equal(requests[0].body.getAll("image").length, 1);
  assert.equal(requests[0].body.get("image").name, "single-reference.png");
  assert.equal(requests[0].body.getAll("image[]").length, 0);
});

test("direct image generation keeps OpenAI Image API request body even for Gemini model names", async () => {
  const requests = [];
  await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create a tiny studio product photo.",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gemini-3.1-flash-image-preview",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "ZGlyZWN0LWdlbWluaS1uYW1l" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests[0].url, "https://direct.example.test/v1/images/generations");
  assert.equal(requests[0].body.model, "gemini-3.1-flash-image-preview");
  assert.equal(requests[0].body.prompt, "Create a tiny studio product photo.");
  assert.equal(requests[0].body.response_format, "b64_json");
  assert.equal(requests[0].body.output_format, "png");
  assert.equal(requests[0].body.quality, "high");
  assert.equal(requests[0].body.n, 1);
  assert.equal("contents" in requests[0].body, false);
});

test("model protocol image generation posts Gemini image models to image generations", async () => {
  const requests = [];
  const result = await requestModelProtocolImageGeneration({
    baseUrl: "https://protocol.example.test/v1",
    apiKey: "protocol-key",
    prompt: "Use the product reference.",
    referenceImageLabels: ["Reference image 1: product body."],
    referenceImages: [
      { filename: "product.png", mimeType: "image/png", base64: "cHJvZHVjdA==" },
    ],
    size: "2K",
    aspectRatio: "3:4",
    quality: "high",
    format: "png",
    imageModel: "gemini-3.1-flash-image-preview",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "Z2VtaW5pLXJlZg==",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(
    requests[0].url,
    "https://protocol.example.test/v1/images/generations",
  );
  assert.equal(requests[0].body.model, "gemini-3.1-flash-image-preview");
  assert.deepEqual(requests[0].body.contents[0].parts, [
    { text: "Use the product reference." },
    { text: "Reference image 1: product body." },
    {
      inline_data: {
        mime_type: "image/png",
        data: "cHJvZHVjdA==",
      },
    },
  ]);
  assert.deepEqual(requests[0].body.generationConfig, {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: {
      aspectRatio: "3:4",
      imageSize: "2K",
    },
  });
  assert.equal("messages" in requests[0].body, false);
  assert.equal("response_format" in requests[0].body, false);
  assert.equal(result.finalImageBase64, "Z2VtaW5pLXJlZg==");
  assert.equal(result.imageRoute, "c");
  assert.equal(result.protocol, "model-image-generations");
});

test("model protocol image generation keeps chat completions fallback for non-Gemini models", async () => {
  const requests = [];
  const result = await requestModelProtocolImageGeneration({
    baseUrl: "https://protocol.example.test/v1",
    apiKey: "protocol-key",
    prompt: "Return an image URL.",
    size: "1K",
    quality: "high",
    format: "png",
    imageModel: "vendor-chat-image",
    async fetchImpl(url, init) {
      requests.push({ url, method: init?.method || "GET", body: init?.body ? JSON.parse(init.body) : null });
      if (url === "https://image.example.test/final.png") {
        return new Response(new TextEncoder().encode("image-url"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "https://image.example.test/final.png",
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests[0].url, "https://protocol.example.test/v1/chat/completions");
  assert.equal(requests[0].method, "POST");
  assert.deepEqual(Object.keys(requests[0].body).sort(), ["messages", "model"]);
  assert.equal(requests[0].body.model, "vendor-chat-image");
  assert.equal(requests[1].url, "https://image.example.test/final.png");
  assert.equal(requests[1].method, "GET");
  assert.equal(result.finalImageBase64, "aW1hZ2UtdXJs");
  assert.equal(result.imageRoute, "c");
  assert.equal(result.protocol, "model-chat-completions");
});

test("model protocol image generation explains image generation endpoint mismatches", async () => {
  await assert.rejects(
    () =>
      requestModelProtocolImageGeneration({
        baseUrl: "https://api.agicto.cn/v1",
        apiKey: "protocol-key",
        prompt: "Create a tiny studio product photo.",
        size: "4K",
        aspectRatio: "1:1",
        imageModel: "gemini-3.1-flash-image-preview",
        async fetchImpl() {
          return new Response("404 page not found", { status: 404 });
        },
      }),
        /\/images\/generations/,
  );
});

test("Gemini model protocol request body normalizes protocol image sizes", () => {
  assert.deepEqual(
    createGeminiImageGenerationRequestBody({
      prompt: "Create a wide image.",
      size: "4K",
      aspectRatio: "16:9",
      imageModel: "gemini-3.1-flash-image-preview",
    }).generationConfig.imageConfig,
    {
      aspectRatio: "16:9",
      imageSize: "4K",
    },
  );
  assert.equal(
    createGeminiImageGenerationRequestBody({
      prompt: "Create a wide image.",
      size: "4K",
      aspectRatio: "16:9",
      imageModel: "gemini-3.1-flash-image-preview",
    }).model,
    "gemini-3.1-flash-image-preview",
  );
});

test("direct image generation no longer switches request shape per selected image model", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({
        data: [{ b64_json: "c3dpdGNoLWZpbmFs" }],
      }),
      { status: 200 },
    );
  };

  await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create with Gemini.",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gemini-3.1-flash-image-preview",
    fetchImpl,
  });
  await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create with Image 2.",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    fetchImpl,
  });
  await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create with Gemini again.",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gemini-3.1-flash-image-preview",
    fetchImpl,
  });

  assert.deepEqual(requests.map((request) => request.url), [
    "https://direct.example.test/v1/images/generations",
    "https://direct.example.test/v1/images/generations",
    "https://direct.example.test/v1/images/generations",
  ]);
  assert.equal(requests[0].body.model, "gemini-3.1-flash-image-preview");
  assert.equal(requests[0].body.response_format, "b64_json");
  assert.equal(requests[1].body.model, "gpt-image-2");
  assert.equal(requests[1].body.response_format, "b64_json");
  assert.equal(requests[1].body.output_format, "png");
  assert.equal(requests[1].body.quality, "high");
  assert.equal(requests[2].body.model, "gemini-3.1-flash-image-preview");
  assert.equal(requests[2].body.response_format, "b64_json");
});

test("direct image generation surfaces JSON error payloads returned with HTTP 200", async () => {
  await assert.rejects(
    requestDirectImageGeneration({
      baseUrl: "https://direct.example.test/v1",
      endpointPath: "images/generations",
      apiKey: "route-b-key",
      prompt: "Create with unavailable Gemini.",
      size: "1024x1024",
      quality: "high",
      format: "png",
      imageModel: "gemini-3.1-flash-image-preview",
      async fetchImpl() {
        return new Response(
          JSON.stringify({
            error: {
              code: "invalid_request_error",
              message: "No available channel for model gemini-3.1-flash-image-preview.",
              type: "invalid_request_error",
            },
          }),
          { status: 200 },
        );
      },
    }),
    /No available channel for model gemini-3\.1-flash-image-preview/,
  );
});

test("direct image generation submits reference image requests to image edits", async () => {
  const requests = [];
  const result = await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create a campaign image from this reference.",
    referenceImageLabels: ["Reference image 1: product body.", "Reference image 2: package style."],
    referenceImages: [
      { filename: "product.png", mimeType: "image/png", base64: "cHJvZHVjdA==" },
      { filename: "package.jpg", mimeType: "image/jpeg", base64: "cGFja2FnZQ==" },
    ],
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    responsesModel: "vendor-vision-text",
    reasoningEffort: "high",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: init.body });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "cmVmZXJlbmNlLWZpbmFs" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://direct.example.test/v1/images/edits");
  assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(requests[0].init.headers["Content-Type"], undefined);
  assert.ok(requests[0].body instanceof FormData);
  assert.equal(requests[0].body.get("model"), "gpt-image-2");
  assert.match(requests[0].body.get("prompt"), /^Create a campaign image from this reference\./);
  assert.match(requests[0].body.get("prompt"), /Reference image 1: product body\./);
  assert.match(requests[0].body.get("prompt"), /Reference image 2: package style\./);
  assert.equal(requests[0].body.get("size"), "1024x1024");
  assert.equal(requests[0].body.get("quality"), "high");
  assert.equal(requests[0].body.get("output_format"), "png");
  const images = requests[0].body.getAll("image[]");
  assert.equal(images.length, 2);
  assert.equal(images[0].name, "product.png");
  assert.equal(images[1].name, "package.jpg");
  assert.equal(result.finalImageBase64, "cmVmZXJlbmNlLWZpbmFs");
  assert.equal(result.endpointPath, "images/edits");
});

test("chat completions image request body omits image generations response_format", () => {
  const requestBody = createChatCompletionsImageRequestBody({
    prompt: "Create a chat image",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "vendor-chat-image",
  });

  assert.equal(requestBody.model, "vendor-chat-image");
  assert.deepEqual(requestBody.messages, [{ role: "user", content: "Create a chat image" }]);
  assert.equal(requestBody.size, "1024x1024");
  assert.equal(requestBody.quality, "high");
  assert.equal(requestBody.output_format, "png");
  assert.equal("response_format" in requestBody, false);
});

test("chat completions image request body includes reference image labels and data URLs", () => {
  const requestBody = createChatCompletionsImageRequestBody({
    prompt: "Use the references to create a unified product image.",
    referenceImageLabels: [
      "Reference image 1: product body.",
      "Reference image 2: packaging style.",
    ],
    referenceImages: [
      { mimeType: "image/png", base64: "cHJvZHVjdA==" },
      { mimeType: "image/jpeg", base64: "cGFja2FnZQ==" },
    ],
    size: "1024x1024",
    quality: "high",
    format: "jpeg",
    imageModel: "vendor-chat-image",
  });

  assert.deepEqual(requestBody.messages, [
    {
      role: "user",
      content: [
        { type: "text", text: "Use the references to create a unified product image." },
        { type: "text", text: "Reference image 1: product body." },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,cHJvZHVjdA==" },
        },
        { type: "text", text: "Reference image 2: packaging style." },
        {
          type: "image_url",
          image_url: { url: "data:image/jpeg;base64,cGFja2FnZQ==" },
        },
      ],
    },
  ]);
});

test("direct image generation can target chat completions and read image data from the message", async () => {
  const requests = [];
  const result = await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "chat/completions",
    apiKey: "route-b-key",
    prompt: "Direct chat image",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "vendor-chat-image",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "data:image/png;base64,Y2hhdC1pbWFnZQ==",
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://direct.example.test/v1/chat/completions");
  assert.equal(requests[0].body.model, "vendor-chat-image");
  assert.equal("response_format" in requests[0].body, false);
  assert.equal(result.finalImageBase64, "Y2hhdC1pbWFnZQ==");
});

test("direct image generation can target responses with the direct text and vision model", async () => {
  const requests = [];
  const result = await requestDirectImageGeneration({
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "responses",
    apiKey: "route-b-key",
    prompt: "Direct responses image",
    referenceImageLabels: ["Reference image 1: product body."],
    referenceImages: [{ mimeType: "image/png", base64: "cHJvZHVjdA==" }],
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "vendor-image-pro",
    responsesModel: "vendor-vision-text",
    reasoningEffort: "xhigh",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "ZGlyZWN0LXJlc3BvbnNlcw==" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://direct.example.test/v1/responses");
  assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(requests[0].body.model, "vendor-vision-text");
  assert.equal(requests[0].body.reasoning.effort, "xhigh");
  assert.equal(requests[0].body.stream, false);
  assert.deepEqual(requests[0].body.tool_choice, { type: "image_generation" });
  assert.equal(requests[0].body.tools[0].type, "image_generation");
  assert.equal("response_format" in requests[0].body, false);
  assert.deepEqual(
    requests[0].body.input[0].content.map((item) => item.type),
    ["input_text", "input_text", "input_image"],
  );
  assert.equal(result.finalImageBase64, "ZGlyZWN0LXJlc3BvbnNlcw==");
  assert.equal(result.responsesModel, "vendor-vision-text");
  assert.equal(result.endpointPath, "responses");
});

test("route A chat completions image generation forwards reference images", async () => {
  const requests = [];
  const result = await requestImageGeneration({
    baseUrl: "https://route-a.example.test/v1",
    endpointPath: "chat/completions",
    apiKey: "route-a-key",
    prompt: "Create a campaign image from these references.",
    referenceImageLabels: ["Reference image 1: hero product."],
    referenceImages: [
      { mimeType: "image/png", base64: "aGVyby1wcm9kdWN0" },
    ],
    size: "1024x1024",
    quality: "high",
    format: "png",
    responsesModel: "vendor-chat-image",
    async fetchImpl(url, init) {
      requests.push({ url, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "data:image/png;base64,cm91dGUtYS1jaGF0",
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://route-a.example.test/v1/chat/completions");
  assert.deepEqual(requests[0].body.messages[0].content, [
    { type: "text", text: "Create a campaign image from these references." },
    { type: "text", text: "Reference image 1: hero product." },
    {
      type: "image_url",
      image_url: { url: "data:image/png;base64,aGVyby1wcm9kdWN0" },
    },
  ]);
  assert.equal(result.finalImageBase64, "cm91dGUtYS1jaGF0");
});

test("normalizeBaseUrl appends v1 only for bare API hosts", () => {
  assert.equal(normalizeBaseUrl("https://example.test"), "https://example.test/v1");
  assert.equal(normalizeBaseUrl("https://example.test/openai/"), "https://example.test/openai");
  assert.equal(normalizeBaseUrl("https://example.test/openai/v1/"), "https://example.test/openai/v1");
});

test("consumeResponsesSse emits partial and final events, and tolerates terminated stream after success", async () => {
  const chunks = [
    [
      "event: response.image_generation_call.partial_image",
      'data: {"partial_image_b64":"cGFydGlhbA=="}',
      "",
      "",
      "event: response.output_item.done",
      'data: {"item":{"type":"image_generation_call","result":"ZmluYWw="}}',
      "",
      "",
      "event: response.completed",
      'data: {"response":{"output":[{"type":"image_generation_call","result":"ZmluYWw="}]}}',
      "",
      "",
    ].join("\n"),
  ];

  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            throw new TypeError("terminated");
          }

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  const seenEvents = [];
  const result = await consumeResponsesSse(fakeStream, {
    onEvent(event) {
      seenEvents.push(event.type);
    },
  });

  assert.deepEqual(seenEvents, ["partial_image", "final_image", "complete"]);
  assert.equal(result.finalImageBase64, "ZmluYWw=");
  assert.equal(result.partialImages.length, 1);
});

test("consumeResponsesSse extracts image_generation.completed b64_json final images", async () => {
  const chunks = [
    [
      "event: image_generation.completed",
      'data: {"type":"image_generation.completed","b64_json":"ZmluYWwtaW1hZ2U="}',
      "",
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n"),
  ];
  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  const seenEvents = [];
  const result = await consumeResponsesSse(fakeStream, {
    onEvent(event) {
      seenEvents.push(event.type);
    },
  });

  assert.deepEqual(seenEvents, ["final_image", "complete"]);
  assert.equal(result.finalImageBase64, "ZmluYWwtaW1hZ2U=");
});

test("consumeResponsesSse processes final image events left in the EOF buffer", async () => {
  const chunks = [
    [
      "event: response.output_item.done",
      'data: {"item":{"type":"image_generation_call","result":"ZW9mLWZpbmFs"}}',
    ].join("\n"),
  ];
  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  const result = await consumeResponsesSse(fakeStream);

  assert.equal(result.finalImageBase64, "ZW9mLWZpbmFs");
});

test("consumeResponsesSse surfaces response.failed messages instead of returning empty images", async () => {
  const chunks = [
    [
      "event: response.failed",
      'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"Too many image requests"}}}',
      "",
      "",
    ].join("\n"),
  ];
  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  await assert.rejects(() => consumeResponsesSse(fakeStream), {
    message: "上游生成失败：rate_limit_exceeded Too many image requests",
  });
});

test("consumeResponsesSse surfaces generic upstream error events instead of falling back to missing final image", async () => {
  const chunks = [
    [
      "event: error",
      'data: {"error":{"code":"upstream_error","message":"Upstream request failed"}}',
      "",
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n"),
  ];
  let index = 0;
  const fakeStream = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) {
            return { done: true };
          }

          const chunk = chunks[index];
          index += 1;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      };
    },
  };

  await assert.rejects(() => consumeResponsesSse(fakeStream), {
    message: "上游生成失败：upstream_error Upstream request failed",
  });
});

test("requestImageGeneration falls back to non-streaming when SSE completes without final image", async () => {
  const requests = [];
  const chunks = [
    [
      "event: response.image_generation_call.completed",
      'data: {"type":"response.image_generation_call.completed","item_id":"ig_1","output_index":0}',
      "",
      "",
      "event: response.completed",
      'data: {"type":"response.completed","response":{"output":[]}}',
      "",
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n"),
  ];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "鐢熸垚涓€寮犲浘",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (requests.length === 1) {
        return new Response(chunks.join(""), {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        });
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "ZmFsbGJhY2stZmluYWw=" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].stream, true);
  assert.equal(requests[1].stream, false);
  assert.equal(result.finalImageBase64, "ZmFsbGJhY2stZmluYWw=");
  assert.equal(result.fallbackUsed, true);
});

test("requestImageGeneration retries prompt-only generation when an attempt has no final image", async () => {
  const requests = [];
  const events = [];
  const noFinalStream = [
    "event: response.completed",
    'data: {"type":"response.completed","response":{"output":[]}}',
    "",
    "data: [DONE]",
    "",
    "",
  ].join("\n");

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a resilient prompt image",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      requests.push({ url, stream: body.stream, input: body.input });

      if (requests.length === 1) {
        return new Response(noFinalStream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }

      if (requests.length === 2) {
        return new Response(JSON.stringify({ output: [] }), { status: 200 });
      }

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"cHJvbXB0LXJldHJ5LWZpbmFs"}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests.map((request) => request.stream), [true, false, true]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://example.test/v1/responses",
      "https://example.test/v1/responses",
      "https://example.test/v1/responses",
    ],
  );
  assert.deepEqual(requests[0].input, [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Create a resilient prompt image",
        },
      ],
    },
  ]);
  assert.deepEqual(requests[2].input, requests[0].input);
  assert.equal(result.finalImageBase64, "cHJvbXB0LXJldHJ5LWZpbmFs");
  assert.equal(
    events.filter((event) => event.type === "status" && event.stage === "retrying_upstream").length,
    1,
  );
});

test("requestImageGeneration retries reference-image generation with labels after a missing final image", async () => {
  const requests = [];
  const noFinalStream = [
    "event: response.completed",
    'data: {"type":"response.completed","response":{"output":[]}}',
    "",
    "data: [DONE]",
    "",
    "",
  ].join("\n");

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Quick blend A and B into one sorted layout",
    referenceImages: [
      { filename: "a.png", mimeType: "image/png", base64: "YQ==" },
      { filename: "b.png", mimeType: "image/png", base64: "Yg==" },
    ],
    referenceImageLabels: [
      "Reference image A: product group A.",
      "Reference image B: product group B.",
    ],
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push({ stream: body.stream, input: body.input });

      if (requests.length === 1) {
        return new Response(noFinalStream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }

      if (requests.length === 2) {
        return new Response(JSON.stringify({ output: [] }), { status: 200 });
      }

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"cXVpY2stYmxlbmQtcmV0cnk="}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
  });

  assert.deepEqual(requests.map((request) => request.stream), [true, false, true]);
  assert.deepEqual(
    requests[2].input[0].content.map((item) => item.type),
    ["input_text", "input_text", "input_image", "input_text", "input_image"],
  );
  assert.equal(requests[2].input[0].content[1].text, "Reference image A: product group A.");
  assert.equal(requests[2].input[0].content[3].text, "Reference image B: product group B.");
  assert.equal(result.finalImageBase64, "cXVpY2stYmxlbmQtcmV0cnk=");
});

test("requestImageGeneration falls back to non-streaming when streaming is blocked upstream", async () => {
  const requests = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a poster image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "stream_forbidden",
              message: "Streaming requests are forbidden from this edge.",
            },
          }),
          { status: 403 },
        );
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "bm9uc3RyZWFtLWZpbmFs" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].stream, true);
  assert.equal(requests[1].stream, false);
  assert.equal(result.finalImageBase64, "bm9uc3RyZWFtLWZpbmFs");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.streamFallbackUsed, true);
});

test("requestImageGeneration falls back to non-streaming after transient 503 stream failures", async () => {
  const requests = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a Vercel routed image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (body.stream) {
        return new Response(
          JSON.stringify({
            error: {
              code: "service_unavailable",
              message: "Streaming route is temporarily unavailable.",
            },
          }),
          { status: 503 },
        );
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "dmVyY2VsLWZhbGxiYWNr" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.deepEqual(
    requests.map((request) => request.stream),
    [true, true, true, false],
  );
  assert.equal(result.finalImageBase64, "dmVyY2VsLWZhbGxiYWNr");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.streamFallbackUsed, true);
});

test("requestImageGeneration emits keepalive status while waiting for upstream headers", async () => {
  const events = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a slow image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    statusHeartbeatMs: 1,
    async fetchImpl() {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"a2VlcGFsaXZlLWZpbmFs"}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(result.finalImageBase64, "a2VlcGFsaXZlLWZpbmFs");
  assert.ok(
    events.some((event) => event.type === "status" && event.stage === "waiting_upstream"),
    "expected a waiting_upstream keepalive status event",
  );
});

test("requestImageGeneration emits keepalive status while waiting for final stream events", async () => {
  const events = [];
  const encoder = new TextEncoder();

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a slow streamed image",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    statusHeartbeatMs: 1,
    async fetchImpl() {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                [
                  "event: response.image_generation_call.partial_image",
                  'data: {"partial_image_b64":"cGFydGlhbC1zdHJlYW0="}',
                  "",
                  "",
                ].join("\n"),
              ),
            );
            setTimeout(() => {
              controller.enqueue(
                encoder.encode(
                  [
                    "event: response.output_item.done",
                    'data: {"item":{"type":"image_generation_call","result":"ZmluYWwtc3RyZWFt"}}',
                    "",
                    "data: [DONE]",
                    "",
                    "",
                  ].join("\n"),
                ),
              );
              controller.close();
            }, 5);
          },
        }),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(result.finalImageBase64, "ZmluYWwtc3RyZWFt");
  assert.ok(
    events.some((event) => event.type === "status" && event.stage === "waiting_final"),
    "expected a waiting_final keepalive status event",
  );
});

test("requestImageGeneration retries without streaming when the stream ends after a partial preview", async () => {
  const events = [];
  const requests = [];
  const encoder = new TextEncoder();

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a streamed image that may disconnect",
    size: "1024x1536",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body);

      if (requests.length === 1) {
        return new Response(
          new ReadableStream({
            pull(controller) {
              if (this.sentPartial) {
                controller.error(new Error("socket terminated"));
                return;
              }

              this.sentPartial = true;
              controller.enqueue(
                encoder.encode(
                  [
                    "event: response.image_generation_call.partial_image",
                    'data: {"partial_image_b64":"cGFydGlhbC1iZWZvcmUtZXJyb3I="}',
                    "",
                    "",
                  ].join("\n"),
                ),
              );
            },
          }),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          output: [{ type: "image_generation_call", result: "bm9uc3RyZWFtLWFmdGVyLWVycm9y" }],
        }),
        { status: 200 },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests.map((request) => request.stream), [true, false]);
  assert.equal(result.finalImageBase64, "bm9uc3RyZWFtLWFmdGVyLWVycm9y");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.streamFallbackUsed, true);
  assert.ok(events.some((event) => event.type === "partial_image"));
});

test("requestImageGeneration returns compact upstream HTTP errors", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      requestImageGeneration({
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        prompt: "生成一张图",
        size: "1024x1536",
        quality: "high",
        responsesModel: "gpt-5.4",
        transientHttpRetryDelayMs: 0,
        async fetchImpl() {
          attempts += 1;
          return new Response(
            JSON.stringify({
              type: "https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/",
              detail: "The origin web server did not respond within the timeout window.",
              error_code: 524,
            }),
            { status: 524 },
          );
        },
      }),
    {
      message: "生成请求失败：HTTP 524，错误码 524",
    },
  );
  assert.equal(attempts, 3);
});

test("requestImageGeneration retries transient upstream HTTP errors before surfacing", async () => {
  const requests = [];
  const events = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a small red icon.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push({ stream: body.stream, size: body.tools[0].size });

      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            error_code: 502,
          }),
          { status: 502 },
        );
      }

      if (requests.length === 2) {
        return new Response(
          JSON.stringify({
            error_code: 524,
          }),
          { status: 524 },
        );
      }

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"cmV0cmllZA=="}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests, [
    { stream: true, size: "1024x1024" },
    { stream: true, size: "1024x1024" },
    { stream: true, size: "1024x1024" },
  ]);
  assert.equal(result.finalImageBase64, "cmV0cmllZA==");
  assert.deepEqual(
    events
      .filter((event) => event.type === "status" && event.stage === "retrying_upstream")
      .map((event) => event.message),
    [
      "上游服务短暂异常（HTTP 502），正在重试 1/2",
      "上游服务短暂异常（HTTP 524），正在重试 2/2",
    ],
  );
});

test("requestImageGeneration retries upstream failed events with error codes", async () => {
  const requests = [];
  const events = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a small red icon.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push({ stream: body.stream, size: body.tools[0].size });

      if (requests.length < 3) {
        return new Response(
          [
            "event: response.failed",
            'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"Too many image requests"}}}',
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      }

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"cmV0cmllZC1hZnRlci1mYWlsZWQ="}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests, [
    { stream: true, size: "1024x1024" },
    { stream: true, size: "1024x1024" },
    { stream: true, size: "1024x1024" },
  ]);
  assert.equal(result.finalImageBase64, "cmV0cmllZC1hZnRlci1mYWlsZWQ=");
  assert.equal(
    events.filter((event) => event.type === "status" && event.stage === "retrying_upstream").length,
    2,
  );
});

test("requestImageGeneration default retry delay is five seconds", () => {
  assert.equal(DEFAULT_TRANSIENT_HTTP_RETRY_DELAY_MS, 5000);
});

test("requestImageGeneration retries invalid custom image sizes with a compatible size", async () => {
  const requests = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create an image of the major event poster",
    size: "1536x864",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body.tools[0].size);

      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            error: {
              message: "Invalid value: '1536x864'. Supported values are: '1024x1024', '1536x1024', '1024x1536', and 'auto'.",
              code: "invalid_value",
              param: "tools[0].size",
            },
          }),
          { status: 400 },
        );
      }

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"ZmFsbGJhY2s="}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
  });

  assert.deepEqual(requests, ["1536x864", "1536x1024"]);
  assert.equal(result.finalImageBase64, "ZmFsbGJhY2s=");
  assert.equal(result.sizeFallbackUsed, true);
  assert.equal(result.effectiveSize, "1536x1024");
});
