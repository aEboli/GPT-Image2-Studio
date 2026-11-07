import { app, BrowserWindow } from "electron";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
app.setPath("userData", process.argv[2]);
app.disableHardwareAcceleration();
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    const relative = path.startsWith("/lib/") ? path.slice(1) : `public/${path === "/" ? "index.html" : path.slice(1)}`;
    let content = await readFile(resolve(root, relative));
    if (path === "/") content = content.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
    response.setHeader("Content-Type", path.endsWith(".mjs") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path === "/" ? "text/html; charset=utf-8" : "application/octet-stream");
    response.end(content);
  } catch {
    response.statusCode = 404;
    response.end();
  }
});

async function run() {
  let window;
  try {
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    window = new BrowserWindow({ show: false, width: 1280, height: 1000, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
    await window.webContents.executeJavaScript(`(async () => {
      const { createDirectImageModelMappingView } = await import('/lib/direct-image-model-mapping-view.mjs');
      document.querySelector('#configDrawer').removeAttribute('inert');
      document.querySelector('#configDrawer').classList.add('open');
      const form = document.querySelector('#configForm');
      form.dataset.configSection = 'gpt'; form.dataset.imageRoute = 'b';
      for (const input of form.querySelectorAll('input[name="imageRoute"], input[name="gptImageRoute"]')) input.checked = input.value === 'b';
      const root = document.querySelector('#directImageModelMappings');
      const view = createDirectImageModelMappingView({ root });
      view.write([{ source: 'gpt-image-2.6-sunburst', target: 'IMAGE-2.6' }]);
      root.querySelector('[data-mapping-add]').click();
      const inputs = root.querySelectorAll('input');
      inputs[2].value = 'custom-' + 'very-long-model-id-'.repeat(12); inputs[3].value = 'provider-id';
      inputs[2].dispatchEvent(new Event('input'));
      view.setCandidates(['IMAGE-2.6', 'fetched-custom-model']);
      await document.fonts.ready;
    })()`);
    const results = [];
    for (const width of [360, 768, 1280]) {
      window.setContentSize(width, 1000);
      results.push(await window.webContents.executeJavaScript(`(async () => {
        await new Promise((done) => setTimeout(done, 300));
        const root = document.querySelector('#directImageModelMappings');
        root.scrollIntoView({ block: 'center' });
        const rect = (element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
        return {
          viewport: innerWidth,
          panel: rect(document.querySelector('.config-panel')),
          root: rect(root), stream: rect(document.querySelector('.direct-image-stream-field')),
          text: rect(document.querySelector('.direct-text-endpoint-field')),
          rows: [...root.querySelectorAll('.direct-image-model-mapping-row')].map((row) => ({ bounds: rect(row), scrollWidth: row.scrollWidth, clientWidth: row.clientWidth })),
          inputs: [...root.querySelectorAll('input')].map((input) => ({ bounds: rect(input), radius: getComputedStyle(input).borderRadius, list: input.list?.id, value: input.value })),
          candidates: [...root.querySelectorAll('option')].map((option) => option.value),
        };
      })()`));
    }
    process.stdout.write(`DIRECT_IMAGE_MAPPING_LAYOUT=${JSON.stringify(results)}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  } finally {
    window?.destroy();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    app.quit();
  }
}

app.whenReady().then(run);
