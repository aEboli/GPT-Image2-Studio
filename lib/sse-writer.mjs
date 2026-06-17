export function formatSseEvent(type, payload) {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function writeNodeSseEvent(response, type, payload) {
  if (response.destroyed || response.writableEnded) {
    return false;
  }

  try {
    response.write(formatSseEvent(type, payload));
    return true;
  } catch (_error) {
    return false;
  }
}

export async function writeWorkerSseEvent(writer, type, payload) {
  await writer.write(new TextEncoder().encode(formatSseEvent(type, payload)));
}
