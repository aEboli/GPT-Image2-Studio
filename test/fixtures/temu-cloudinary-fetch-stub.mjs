import { appendFile } from "node:fs/promises";

const originalFetch = globalThis.fetch;
const logPath = process.env.IMAGE_STUDIO_TEMU_CLOUDINARY_STUB_LOG || "";

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "api.cloudinary.com") {
    return originalFetch(input, init);
  }

  const file = init.body?.get?.("file");
  const filename = String(file?.name || "unknown.png");
  if (logPath) await appendFile(logPath, `${filename}\n`, "utf8");
  if (filename.includes("fail")) {
    return new Response(JSON.stringify({ error: { message: "fixture failure" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cloudName = decodeURIComponent(url.pathname.split("/")[2] || "demo-cloud");
  const publicId = filename.replace(/\.[^.]+$/u, "");
  return new Response(JSON.stringify({
    asset_id: `asset-${publicId}`,
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/${cloudName}/image/upload/v1/${publicId}.png`,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
