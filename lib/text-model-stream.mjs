import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const context = new AsyncLocalStorage();
export const runWithTextModelContext = (value, callback) => context.run(value, callback);

const answer = (value) => {
  if (!value || typeof value !== "object") return "";
  if (typeof value.output_text === "string") return value.output_text;
  if (Array.isArray(value.candidates)) return value.candidates.slice(0, 1).flatMap((item) => item.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || "").join("");
  if (Array.isArray(value.choices)) return value.choices.slice(0, 1).map((item) => typeof item.message?.content === "string" ? item.message.content : "").join("");
  return (value.output || []).filter((item) => item.type === "message").flatMap((item) => item.content || []).filter((part) => part.type === "output_text").map((part) => part.text || "").join("");
};

// 保留原有解析器的 JSON 契约，同时把实际回答增量送到当前 HTTP 请求。
export async function requestStreamingText(fetchImpl, url, init, { onProgress, purpose = "文本分析" } = {}) {
  const scope = context.getStore();
  const signal = init.signal && scope?.signal ? AbortSignal.any([init.signal, scope.signal]) : init.signal || scope?.signal;
  signal?.throwIfAborted();
  const startedAt = Date.now();
  const requestId = scope?.requestId || randomUUID();
  const attempt = scope ? (scope.attempt = (scope.attempt || 0) + 1) : 1;
  let firstTextMs;
  const emit = (event) => {
    const value = { requestId, purpose, attempt, elapsedMs: Date.now() - startedAt, ...event };
    onProgress?.(value);
    if (scope?.onProgress !== onProgress) scope?.onProgress?.(value);
  };
  let body = JSON.parse(init.body);
  body = { ...body, stream: true };
  if (/\/chat\/completions(?:\?|$)/.test(String(url)) && body.input !== undefined) {
    const messages = typeof body.input === "string" ? [{ role: "user", content: body.input }] : body.input;
    body.messages = messages.map((message) => ({ role: message.role || "user", content: Array.isArray(message.content) ? message.content.map((part) => part.type === "input_text" ? { type: "text", text: part.text } : part.type === "input_image" ? { type: "image_url", image_url: { url: part.image_url } } : part) : message.content }));
    if (body.text?.format) { const format = body.text.format; body.response_format = { type: format.type, json_schema: { name: format.name, strict: format.strict, schema: format.schema } }; }
    delete body.input; delete body.text; delete body.reasoning;
  }
  emit({ stage: "waiting", message: "已发出文本请求，等待模型返回。" });
  const response = await fetchImpl(url, { ...init, body: JSON.stringify(body), headers: { ...init.headers, Accept: "text/event-stream", "X-Client-Request-Id": requestId, "X-Client-Request-Attempt": String(attempt) }, ...(signal ? { signal } : {}) });
  if (!response.ok) return response;
  if (!response.body?.getReader) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let text = "";
  let finalPayload;
  let streaming = /text\/event-stream/i.test(response.headers?.get("content-type") || "");
  let terminal = false;
  let aborted = false;
  const abort = () => { aborted = true; void reader.cancel(signal.reason).catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const publish = (value) => {
    if (!value || value === text) return;
    const delta = value.startsWith(text) ? value.slice(text.length) : value;
    text = value;
    firstTextMs ??= Date.now() - startedAt;
    emit({ stage: "receiving", text, delta, firstTextMs, transport: "stream", receivedCharacters: text.length });
  };
  const consume = (chunk) => {
    const data = chunk.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return;
    if (data.trim() === "[DONE]") { terminal = true; return; }
    const payload = JSON.parse(data);
    if (payload == null) return;
    const type = payload.type || chunk.match(/^event:\s*(\S+)/m)?.[1];
    if (typeof payload === "string" && !/reasoning|thought/i.test(type || "")) publish(text + payload);
    if (payload.error || ["error", "response.failed", "response.incomplete"].includes(type)) throw new Error(payload.error?.message || payload.response?.error?.message || "模型流未完整结束。");
    if (type === "response.output_text.delta") publish(text + (payload.delta || ""));
    if (type === "response.output_text.done") publish(payload.text);
    if (type === "response.completed") {
      finalPayload = payload.response;
      publish(answer(finalPayload));
      terminal = true;
    }
    const choice = payload.choices?.[0];
    if (choice?.delta?.content) {
      const part = choice.delta.content;
      publish(text + (typeof part === "string" ? part : Array.isArray(part) ? part.map((entry) => entry.text || "").join("") : part.text || ""));
    }
    if (choice?.message) publish(answer(payload));
    if (choice?.finish_reason) terminal = true;
    if (payload.candidates) {
      const part = answer(payload);
      if (part) publish(text && part.startsWith(text) ? part : text + part);
      if (payload.candidates[0]?.finishReason) terminal = true;
    }
  };
  try {
    while (true) {
      const item = await reader.read();
      if (aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
      if (item.done) break;
      buffer += decoder.decode(item.value, { stream: true });
      if (!streaming && /^\s*(?:data:|event:|:)/m.test(buffer)) streaming = true;
      if (!streaming || (!/^\s*(?:data:|event:|:)/m.test(buffer) && !text)) continue;
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() || "";
      for (const chunk of chunks) consume(chunk);
      if (terminal && (finalPayload || text)) break;
    }
    buffer += decoder.decode();
    if (streaming && /^\s*(?:data:|event:|:)/m.test(buffer)) {
      if (buffer.trim()) consume(buffer);
    } else if (!streaming || buffer.trim()) {
      raw = buffer;
      // 有些网关保留 SSE Content-Type，但只返回一份完整 JSON。
      emit({ stage: "buffered", transport: "buffered", message: "网关返回完整缓冲结果，未提供实时文本增量。" });
      return new Response(raw, { status: response.status, headers: { "content-type": "application/json" } });
    }
    if (!text && !finalPayload) throw new Error("模型流没有返回有效回答文本。");
    const payload = { ...(finalPayload || {}), output_text: text || answer(finalPayload) };
    emit({ stage: "received", message: "回答已接收，正在校验完整结果。", firstTextMs });
    const result = new Response(JSON.stringify(payload), { status: response.status, headers: { "content-type": "application/json" } });
    result.textModelStreamed = true;
    return result;
  } finally {
    signal?.removeEventListener("abort", abort);
    try { await reader.cancel(); } catch {}
    reader.releaseLock();
  }
}
