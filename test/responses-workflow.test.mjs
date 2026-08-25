import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponsesInput,
  consumeResponsesSse,
  createDirectImageRequestBody,
  createGeminiImageGenerationRequestBody,
  createResponsesRequestBody,
  createChatCompletionsImageRequestBody,
  formatStatusHeartbeatMessage,
  recoverOriginalResponse,
  normalizeBaseUrl,
  requestDirectImageGeneration,
  requestImageEdit,
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

test("createResponsesRequestBody can build a non-streaming Responses request", () => {
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

test("direct image generation forwards an AbortSignal to the request and image URL fetch", async () => {
  const controller = new AbortController();
  const requests = [];

  const result = await requestDirectImageGeneration({
    baseUrl: "https://route-b.example.test/v1",
    apiKey: "route-b-key",
    prompt: "Return a remotely hosted image.",
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "vendor-image-pro",
    signal: controller.signal,
    async fetchImpl(url, init) {
      requests.push({ url, init });
      if (init.method === "GET") {
        return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [{ url: "https://cdn.example.test/image.png" }] }), { status: 200 });
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.signal, controller.signal);
  assert.equal(requests[1].init.signal, controller.signal);
  assert.equal(result.finalImageBase64, "iVBORw==");
});

test("direct image generation aborts a hanging upstream request when timeoutMs is set", async () => {
  let requestSignal;

  await assert.rejects(
    requestDirectImageGeneration({
      baseUrl: "https://route-b.example.test/v1",
      apiKey: "route-b-key",
      prompt: "Hang until timeout.",
      size: "1024x1024",
      quality: "high",
      imageModel: "vendor-image-pro",
      timeoutMs: 10,
      fetchImpl(_url, init) {
        requestSignal = init.signal;
        return new Promise(() => {});
      },
    }),
    (error) => error?.name === "AbortError",
  );

  assert.equal(requestSignal?.aborted, true);
});

test("direct image generation keeps high-resolution direct requests on base64 responses", async () => {
  const requests = [];

  await requestDirectImageGeneration({
    baseUrl: "https://api.mouubox.com/v1",
    endpointPath: "images/generations",
    apiKey: "route-b-key",
    prompt: "Create a cinematic 4K landscape.",
    size: "3840x2160",
    aspectRatio: "16:9",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    async fetchImpl(url, init) {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: "Zm91ci1rLWJhc2U2NA==" }],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.mouubox.com/v1/images/generations");
  assert.equal(requests[0].body.model, "gpt-image-2");
  assert.equal(requests[0].body.size, "3840x2160");
  assert.equal(requests[0].body.quality, "high");
  assert.equal(requests[0].body.response_format, "b64_json");
  assert.equal("aspect_ratio" in requests[0].body, false);
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

test("model protocol and image edit requests forward an AbortSignal", async () => {
  const controller = new AbortController();
  const protocolRequests = [];
  const protocolResult = await requestModelProtocolImageGeneration({
    baseUrl: "https://protocol.example.test/v1",
    apiKey: "protocol-key",
    prompt: "Create a protocol image.",
    imageModel: "gemini-3.1-flash-image-preview",
    signal: controller.signal,
    fetchImpl(url, init) {
      protocolRequests.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: "cHJvdG9jb2w=" } }] } }] }), { status: 200 }));
    },
  });

  const editRequests = [];
  const editResult = await requestImageEdit({
    baseUrl: "https://edit.example.test/v1",
    apiKey: "edit-key",
    prompt: "Edit this image.",
    sourceImage: { filename: "source.png", mimeType: "image/png", base64: "c291cmNl" },
    size: "1024x1024",
    quality: "high",
    signal: controller.signal,
    fetchImpl(url, init) {
      editRequests.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ data: [{ b64_json: "ZWRpdA==" }] }), { status: 200 }));
    },
  });

  assert.equal(protocolRequests[0].init.signal, controller.signal);
  assert.equal(editRequests[0].init.signal, controller.signal);
  assert.equal(protocolResult.finalImageBase64, "cHJvdG9jb2w=");
  assert.equal(editResult.finalImageBase64, "ZWRpdA==");
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
  assert.equal(result.imageFieldFallbackUsed, false);
});

test("direct image edit retries with repeated singular image field when the upstream rejects image[]", async () => {
  const requests = [];
  const statusMessages = [];
  const result = await requestDirectImageGeneration({
    baseUrl: "https://relay.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "relay-key",
    prompt: "Create a creation set image.",
    referenceImages: [
      { filename: "product.png", mimeType: "image/png", base64: "cHJvZHVjdA==" },
      { filename: "logo.png", mimeType: "image/png", base64: "bG9nbw==" },
    ],
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    async onEvent(event) {
      if (event.type === "status") {
        statusMessages.push(event.message);
      }
    },
    async fetchImpl(url, init) {
      requests.push({ url, body: init.body });
      if (requests.length === 1) {
        return new Response(
          JSON.stringify({ error: { code: "bad_request", message: "image file or image_url is required" } }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify({ data: [{ b64_json: "cmV0cmllZA==" }] }), { status: 200 });
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://relay.example.test/v1/images/edits");
  assert.equal(requests[1].url, "https://relay.example.test/v1/images/edits");
  assert.equal(requests[0].body.getAll("image[]").length, 2);
  assert.equal(requests[0].body.getAll("image").length, 0);
  const retriedImages = requests[1].body.getAll("image");
  assert.equal(retriedImages.length, 2);
  assert.equal(retriedImages[0].name, "product.png");
  assert.equal(retriedImages[1].name, "logo.png");
  assert.equal(requests[1].body.getAll("image[]").length, 0);
  assert.equal(requests[1].body.get("prompt"), requests[0].body.get("prompt"));
  assert.equal(requests[1].body.get("model"), "gpt-image-2");
  assert.equal(requests[1].body.get("size"), "1024x1024");
  assert.equal(result.finalImageBase64, "cmV0cmllZA==");
  assert.equal(result.imageFieldFallbackUsed, true);
  assert.ok(statusMessages.some((message) => message.includes("image[]")));
});

test("direct image edit does not retry when a single reference image is rejected", async () => {
  const requests = [];
  await assert.rejects(
    requestDirectImageGeneration({
      baseUrl: "https://relay.example.test/v1",
      endpointPath: "images/generations",
      apiKey: "relay-key",
      prompt: "Create one image.",
      referenceImages: [{ filename: "product.png", mimeType: "image/png", base64: "cHJvZHVjdA==" }],
      size: "1024x1024",
      quality: "high",
      format: "png",
      imageModel: "gpt-image-2",
      async fetchImpl(url, init) {
        requests.push({ url, body: init.body });
        return new Response(
          JSON.stringify({ error: { code: "bad_request", message: "image file or image_url is required" } }),
          { status: 400 },
        );
      },
    }),
    /image file or image_url is required/,
  );

  assert.equal(requests.length, 1);
});

test("direct image edit does not retry on unrelated upstream failures", async () => {
  const requests = [];
  await assert.rejects(
    requestDirectImageGeneration({
      baseUrl: "https://relay.example.test/v1",
      endpointPath: "images/generations",
      apiKey: "relay-key",
      prompt: "Create a creation set image.",
      referenceImages: [
        { filename: "product.png", mimeType: "image/png", base64: "cHJvZHVjdA==" },
        { filename: "logo.png", mimeType: "image/png", base64: "bG9nbw==" },
      ],
      size: "1024x1024",
      quality: "high",
      format: "png",
      imageModel: "gpt-image-2",
      async fetchImpl(url, init) {
        requests.push({ url, body: init.body });
        return new Response(JSON.stringify({ error: { message: "insufficient quota" } }), { status: 429 });
      },
    }),
    /insufficient quota/,
  );

  assert.equal(requests.length, 1);
});

test("direct image generation ignores reference images that carry no bytes", async () => {
  const requests = [];
  const result = await requestDirectImageGeneration({
    baseUrl: "https://relay.example.test/v1",
    endpointPath: "images/generations",
    apiKey: "relay-key",
    prompt: "Create from an empty reference.",
    referenceImages: [{ filename: "broken.png", mimeType: "image/png", base64: "" }],
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    async fetchImpl(url, init) {
      requests.push({ url, body: init.body });
      return new Response(JSON.stringify({ data: [{ b64_json: "Z2VuZXJhdGVk" }] }), { status: 200 });
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://relay.example.test/v1/images/generations");
  assert.equal(typeof requests[0].body, "string");
  assert.equal(result.endpointPath, "images/generations");
  assert.equal(result.finalImageBase64, "Z2VuZXJhdGVk");
});

test("direct image generation falls back to generations when an edit endpoint has no usable reference", async () => {
  const requests = [];
  const result = await requestDirectImageGeneration({
    baseUrl: "https://relay.example.test/v1",
    endpointPath: "images/edits",
    apiKey: "relay-key",
    prompt: "Create without a reference.",
    referenceImages: [],
    size: "1024x1024",
    quality: "high",
    format: "png",
    imageModel: "gpt-image-2",
    async fetchImpl(url, init) {
      requests.push({ url, body: init.body });
      return new Response(JSON.stringify({ data: [{ b64_json: "ZmFsbGJhY2s=" }] }), { status: 200 });
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://relay.example.test/v1/images/generations");
  assert.equal(typeof requests[0].body, "string");
  assert.equal(JSON.parse(requests[0].body).prompt, "Create without a reference.");
  assert.equal(result.endpointPath, "images/generations");
  assert.equal(result.finalImageBase64, "ZmFsbGJhY2s=");
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

test("direct image generation can target responses with the direct image model", async () => {
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
    responsesModel: "vendor-image-pro",
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
  assert.equal(requests[0].body.model, "vendor-image-pro");
  assert.equal(requests[0].body.reasoning.effort, "xhigh");
  assert.equal(requests[0].body.stream, false);
  assert.deepEqual(requests[0].body.tool_choice, { type: "image_generation" });
  assert.equal(requests[0].body.tools[0].type, "image_generation");
  assert.equal(requests[0].body.tools[0].model, "vendor-image-pro");
  assert.equal("response_format" in requests[0].body, false);
  assert.deepEqual(
    requests[0].body.input[0].content.map((item) => item.type),
    ["input_text", "input_text", "input_image"],
  );
  assert.equal(result.finalImageBase64, "ZGlyZWN0LXJlc3BvbnNlcw==");
  assert.equal(result.responsesModel, "vendor-image-pro");
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

test("consumeResponsesSse cancels a pending reader when its AbortSignal fires", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const fakeStream = {
    getReader() {
      return {
        read() {
          return new Promise(() => {});
        },
        cancel() {
          cancelled = true;
          return Promise.resolve();
        },
      };
    },
  };

  const pending = consumeResponsesSse(fakeStream, { signal: controller.signal });
  setTimeout(() => controller.abort(), 5);

  await assert.rejects(pending, (error) => error?.name === "AbortError");
  assert.equal(cancelled, true);
});

// Abandoning a stream without cancelling leaves the upstream socket open until the
// provider closes it, which ties up connections under Creation's bounded concurrency.
test("consumeResponsesSse releases the upstream body when it stops reading early", async () => {
  const finalChunk = [
    "event: response.output_item.done",
    'data: {"item":{"type":"image_generation_call","result":"bGVhay1jaGVjaw=="}}',
    "",
    "",
  ].join("\n");

  const buildStream = (text) => {
    const state = { cancelled: false };
    state.stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
      },
      cancel() {
        state.cancelled = true;
      },
    });
    return state;
  };

  const onEventRejection = buildStream(finalChunk);
  await assert.rejects(
    () => consumeResponsesSse(onEventRejection.stream, {
      onEvent(event) {
        if (event.type === "final_image") {
          throw new Error("生成结果无效：图片数据损坏");
        }
      },
    }),
    /图片数据损坏/,
  );
  assert.equal(onEventRejection.cancelled, true);

  const terminalError = buildStream([
    "event: response.failed",
    'data: {"type":"response.failed","response":{"error":{"message":"boom"}}}',
    "",
    "",
  ].join("\n"));
  await assert.rejects(() => consumeResponsesSse(terminalError.stream, { onEvent() {} }));
  assert.equal(terminalError.cancelled, true);

  const doneSentinel = buildStream([finalChunk, "data: [DONE]", "", ""].join("\n"));
  const sentinelResult = await consumeResponsesSse(doneSentinel.stream, { onEvent() {} });
  assert.equal(sentinelResult.finalImageBase64, "bGVhay1jaGVjaw==");
  assert.equal(doneSentinel.cancelled, true);
});

test("consumeResponsesSse keeps retrying-upstream heartbeat state visible", async () => {
  const controller = new AbortController();
  const events = [];
  const fakeStream = {
    getReader() {
      return {
        read() {
          return new Promise(() => {});
        },
        cancel() {
          return Promise.resolve();
        },
      };
    },
  };

  const pending = consumeResponsesSse(fakeStream, {
    onEvent(event) {
      events.push(event);
    },
    statusHeartbeatMs: 2,
    statusHeartbeatStage: "retrying_upstream",
    statusHeartbeatMessage: "重试中",
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 10);

  await assert.rejects(pending, (error) => error?.name === "AbortError");
  assert.ok(events.length > 0);
  assert.ok(events.every((event) => event.stage === "retrying_upstream" && event.message === "重试中"));
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

test("consumeResponsesSse keeps a response.completed final image before a trailing failed event", async () => {
  const chunks = [
    [
      "event: response.completed",
      'data: {"type":"response.completed","response":{"output":[{"type":"image_generation_call","result":"Y29tcGxldGVkLWZpbmFs"}]}}',
      "",
      "event: response.failed",
      'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"late proxy failure"}}}',
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
  assert.deepEqual(result.events, ["response.completed", "response.failed"]);
  assert.equal(result.finalImageBase64, "Y29tcGxldGVkLWZpbmFs");
  assert.equal(result.responseCompleted, true);
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

test("consumeResponsesSse only captures IDs from response events", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode([
        "event: response.output_item.done",
        'data: {"item":{"id":"image-item-id","type":"image_generation_call"}}',
        "",
        "data: [DONE]",
        "",
      ].join("\n")));
      controller.close();
    },
  });

  const result = await consumeResponsesSse(stream);

  assert.equal(result.responseId, "");
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

test("requestImageGeneration retrieves the original response after a partial stream interruption", async () => {
  const requests = [];
  const events = [];
  const encoder = new TextEncoder();

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create the original image",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    responseRecoveryPollDelayMs: 0,
    async fetchImpl(url, init) {
      requests.push({ url, method: init.method, body: JSON.parse(init.body || "{}") });
      if (init.method === "GET") {
        return new Response(
          JSON.stringify({
            id: "resp_original",
            status: "completed",
            output: [{ type: "image_generation_call", result: "b3JpZ2luYWwtZmluYWw=" }],
          }),
          { status: 200 },
        );
      }

      return new Response(
        new ReadableStream({
          pull(controller) {
            if (this.sent) {
              controller.error(new Error("socket terminated"));
              return;
            }
            this.sent = true;
            controller.enqueue(
              encoder.encode([
                "event: response.created",
                'data: {"type":"response.created","response":{"id":"resp_original","status":"in_progress"}}',
                "",
                "event: response.image_generation_call.partial_image",
                'data: {"partial_image_b64":"cGFydGlhbC1vcmlnaW5hbA=="}',
                "",
                "",
              ].join("\n")),
            );
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests.map(({ method }) => method), ["POST", "GET"]);
  assert.equal(requests[0].body.stream, true);
  assert.equal(requests[1].url, "https://example.test/v1/responses/resp_original");
  assert.equal(result.finalImageBase64, "b3JpZ2luYWwtZmluYWw=");
  assert.equal(result.recoveredOriginal, true);
  assert.ok(events.some((event) => event.type === "partial_image"));
  assert.ok(events.some((event) => event.type === "status" && event.stage === "recovering_original"));
  assert.ok(events.some((event) => event.type === "status" && event.stage === "recovered_original"));
});

test("requestImageGeneration propagates AbortSignal and does not recover or retry after stream cancellation", async () => {
  const controller = new AbortController();
  const requests = [];
  let cancelled = false;
  const pendingStream = {
    getReader() {
      return {
        read() {
          return new Promise(() => {});
        },
        cancel() {
          cancelled = true;
          return Promise.resolve();
        },
      };
    },
  };

  const pending = requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Cancel this image.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    signal: controller.signal,
    async fetchImpl(url, init) {
      requests.push({ url, init });
      return { ok: true, status: 200, body: pendingStream };
    },
  });
  setTimeout(() => controller.abort(), 5);

  await assert.rejects(pending, (error) => error?.name === "AbortError");
  assert.equal(cancelled, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.signal, controller.signal);
  assert.equal(requests[0].init.method, "POST");
});

test("requestImageGeneration polls the original response with GET only", async () => {
  const requests = [];
  const events = [];
  let retrievalCount = 0;
  const noFinalStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_poll","status":"in_progress"}}',
    "",
    "event: response.image_generation_call.partial_image",
    'data: {"partial_image_b64":"cG9sbC1wcmV2aWV3"}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Wait for the original task",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    responseRecoveryMaxPolls: 3,
    responseRecoveryPollDelayMs: 0,
    async fetchImpl(url, init) {
      requests.push({ url, method: init.method, body: JSON.parse(init.body || "{}") });
      if (init.method === "POST") {
        return new Response(noFinalStream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      retrievalCount += 1;
      return new Response(
        JSON.stringify(retrievalCount === 1
          ? { id: "resp_poll", status: "in_progress" }
          : { id: "resp_poll", status: "completed", output: [{ type: "image_generation_call", result: "cG9sbC1maW5hbA==" }] }),
        { status: 200 },
      );
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests.map(({ method }) => method), ["POST", "GET", "GET"]);
  assert.equal(result.finalImageBase64, "cG9sbC1maW5hbA==");
  assert.equal(result.recoveredOriginal, true);
  assert.ok(events.some((event) => event.type === "status" && event.stage === "waiting_original"));
});

test("requestImageGeneration retries once with the frozen original input when the response ID is missing", async () => {
  const requests = [];
  const events = [];
  const timeline = [];
  let postCount = 0;
  const noFinalStream = [
    "event: response.image_generation_call.partial_image",
    'data: {"partial_image_b64":"bm8taWQtcHJldmlldw=="}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const finalStream = [
    "event: response.output_item.done",
    'data: {"item":{"type":"image_generation_call","result":"cmV0cnktZmluYWw="}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Retry this exact composed prompt",
    referenceImages: [{ mimeType: "image/png", base64: "cmVmZXJlbmNl", filename: "reference.png" }],
    referenceImageLabels: ["Reference image 1: preserve this source."],
    size: "1536x1024",
    quality: "medium",
    format: "webp",
    responsesModel: "gpt-5.4",
    reasoningEffort: "high",
    async fetchImpl(url, init) {
      postCount += 1;
      timeline.push(`post-${postCount}`);
      requests.push({ url, method: init.method, rawBody: init.body, body: JSON.parse(init.body) });
      return new Response(postCount === 1 ? noFinalStream : finalStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    },
    onEvent(event) {
      events.push(event);
      if (event.type === "status" && event.stage === "retrying_upstream" && event.message === "重试中") {
        timeline.push("retry-status");
      }
    },
  });

  assert.equal(result.finalImageBase64, "cmV0cnktZmluYWw=");
  assert.deepEqual(requests.map(({ method }) => method), ["POST", "POST"]);
  assert.equal(requests[0].url, "https://example.test/v1/responses");
  assert.equal(requests[1].url, requests[0].url);
  assert.equal(requests[1].rawBody, requests[0].rawBody);
  assert.deepEqual(requests[1].body, requests[0].body);
  assert.equal(requests[0].body.model, "gpt-5.4");
  assert.equal(requests[0].body.reasoning.effort, "high");
  assert.equal(requests[0].body.tools[0].size, "1536x1024");
  assert.equal(requests[0].body.tools[0].quality, "medium");
  assert.equal(requests[0].body.tools[0].output_format, "webp");
  assert.deepEqual(
    requests[0].body.input[0].content.map(({ type, text, image_url: imageUrl }) => ({ type, text, imageUrl })),
    [
      { type: "input_text", text: "Retry this exact composed prompt", imageUrl: undefined },
      { type: "input_text", text: "Reference image 1: preserve this source.", imageUrl: undefined },
      { type: "input_image", text: undefined, imageUrl: "data:image/png;base64,cmVmZXJlbmNl" },
    ],
  );
  assert.ok(events.some((event) => (
    event.type === "status"
    && event.stage === "retrying_upstream"
    && event.message === "重试中"
  )));
  assert.ok(timeline.indexOf("retry-status") < timeline.indexOf("post-2"));
});

test("requestImageGeneration retries once after original response retrieval is unavailable", async () => {
  const requests = [];
  const events = [];
  let postCount = 0;
  const firstStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_unavailable","status":"in_progress"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const finalStream = [
    "event: response.output_item.done",
    'data: {"item":{"type":"image_generation_call","result":"cmV0cnktYWZ0ZXItNDA0"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Retry after retrieval is unavailable",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    responseRecoveryPollDelayMs: 0,
    async fetchImpl(url, init) {
      requests.push({ url, method: init.method });
      if (init.method === "GET") {
        return new Response("not retained", { status: 404 });
      }
      postCount += 1;
      return new Response(postCount === 1 ? firstStream : finalStream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    },
    onEvent(event) {
      events.push(event);
    },
  });

  assert.deepEqual(requests.map(({ method }) => method), ["POST", "GET", "POST"]);
  assert.equal(result.finalImageBase64, "cmV0cnktYWZ0ZXItNDA0");
  assert.ok(events.some((event) => (
    event.type === "status"
    && event.stage === "retrying_upstream"
    && event.message === "重试中"
  )));
});

test("requestImageGeneration stops after one unknown-result retry", async () => {
  const requests = [];
  const events = [];
  const noFinalStream = [
    "event: response.image_generation_call.partial_image",
    'data: {"partial_image_b64":"c3RpbGwtdW5rbm93bg=="}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  await assert.rejects(
    () => requestImageGeneration({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      prompt: "Stop after one retry",
      size: "1024x1024",
      quality: "high",
      responsesModel: "gpt-5.4",
      async fetchImpl(url, init) {
        requests.push({ url, method: init.method });
        return new Response(noFinalStream, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
      onEvent(event) {
        events.push(event);
      },
    }),
    /原 Responses 任务结果未知，自动重试后仍未确认，请手动重试/,
  );

  assert.deepEqual(requests.map(({ method }) => method), ["POST", "POST"]);
  assert.ok(events.some((event) => (
    event.type === "status"
    && event.stage === "recovery_unavailable"
    && event.message === "自动重试后仍无法确认最终结果，不再继续重试"
  )));
});

test("requestImageGeneration stops when the automatic retry task explicitly fails", async () => {
  const requests = [];
  const events = [];
  let postCount = 0;
  const firstStream = [
    "event: response.image_generation_call.partial_image",
    'data: {"partial_image_b64":"Zmlyc3QtdW5rbm93bg=="}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const retryStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_retry_failed","status":"in_progress"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  await assert.rejects(
    () => requestImageGeneration({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      prompt: "Retry task can fail",
      size: "1024x1024",
      quality: "high",
      responsesModel: "gpt-5.4",
      responseRecoveryPollDelayMs: 0,
      async fetchImpl(url, init) {
        requests.push({ url, method: init.method });
        if (init.method === "GET") {
          return new Response(JSON.stringify({ id: "resp_retry_failed", status: "failed" }), { status: 200 });
        }
        postCount += 1;
        return new Response(postCount === 1 ? firstStream : retryStream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      },
      onEvent(event) {
        events.push(event);
      },
    }),
    /自动重试的 Responses 任务已失败，不再继续重试/,
  );

  assert.deepEqual(requests.map(({ method }) => method), ["POST", "POST", "GET"]);
  assert.ok(events.some((event) => (
    event.type === "status"
    && event.stage === "original_failed"
    && event.message === "自动重试任务已失败，不再继续重试"
  )));
});

test("requestImageGeneration does not regenerate after an original response failure", async () => {
  const requests = [];
  const noFinalStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_failed","status":"in_progress"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  await assert.rejects(
    () => requestImageGeneration({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      prompt: "Do not retry a failed original task",
      size: "1024x1024",
      quality: "high",
      responsesModel: "gpt-5.4",
      async fetchImpl(url, init) {
        requests.push({ url, method: init.method, body: JSON.parse(init.body || "{}") });
        if (init.method === "POST") {
          return new Response(noFinalStream, { status: 200, headers: { "content-type": "text/event-stream" } });
        }
        return new Response(JSON.stringify({ id: "resp_failed", status: "failed" }), { status: 200 });
      },
    }),
    /原 Responses 任务已失败，系统未自动重新生成，请手动重试/,
  );

  assert.deepEqual(requests.map(({ method }) => method), ["POST", "GET"]);
});

// A retry re-POSTs a billable generation. When the provider still reports the
// original task as in_progress, retrying duplicates live upstream work.
test("requestImageGeneration does not regenerate while the original task is still in progress", async () => {
  const requests = [];
  const noFinalStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_running","status":"in_progress"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  await assert.rejects(
    () => requestImageGeneration({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      prompt: "Do not duplicate a running original task",
      size: "1024x1024",
      quality: "high",
      responsesModel: "gpt-5.4",
      responseRecoveryMaxPolls: 2,
      responseRecoveryPollDelayMs: 0,
      async fetchImpl(url, init) {
        requests.push({ method: init.method });
        if (init.method === "POST") {
          return new Response(noFinalStream, { status: 200, headers: { "content-type": "text/event-stream" } });
        }
        return new Response(JSON.stringify({ id: "resp_running", status: "in_progress" }), { status: 200 });
      },
    }),
    (error) => {
      assert.equal(error.originalResponseRecovery, "in_progress");
      assert.equal(error.originalResponseRecoveryReason, "poll_timeout");
      assert.equal(error.unknownResultRetryCount, 0);
      return true;
    },
  );

  assert.equal(requests.filter(({ method }) => method === "POST").length, 1);
});

test("requestImageGeneration does not regenerate when original response retrieval is unauthorized", async () => {
  const requests = [];
  const noFinalStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_auth","status":"in_progress"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  await assert.rejects(
    () => requestImageGeneration({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      prompt: "Do not retry past an auth failure",
      size: "1024x1024",
      quality: "high",
      responsesModel: "gpt-5.4",
      responseRecoveryPollDelayMs: 0,
      async fetchImpl(url, init) {
        requests.push({ method: init.method });
        if (init.method === "POST") {
          return new Response(noFinalStream, { status: 200, headers: { "content-type": "text/event-stream" } });
        }
        return new Response("denied", { status: 401 });
      },
    }),
    (error) => {
      assert.equal(error.originalResponseRecovery, "auth_error");
      return true;
    },
  );

  assert.equal(requests.filter(({ method }) => method === "POST").length, 1);
});

// A success status with an unreadable body is ambiguous: the task may still be
// running, so it must not be retried. An error status with an unreadable body
// (a 404 HTML page) is a genuine "not retrievable" and stays retryable.
test("requestImageGeneration distinguishes unreadable success bodies from unreadable error bodies", async () => {
  const noFinalStream = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_body","status":"in_progress"}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const finalStream = [
    "event: response.output_item.done",
    'data: {"item":{"type":"image_generation_call","result":"cmV0cnktb2s="}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  const buildOptions = (getResponse) => {
    let postCount = 0;
    const requests = [];
    return {
      requests,
      options: {
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        prompt: "Classify unreadable recovery bodies",
        size: "1024x1024",
        quality: "high",
        responsesModel: "gpt-5.4",
        responseRecoveryPollDelayMs: 0,
        async fetchImpl(url, init) {
          requests.push({ method: init.method });
          if (init.method === "GET") {
            return getResponse();
          }
          postCount += 1;
          return new Response(postCount === 1 ? noFinalStream : finalStream, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        },
      },
    };
  };

  const unreadableSuccess = buildOptions(() => new Response("<html>gateway</html>", { status: 200 }));
  await assert.rejects(
    () => requestImageGeneration(unreadableSuccess.options),
    (error) => {
      assert.equal(error.originalResponseRecovery, "invalid_response");
      return true;
    },
  );
  assert.equal(unreadableSuccess.requests.filter(({ method }) => method === "POST").length, 1);

  const unreadableNotFound = buildOptions(() => new Response("not retained", { status: 404 }));
  const recovered = await requestImageGeneration(unreadableNotFound.options);
  assert.equal(recovered.finalImageBase64, "cmV0cnktb2s=");
  assert.equal(unreadableNotFound.requests.filter(({ method }) => method === "POST").length, 2);
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
              type: "upstream_timeout",
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
  assert.equal(attempts, 1);
});

test("requestImageGeneration does not retry transient upstream HTTP errors", async () => {
  const requests = [];

  await assert.rejects(() => requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a small red icon.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push({ stream: body.stream, size: body.tools[0].size });
      return new Response(JSON.stringify({ error_code: 502 }), { status: 502 });
    },
  }), /生成请求失败：HTTP 502/);
  assert.deepEqual(requests, [{ stream: true, size: "1024x1024" }]);
});

test("requestImageGeneration does not retry an explicit upstream failed event", async () => {
  const requests = [];

  await assert.rejects(() => requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a small red icon.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push({ stream: body.stream, size: body.tools[0].size });
      return new Response([
        "event: response.failed",
        'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"Too many image requests"}}}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"), { status: 200, headers: { "content-type": "text/event-stream" } });
    },
  }), /上游生成失败：rate_limit_exceeded/);
  assert.deepEqual(requests, [{ stream: true, size: "1024x1024" }]);
});

test("requestImageGeneration keeps a final image that arrives before a terminal failed event", async () => {
  const requests = [];
  const events = [];

  const result = await requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create a stable final image.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push({ stream: body.stream, size: body.tools[0].size });

      return new Response(
        [
          "event: response.output_item.done",
          'data: {"item":{"type":"image_generation_call","result":"Zmlyc3Q="}}',
          "",
          "event: response.failed",
          'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"retry me"}}}',
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

  assert.deepEqual(requests, [{ stream: true, size: "1024x1024" }]);
  assert.equal(result.finalImageBase64, "Zmlyc3Q=");
  assert.deepEqual(
    events.filter((event) => event.type === "final_image").map((event) => event.base64),
    ["Zmlyc3Q="],
  );
  assert.equal(events.some((event) => event.type === "status" && event.stage === "retrying_upstream"), false);
});

test("requestImageGeneration accepts AGICTO-style completed final image before trailing failed event", async () => {
  const requests = [];
  const events = [];

  const result = await requestImageGeneration({
    baseUrl: "https://api.agicto.cn/v1",
    apiKey: "test-key",
    prompt: "Create a stable final image through a proxy.",
    size: "1024x1024",
    quality: "high",
    responsesModel: "gpt-5.4",
    transientHttpRetryDelayMs: 0,
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      requests.push({ url, stream: body.stream, size: body.tools[0].size });

      return new Response(
        [
          "event: response.completed",
          'data: {"type":"response.completed","response":{"output":[{"type":"image_generation_call","result":"YWdpY3RvLWZpbmFs"}]}}',
          "",
          "event: response.failed",
          'data: {"type":"response.failed","response":{"error":{"code":"rate_limit_exceeded","message":"late proxy failure"}}}',
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
    {
      url: "https://api.agicto.cn/v1/responses",
      stream: true,
      size: "1024x1024",
    },
  ]);
  assert.equal(result.finalImageBase64, "YWdpY3RvLWZpbmFs");
  assert.equal(result.responseCompleted, true);
  assert.equal(result.fallbackUsed, false);
  assert.deepEqual(
    events.filter((event) => event.type === "final_image").map((event) => event.base64),
    ["YWdpY3RvLWZpbmFs"],
  );
  assert.equal(events.some((event) => event.type === "status" && event.stage === "retrying_upstream"), false);
});

test("requestImageGeneration does not retry an invalid custom image size", async () => {
  const requests = [];

  await assert.rejects(() => requestImageGeneration({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    prompt: "Create an image of the major event poster",
    size: "1536x864",
    quality: "high",
    responsesModel: "gpt-5.4",
    async fetchImpl(_url, init) {
      const body = JSON.parse(init.body);
      requests.push(body.tools[0].size);

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
    },
  }), /生成请求失败：HTTP 400/);

  assert.deepEqual(requests, ["1536x864"]);
});
