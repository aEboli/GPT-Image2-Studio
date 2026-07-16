import { appendFileSync } from "node:fs";

const originalFetch = globalThis.fetch;
const allowedUrl = String(process.env.CREATION_LISTING_ALLOWED_FETCH_URL || "");
const logPath = String(process.env.CREATION_LISTING_FETCH_LOG || "");

globalThis.fetch = async function guardedCreationListingFetch(input, init) {
  const url = String(input instanceof Request ? input.url : input);
  if (logPath) {
    appendFileSync(logPath, `${JSON.stringify({ url })}\n`, "utf8");
  }
  if (allowedUrl && url !== allowedUrl) {
    throw new Error(`Unexpected local-server fetch: ${url}`);
  }
  return originalFetch(input, init);
};
