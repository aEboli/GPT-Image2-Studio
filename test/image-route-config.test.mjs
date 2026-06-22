import test from "node:test";
import assert from "node:assert/strict";

import {
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_EDITS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
  IMAGE_ROUTE_C,
  appendApiEndpointPath,
  getSelectedImageGenerationConfig,
  getSelectedPromptAgentAnalysisConfig,
  getSelectedTextVisionConfig,
  splitApiEndpointUrl,
  splitModelProtocolUrl,
  normalizeImageRouteConfig,
} from "../lib/image-route-config.mjs";

test("image route config defaults direct text and vision model independently from direct image model", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "direct",
    directBaseUrl: "https://direct.example.test",
    directApiKey: "direct-key",
  });

  assert.equal(config.imageRoute, "b");
  assert.equal(config.directImageModel, "gpt-image-2");
  assert.equal(config.directResponsesModel, DEFAULT_DIRECT_RESPONSES_MODEL);
  assert.equal(config.directResponsesModel, "gpt-5.5");
  assert.equal(config.endpointPath, API_ENDPOINT_RESPONSES);
  assert.equal(config.directEndpointPath, API_ENDPOINT_IMAGE_GENERATIONS);
});

test("direct image config seeds missing direct relay settings from route A", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "b",
    baseUrl: "https://route-a-relay.example.test/v1/responses",
    apiKey: "route-a-key",
  });

  assert.equal(config.directBaseUrl, "https://route-a-relay.example.test/v1");
  assert.equal(config.directApiKey, "route-a-key");
  assert.equal(config.directEndpointPath, API_ENDPOINT_IMAGE_GENERATIONS);
});

test("image route config normalizes independent model protocol settings", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "model-protocol",
    protocolBaseUrl: "https://protocol.example.test/v1/models/gemini-3.1-flash-image-preview:generateContent",
    protocolApiKey: "protocol-key",
    protocolImageModel: "gemini-3.1-flash-image-preview",
  });

  assert.equal(config.imageRoute, IMAGE_ROUTE_C);
  assert.equal(config.protocolBaseUrl, "https://protocol.example.test/v1");
  assert.equal(config.protocolApiKey, "protocol-key");
  assert.equal(config.protocolImageModel, "gemini-3.1-flash-image-preview");
});

test("image route config strips chat completions endpoint from model protocol base URL", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "model-protocol",
    protocolBaseUrl: "https://protocol.example.test/v1/chat/completions?debug=true",
    protocolApiKey: "protocol-key",
    protocolImageModel: "gemini-3.1-flash-image-preview",
  });

  assert.equal(config.protocolBaseUrl, "https://protocol.example.test/v1");
  assert.equal(config.protocolApiKey, "protocol-key");
  assert.equal(config.protocolImageModel, "gemini-3.1-flash-image-preview");
});

test("selected image generation config keeps route C on the model chat completions API", () => {
  assert.deepEqual(
    getSelectedImageGenerationConfig({
      imageRoute: "c",
      baseUrl: "https://route-a.example.test/v1",
      apiKey: "route-a-key",
      directBaseUrl: "https://route-b.example.test/v1",
      directApiKey: "route-b-key",
      directImageModel: "gpt-image-2",
      protocolBaseUrl: "https://protocol.example.test/v1",
      protocolApiKey: "protocol-key",
      protocolImageModel: "gemini-3.1-flash-image-preview",
    }),
    {
      imageRoute: "c",
      baseUrl: "https://protocol.example.test/v1",
      apiKey: "protocol-key",
      imageModel: "gemini-3.1-flash-image-preview",
      protocol: "model-chat-completions",
    },
  );
});

test("model protocol config defaults to Gemini image model", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "c",
  });

  assert.equal(config.protocolImageModel, DEFAULT_PROTOCOL_IMAGE_MODEL);
});

test("model protocol config seeds missing protocol relay settings from existing route keys", () => {
  const routeASeeded = normalizeImageRouteConfig({
    imageRoute: "c",
    baseUrl: "https://route-a-relay.example.test/v1/responses",
    apiKey: "route-a-key",
  });
  const directSeeded = normalizeImageRouteConfig({
    imageRoute: "c",
    baseUrl: "https://route-a-relay.example.test/v1",
    apiKey: "route-a-key",
    directBaseUrl: "https://direct-relay.example.test/v1/images/generations",
    directApiKey: "direct-key",
  });

  assert.equal(routeASeeded.protocolBaseUrl, "https://route-a-relay.example.test/v1");
  assert.equal(routeASeeded.protocolApiKey, "route-a-key");
  assert.equal(directSeeded.protocolBaseUrl, "https://direct-relay.example.test/v1");
  assert.equal(directSeeded.protocolApiKey, "direct-key");
});

test("image route config splits full endpoint URLs into base URLs and endpoint paths", () => {
  const config = normalizeImageRouteConfig({
    baseUrl: "https://route-a.example.test/v1/responses",
    directBaseUrl: "https://direct.example.test/v1/chat/completions",
    directEndpointPath: "images/generations",
  });

  assert.equal(config.baseUrl, "https://route-a.example.test/v1");
  assert.equal(config.endpointPath, API_ENDPOINT_RESPONSES);
  assert.equal(config.directBaseUrl, "https://direct.example.test/v1");
  assert.equal(config.directEndpointPath, API_ENDPOINT_CHAT_COMPLETIONS);
});

test("route A keeps known endpoint suffixes from complete URLs", () => {
  const cases = [
    [API_ENDPOINT_RESPONSES, "https://route-a.example.test/openai/v1/responses?debug=true#trace"],
    [API_ENDPOINT_CHAT_COMPLETIONS, "https://route-a.example.test/openai/v1/chat/completions?debug=true#trace"],
    [API_ENDPOINT_IMAGE_GENERATIONS, "https://route-a.example.test/openai/v1/images/generations?debug=true#trace"],
    [API_ENDPOINT_IMAGE_EDITS, "https://route-a.example.test/openai/v1/images/edits?debug=true#trace"],
  ];

  for (const [endpointPath, baseUrl] of cases) {
    const config = normalizeImageRouteConfig({
      imageRoute: "a",
      baseUrl,
      endpointPath: API_ENDPOINT_RESPONSES,
    });

    assert.equal(config.baseUrl, "https://route-a.example.test/openai/v1");
    assert.equal(config.endpointPath, endpointPath);
  }
});

test("root complete endpoint URLs do not gain a synthetic v1 base path", () => {
  const cases = [
    [API_ENDPOINT_RESPONSES, "https://vendor.example.test/responses?debug=true#trace"],
    [API_ENDPOINT_CHAT_COMPLETIONS, "https://vendor.example.test/chat/completions?debug=true#trace"],
    [API_ENDPOINT_IMAGE_GENERATIONS, "https://vendor.example.test/images/generations?debug=true#trace"],
    [API_ENDPOINT_IMAGE_EDITS, "https://vendor.example.test/images/edits?debug=true#trace"],
  ];

  for (const [endpointPath, fullUrl] of cases) {
    assert.deepEqual(
      splitApiEndpointUrl(fullUrl, {
        fallbackBaseUrl: "https://fallback.example.test/v1",
        fallbackEndpointPath: API_ENDPOINT_RESPONSES,
      }),
      {
        baseUrl: "https://vendor.example.test",
        endpointPath,
      },
    );

    const routeAConfig = normalizeImageRouteConfig({
      imageRoute: "a",
      baseUrl: fullUrl,
      endpointPath: API_ENDPOINT_RESPONSES,
    });
    const routeBConfig = normalizeImageRouteConfig({
      imageRoute: "b",
      baseUrl: "https://route-a.example.test/v1",
      directBaseUrl: fullUrl,
      directEndpointPath: API_ENDPOINT_IMAGE_GENERATIONS,
      directApiKey: "route-b-key",
    });

    assert.equal(routeAConfig.baseUrl, "https://vendor.example.test");
    assert.equal(routeAConfig.endpointPath, endpointPath);
    assert.equal(routeBConfig.directBaseUrl, "https://vendor.example.test");
    assert.equal(routeBConfig.directEndpointPath, endpointPath);
  }
});

test("route A preserves unknown vendor paths and drops query and hash", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "a",
    baseUrl: "https://vendor.example.test/openai/deployments/prod/custom/images?api-version=2026-06-01#trace",
    endpointPath: API_ENDPOINT_CHAT_COMPLETIONS,
  });

  assert.equal(config.baseUrl, "https://vendor.example.test/openai/deployments/prod/custom/images");
  assert.equal(config.endpointPath, API_ENDPOINT_CHAT_COMPLETIONS);
});

test("route B keeps known endpoint suffixes from complete URLs", () => {
  const cases = [
    [API_ENDPOINT_RESPONSES, "https://route-b.example.test/openai/v1/responses?debug=true#trace"],
    [API_ENDPOINT_CHAT_COMPLETIONS, "https://route-b.example.test/openai/v1/chat/completions?debug=true#trace"],
    [API_ENDPOINT_IMAGE_GENERATIONS, "https://route-b.example.test/openai/v1/images/generations?debug=true#trace"],
    [API_ENDPOINT_IMAGE_EDITS, "https://route-b.example.test/openai/v1/images/edits?debug=true#trace"],
  ];

  for (const [endpointPath, directBaseUrl] of cases) {
    const config = normalizeImageRouteConfig({
      imageRoute: "b",
      baseUrl: "https://route-a.example.test/v1",
      directBaseUrl,
      directEndpointPath: API_ENDPOINT_IMAGE_GENERATIONS,
      directApiKey: "route-b-key",
    });

    assert.equal(config.directBaseUrl, "https://route-b.example.test/openai/v1");
    assert.equal(config.directEndpointPath, endpointPath);
  }
});

test("route B preserves unknown vendor paths and drops query and hash", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "b",
    baseUrl: "https://route-a.example.test/v1",
    directBaseUrl: "https://vendor.example.test/openai/deployments/prod/custom/images?api-version=2026-06-01#trace",
    directEndpointPath: API_ENDPOINT_IMAGE_GENERATIONS,
    directApiKey: "route-b-key",
  });

  assert.equal(config.directBaseUrl, "https://vendor.example.test/openai/deployments/prod/custom/images");
  assert.equal(config.directEndpointPath, API_ENDPOINT_IMAGE_GENERATIONS);
});

test("model protocol URLs preserve unknown paths and strip known chat suffixes consistently", () => {
  assert.deepEqual(
    splitModelProtocolUrl("https://protocol.example.test/openai/v1/chat/completions?debug=true#trace", {
      fallbackBaseUrl: "https://fallback.example.test/v1",
    }),
    {
      baseUrl: "https://protocol.example.test/openai/v1",
      imageModel: "",
    },
  );

  assert.deepEqual(
    splitModelProtocolUrl("https://protocol.example.test/openai/custom/path?debug=true#trace", {
      fallbackBaseUrl: "https://fallback.example.test/v1",
    }),
    {
      baseUrl: "https://protocol.example.test/openai/custom/path",
      imageModel: "",
    },
  );
});

test("model protocol strips all known endpoint suffixes from complete URLs", () => {
  const cases = [
    API_ENDPOINT_RESPONSES,
    API_ENDPOINT_CHAT_COMPLETIONS,
    API_ENDPOINT_IMAGE_GENERATIONS,
    API_ENDPOINT_IMAGE_EDITS,
  ];

  for (const endpointPath of cases) {
    assert.deepEqual(
      splitModelProtocolUrl(`https://protocol.example.test/${endpointPath}?debug=true#trace`, {
        fallbackBaseUrl: "https://fallback.example.test/v1",
      }),
      {
        baseUrl: "https://protocol.example.test",
        imageModel: "",
      },
    );

    const config = normalizeImageRouteConfig({
      imageRoute: "c",
      protocolBaseUrl: `https://protocol.example.test/${endpointPath}?debug=true#trace`,
      protocolImageModel: "gemini-3.1-flash-image-preview",
    });

    assert.equal(config.protocolBaseUrl, "https://protocol.example.test");
  }
});

test("endpoint URL helpers compose and split complete request URLs", () => {
  assert.equal(
    appendApiEndpointPath("https://api.example.test/v1", API_ENDPOINT_CHAT_COMPLETIONS),
    "https://api.example.test/v1/chat/completions",
  );

  assert.deepEqual(
    splitApiEndpointUrl("https://api.example.test/v1/chat/completions?ignored=true", {
      fallbackBaseUrl: "https://fallback.example.test/v1",
      fallbackEndpointPath: API_ENDPOINT_RESPONSES,
    }),
    {
      baseUrl: "https://api.example.test/v1",
      endpointPath: API_ENDPOINT_CHAT_COMPLETIONS,
    },
  );
});

test("endpoint URL helpers preserve vendor paths without appending v1", () => {
  assert.deepEqual(
    splitApiEndpointUrl("https://vendor.example.test/openai/deployments/prod/chat/completions?debug=true", {
      fallbackBaseUrl: "https://fallback.example.test/v1",
      fallbackEndpointPath: API_ENDPOINT_RESPONSES,
    }),
    {
      baseUrl: "https://vendor.example.test/openai/deployments/prod",
      endpointPath: API_ENDPOINT_CHAT_COMPLETIONS,
    },
  );

  assert.deepEqual(
    splitApiEndpointUrl("https://vendor.example.test/custom/full/request-path?debug=true#trace", {
      fallbackBaseUrl: "https://fallback.example.test/v1",
      fallbackEndpointPath: API_ENDPOINT_RESPONSES,
    }),
    {
      baseUrl: "https://vendor.example.test/custom/full/request-path",
      endpointPath: API_ENDPOINT_RESPONSES,
    },
  );

  assert.equal(
    appendApiEndpointPath("https://vendor.example.test/custom/base", API_ENDPOINT_RESPONSES),
    "https://vendor.example.test/custom/base/responses",
  );
});

test("image route config accepts routeB responsesModel as direct text and vision model", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "b",
    routeB: {
      baseUrl: "https://direct.example.test",
      apiKey: "direct-key",
      imageModel: "vendor-image-pro",
      responsesModel: "vendor-vision-text",
    },
  });

  assert.equal(config.directImageModel, "vendor-image-pro");
  assert.equal(config.directResponsesModel, "vendor-vision-text");
});

test("selected text and vision config uses direct API settings in direct mode", () => {
  const config = {
    imageRoute: "b",
    baseUrl: "https://route-a.example.test/v1",
    apiKey: "route-a-key",
    responsesModel: "gpt-5.4",
    directBaseUrl: "https://direct.example.test/v1",
    directEndpointPath: "chat/completions",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedTextVisionConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "chat/completions",
    apiKey: "direct-key",
    responsesModel: "vendor-vision-text",
  });
  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "gpt-5.4",
    imageModel: "vendor-image-pro",
    endpointPath: "chat/completions",
  });
});

test("selected direct image generation config uses direct responses model for responses protocol", () => {
  const config = {
    imageRoute: "b",
    responsesModel: "route-a-model",
    directBaseUrl: "https://direct.example.test/v1",
    directEndpointPath: "responses",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "vendor-vision-text",
    imageModel: "vendor-image-pro",
    endpointPath: "responses",
  });
});

test("selected direct image generation config keeps route A responses model for image protocol", () => {
  const config = {
    imageRoute: "b",
    responsesModel: "route-a-model",
    directBaseUrl: "https://direct.example.test/v1",
    directEndpointPath: "images/generations",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "route-a-model",
    imageModel: "vendor-image-pro",
    endpointPath: "images/generations",
  });
});

test("selected text and vision config preserves route A behavior", () => {
  assert.deepEqual(
    getSelectedTextVisionConfig({
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
      directBaseUrl: "https://direct.example.test/v1",
      directApiKey: "direct-key",
      directResponsesModel: "vendor-vision-text",
    }),
    {
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      endpointPath: "responses",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    },
  );
});

test("selected prompt-agent analysis config uses model protocol settings in Route C", () => {
  assert.deepEqual(
    getSelectedPromptAgentAnalysisConfig({
      imageRoute: "c",
      baseUrl: "https://route-a.example.test/v1",
      apiKey: "route-a-key",
      responsesModel: "route-a-model",
      protocolBaseUrl: "https://protocol.example.test/v1",
      protocolApiKey: "protocol-key",
      protocolImageModel: "gemini-3.1-flash-image-preview",
    }),
    {
      imageRoute: "c",
      baseUrl: "https://protocol.example.test/v1",
      endpointPath: "images/generations",
      apiKey: "protocol-key",
      responsesModel: "gemini-3.1-flash-image-preview",
      imageModel: "gemini-3.1-flash-image-preview",
    },
  );
});

test("selected text and vision config normalizes legacy chat completions endpoint paths", () => {
  assert.deepEqual(
    getSelectedTextVisionConfig({
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      endpointPath: "responses",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    }),
    {
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      endpointPath: "responses",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    },
  );

  assert.deepEqual(
    getSelectedTextVisionConfig({
      imageRoute: "b",
      directBaseUrl: "https://direct.example.test/v1/chat/completions",
      directApiKey: "direct-key",
      directResponsesModel: "vendor-vision-text",
    }),
    {
      imageRoute: "b",
      baseUrl: "https://direct.example.test/v1",
      endpointPath: "chat/completions",
      apiKey: "direct-key",
      responsesModel: "vendor-vision-text",
    },
  );
});
