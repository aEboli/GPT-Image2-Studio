import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

test("CLI defaults to high, preserves explicit none and negotiates unsupported max", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "image-studio-reasoning-cli-"));
  const calls = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    calls.push(body);
    if (body.reasoning.effort === "max") {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported value. Supported values: 'none', 'low', 'medium', 'high'" } }));
      return;
    }
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.end('event: response.completed\ndata: {"response":{"output":[{"type":"image_generation_call","result":"dGVzdC1pbWFnZQ=="}]}}\n\n');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(root, { recursive: true, force: true }); });
  for (const effort of [undefined, "none", "max"]) {
    calls.length = 0;
    const output = join(root, `${effort || "default"}.png`);
    const { stdout } = await execute(process.execPath, [fileURLToPath(new URL("../generate-image.mjs", import.meta.url)), "--base-url", `http://127.0.0.1:${server.address().port}/v1`, "--model", "test-model", "--prompt", "水杯", "--output", output, ...(effort ? ["--reasoning-effort", effort] : [])], { env: { ...process.env, OPENAI_API_KEY: "synthetic-test-key", REASONING_EFFORT: "", IMAGE_STUDIO_REASONING_EFFORT: "" }, timeout: 15000 });
    assert.equal(calls[0].reasoning.effort, effort || "high");
    assert.equal(calls.length, effort === "max" ? 2 : 1);
    assert.equal(calls.at(-1).reasoning.effort, effort === "max" ? "high" : effort || "high");
    assert.equal(await readFile(output, "utf8"), "test-image");
    if (effort === "max") assert.match(stdout, /max[\s\S]*自动调整为 high/);
  }
});
