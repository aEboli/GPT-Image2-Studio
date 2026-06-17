export function parseSseChunk(chunk) {
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

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

export async function consumeSseStream(stream, handlers = {}) {
  const reader = stream.getReader();
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
      const { eventName, data } = parseSseChunk(chunk);
      if (!data) {
        continue;
      }

      if (data === "[DONE]") {
        if (handlers.onDone) {
          await handlers.onDone();
        }
        return;
      }

      let payload;
      try {
        payload = JSON.parse(data);
      } catch (error) {
        if (handlers.onInvalidJson) {
          await handlers.onInvalidJson({
            eventName: eventName || "unknown",
            data,
            error,
          });
        }
        continue;
      }

      const resolvedEventName = eventName || payload?.type || "unknown";
      if (handlers.onEvent) {
        await handlers.onEvent({
          eventName: resolvedEventName,
          payload,
        });
      }
    }
  }
}
