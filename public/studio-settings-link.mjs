const targets = new Set(['http://127.0.0.1:4179', 'http://localhost:4179']);
export function installSettingsLink(win, { restore, read, select }) {
  const params = new URLSearchParams(win.location.hash.slice(1));
  const target = params.get('target'), nonce = params.get('nonce');
  if (win.top !== win || !win.opener || !targets.has(target) || !/^[a-f0-9]{48}$/.test(nonce || '')) return false;
  let used = false;
  const receive = async event => {
    if (used || event.source !== win.opener || event.origin !== target || event.data?.type !== 'shein-studio-request' || event.data.nonce !== nonce) return;
    used = true;
    win.removeEventListener('message', receive);
    try {
      await restore();
      const config = read();
      if (!config) throw new Error('missing config');
      const selected = select(config);
      if (!selected.apiKey || !selected.responsesModel) throw new Error('missing text config');
      const payload = Object.fromEntries(['baseUrl', 'endpointPath', 'apiKey', 'responsesModel'].map(key => [key, selected[key]]));
      win.opener.postMessage({ type: 'shein-studio-settings', nonce, config: payload }, target);
    } catch {
      win.opener.postMessage({ type: 'shein-studio-settings', nonce, error: '请先在图片软件中保存文字模型设置，再重试同步。' }, target);
    }
  };
  win.addEventListener('message', receive);
  win.opener.postMessage({ type: 'shein-studio-ready', nonce }, target);
  win.setTimeout(() => win.removeEventListener('message', receive), 60000);
  return true;
}
