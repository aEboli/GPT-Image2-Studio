import { appendFile } from "node:fs/promises";

const originalFetch = globalThis.fetch;
const logPath = process.env.IMAGE_STUDIO_TEMU_CLOUDINARY_STUB_LOG || "";
const remotePng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00,
]);

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "1.1.1.1" || url.hostname === "res.cloudinary.com") {
    return new Response(remotePng, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  }
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
