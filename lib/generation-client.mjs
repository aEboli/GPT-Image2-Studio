import {
  GENERATION_REQUEST_RETRY_DELAY_MS,
  getGenerationRequestRetryPlan,
} from "./generation-request-retry.mjs";

export function parseSseChunk(chunk) {
  const lines = String(chunk || "")
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

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

export async function consumeSse(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsed = parseSseChunk(chunk);
      if (!parsed.data || parsed.data === "[DONE]") {
        continue;
      }

      await onEvent(parsed.eventName, JSON.parse(parsed.data));
    }
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

export async function requestGenerationStream(endpointOrOptions = {}, directOptions = {}) {
  if (typeof endpointOrOptions === "string") {
    const {
      body,
      clientSessionId = "",
      fetchImpl = fetch,
      headers = {},
      method = "POST",
    } = directOptions || {};
    const requestHeaders = { ...headers };
    if (clientSessionId) {
      requestHeaders["x-client-session-id"] = clientSessionId;
    }
    const response = await fetchImpl(endpointOrOptions, {
      method,
      headers: requestHeaders,
      body,
    });
    if (!response.ok || !response.body) {
      throw new Error("生成请求失败");
    }
    return response;
  }

  const {
    job,
    clientSessionId,
    buildGenerationFormData,
    fetchImpl = fetch,
    retryPlan = getGenerationRequestRetryPlan,
    updateJob = () => {},
    waitMs = wait,
  } = endpointOrOptions || {};

  while (true) {
    try {
      const response = await fetchImpl("/api/generate", {
        method: "POST",
        headers: {
          "x-client-session-id": clientSessionId,
        },
        body: buildGenerationFormData(job),
      });

      if (!response.ok || !response.body) {
        throw new Error("生成请求失败");
      }

      return response;
    } catch (error) {
      const plan = retryPlan({
        error,
        retryCount: job.requestRetryCount || 0,
      });
      if (!plan.shouldRetry) {
        if (plan.retryable && !plan.shouldSurfaceError) {
          return null;
        }
        throw error;
      }

      job.requestRetryCount = plan.nextRetryCount;
      updateJob({
        requestRetryCount: plan.nextRetryCount,
        statusStage: "connecting",
        statusText: plan.message,
      });
      await waitMs(GENERATION_REQUEST_RETRY_DELAY_MS);
    }
  }
}
