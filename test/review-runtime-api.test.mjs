import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("public serverless handlers reject credential redirection, configuration writes and PPT traversal", { timeout: 15000 }, async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "studio-reviewed-api-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  const source = `
import assert from 'node:assert/strict';
import { Server, createServer } from 'node:http';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
let upstreamRequests = 0;
const upstream = createServer((request, response) => {
  upstreamRequests += 1;
  assert.equal(request.headers.authorization, 'Bearer request-owned-key');
  request.resume();
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ data: [{ id: 'probe-model' }] }));
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
const upstreamUrl = 'http://127.0.0.1:' + upstream.address().port + '/v1';
const listen = Server.prototype.listen;
Server.prototype.listen = function () { Server.prototype.listen = listen; return this; };
const runtime = await import('./server.mjs');
const server = createServer(runtime.default);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const studioUrl = 'http://127.0.0.1:' + server.address().port;
try {
  const write = await fetch(studioUrl + '/api/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directImageBaseUrl: upstreamUrl }),
  });
  assert.equal(write.status, 403);
  await write.arrayBuffer();
  for (const [route, baseField, target] of [
    ['b', 'directImageBaseUrl', 'direct-image'], ['b', 'directTextBaseUrl', 'direct-responses'],
    ['c', 'protocolBaseUrl', 'protocol'], ['d', 'grokBaseUrl', 'grok'],
  ]) {
    const form = new FormData();
    form.set('imageRoute', route); form.set(baseField, upstreamUrl); form.set('modelTarget', target);
    const response = await fetch(studioUrl + '/api/models', { method: 'POST', body: form });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /API Key/);
  }
  assert.equal(upstreamRequests, 0);
  const form = new FormData();
  form.set('imageRoute', 'b'); form.set('directImageBaseUrl', upstreamUrl); form.set('directImageApiKey', 'request-owned-key');
  const own = await fetch(studioUrl + '/api/models', { method: 'POST', body: form });
  assert.equal(own.status, 200); await own.arrayBuffer();
  assert.equal(upstreamRequests, 1);
  const outputDir = process.env.IMAGE_STUDIO_OUTPUT_DIR;
  await writeFile(join(outputDir, 'slide.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=', 'base64'));
  const protectedPath = join(outputDir, '..', 'protected.json');
  await writeFile(protectedPath, 'protected');
  const complete = await fetch(studioUrl + '/api/ppt/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckId: '../../../protected', apiKey: 'request-owned-key',
      outline: { title: 'Probe', slides: [{ title: 'Page' }] },
      existingSlides: [{ slideNumber: 1, relativePath: 'slide.png' }],
    }),
  });
  const stream = await complete.text();
  assert.match(stream, /event: error/);
  assert.doesNotMatch(stream, /event: deck_saved/);
  assert.equal(await readFile(protectedPath, 'utf8'), 'protected');
  console.log('REVIEWED_API_BOUNDARIES_PASS');
} finally {
  server.closeAllConnections(); upstream.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => upstream.close(resolve));
}
`;
  const result = await promisify(execFile)(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {
      ...process.env,
      HOST: "127.0.0.1", PORT: "0", VERCEL: "1",
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local"),
      IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "0",
      DIRECT_IMAGE_BASE_URL: "https://image.example.test/v1", DIRECT_IMAGE_API_KEY: "synthetic-server-key",
      DIRECT_TEXT_BASE_URL: "https://text.example.test/v1", DIRECT_TEXT_API_KEY: "synthetic-text-key",
      PROTOCOL_BASE_URL: "https://gemini.example.test/v1", PROTOCOL_API_KEY: "synthetic-gemini-key",
      GROK_BASE_URL: "https://grok.example.test/v1", GROK_API_KEY: "synthetic-grok-key",
    },
    timeout: 12000, windowsHide: true,
  });
  assert.match(result.stdout, /REVIEWED_API_BOUNDARIES_PASS/);
});
