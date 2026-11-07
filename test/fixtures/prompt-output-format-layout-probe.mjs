import { app, BrowserWindow } from "electron";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
app.setPath("userData", process.argv[2]);
app.disableHardwareAcceleration();
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    let content = await readFile(resolve(root, path.startsWith("/lib/") ? path.slice(1) : "public/" + (path === "/" ? "index.html" : path.slice(1))));
    if (path === "/") content = content.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
    response.setHeader("Content-Type", path.endsWith(".mjs") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path === "/" ? "text/html; charset=utf-8" : "application/octet-stream");
    response.end(content);
  } catch { response.writeHead(404); response.end(); }
});

app.whenReady().then(async () => {
  let window;
  try {
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    window = new BrowserWindow({ show: false, width: 1280, height: 1000, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await window.loadURL("http://127.0.0.1:" + server.address().port + "/");
    await window.webContents.executeJavaScript(`(async () => {
      const { createImageOptionsView } = await import('/lib/image-options-view.mjs');
      const { getOutputFormatOptions } = await import('/lib/output-format-options.mjs');
      const { resolvePromptOutputFormat } = await import('/lib/prompt-output-format.mjs');
      const { getStudioDensitySettings } = await import('/lib/studio-density.mjs');
      window.applyOutputProbeDensity = () => {
        const settings = getStudioDensitySettings({ width: innerWidth, height: innerHeight });
        document.documentElement.dataset.uiLayout = settings.layoutMode;
        for (const [name, value] of Object.entries(settings.variables)) document.documentElement.style.setProperty(name, value);
      };
      const select = document.querySelector('#outputFormatInput');
      for (const item of getOutputFormatOptions({ special: true, automatic: true })) select.add(new Option(item.label, item.value));
      select.value = 'auto';
      const prompt = document.querySelector('#promptInput');
      prompt.value = '生成一张会循环播放的 GIF 动画';
      let model = 'gpt-image-2', promptMode = true;
      const decision = () => resolvePromptOutputFormat({ selection: select.value, prompt: prompt.value, imageModel: model });
      const view = createImageOptionsView({ root: document.querySelector('#image26Options'), promptRoot: document.querySelector('#promptImage26Controls'), formatInput: select, getModel: () => model, isPromptMode: () => promptMode, getOutputDecision: decision });
      prompt.addEventListener('input', () => view.refresh());
      view.refresh();
      document.querySelector('.parameter-settings').open = true;
      window.outputProbe = { view, decision, setContext(mode, nextModel) { promptMode = mode; model = nextModel; view.refresh(); } };
      await document.fonts.ready;
    })()`);
    const layouts = [];
    const screenshots = resolve(root, "test-results/prompt-output-format-visual");
    await mkdir(screenshots, { recursive: true });
    for (const width of [360, 1280]) for (const format of ['png', 'gif', 'svg']) {
      window.setContentSize(width, 1000);
      await window.webContents.executeJavaScript('document.querySelector("#promptInput").value = ' + JSON.stringify(format === 'png' ? '生成一只小猫' : '请输出 ' + format) + '; window.outputProbe.setContext(true, ' + JSON.stringify(format === 'svg' ? 'gpt-image-2.6-sunburst' : 'gpt-image-2') + ');');
      const layout = await window.webContents.executeJavaScript(`(async () => {
        window.applyOutputProbeDensity();
        await new Promise((done) => setTimeout(done, 200));
        const root = document.querySelector('#promptImage26Controls');
        root.scrollIntoView({ block: 'center' });
        const bounds = root.getBoundingClientRect();
        const toggle = root.querySelector('[data-prompt-output-auto]');
        const buttons = [...root.querySelectorAll('[data-prompt-output-format]')];
        const active = buttons.filter((button) => button.getAttribute('aria-pressed') === 'true');
        return { viewport: innerWidth, width: bounds.width, left: bounds.left, right: bounds.right, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, decision: window.outputProbe.decision(), error: window.outputProbe.view.getPromptError(), hintCount: root.querySelectorAll('[data-prompt-output-hint], .field-hint').length, autoSelected: toggle.getAttribute('aria-checked'), toggleInHeading: toggle.parentElement.classList.contains('prompt-output-heading'), allDisabled: buttons.every((button) => button.disabled), selected: active.map((button) => button.dataset.promptOutputFormat), highlighted: active.length === 1 && getComputedStyle(active[0]).backgroundColor !== getComputedStyle(buttons.find((button) => button !== active[0])).backgroundColor, buttons: buttons.map((button) => ({ top: button.getBoundingClientRect().top, left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right, textFits: button.scrollWidth <= button.clientWidth + 1 })), framesVisible: !root.querySelector('[data-prompt-output-gif]').hidden, lowerFormatHidden: document.querySelector('#outputFormatInput').closest('label').hidden };
      })()`);
      layouts.push(layout);
      await writeFile(resolve(screenshots, 'automatic-' + format + '-' + width + '.png'), (await window.webContents.capturePage()).toPNG());
    }
    const manual = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-prompt-output-auto]').click();
      document.querySelector('[data-prompt-output-format=png]').click();
      const root = document.querySelector('#promptImage26Controls');
      return { decision: window.outputProbe.decision(), selected: document.querySelector('#outputFormatInput').value, allEnabled: [...root.querySelectorAll('[data-prompt-output-format]')].every((button) => !button.disabled), automatic: root.querySelector('[data-prompt-output-auto]').getAttribute('aria-checked'), error: window.outputProbe.view.getPromptError(), hintCount: root.querySelectorAll('[data-prompt-output-hint], .field-hint').length, framesVisible: !root.querySelector('[data-prompt-output-gif]').hidden };
    })()`);
    const otherModes = await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('#outputFormatInput');
      const field = select.closest('label');
      return [[false, 'gpt-image-2'], [true, ''], [true, 'gpt-image-2']].map(([mode, model]) => {
        window.outputProbe.setContext(mode, model);
        return { shortcutVisible: !document.querySelector('#promptImage26Controls').hidden, lowerVisible: getComputedStyle(field).display !== 'none', selected: select.value };
      });
    })()`);
    process.stdout.write("PROMPT_OUTPUT_LAYOUT=" + JSON.stringify({ layouts, manual, otherModes }) + "\n");
  } catch (error) { process.stderr.write(String(error.stack || error)); process.exitCode = 1; }
  finally { window?.destroy(); server.closeAllConnections(); await new Promise((done) => server.close(done)); app.quit(); }
});
