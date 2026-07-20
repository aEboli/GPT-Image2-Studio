export async function readHttpResponseErrorMessage(response, fallbackMessage) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return fallbackMessage;
  try {
    const payload = JSON.parse(text);
    return String(payload?.message || payload?.error?.message || payload?.error || fallbackMessage);
  } catch {
    return text.trim();
  }
}

export async function buildHttpResponseError(response, fallbackMessage) {
  const error = new Error(await readHttpResponseErrorMessage(response, fallbackMessage));
  error.status = response.status;
  return error;
}
