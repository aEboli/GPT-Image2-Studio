/* 浏览器本地的可复用 API 清单。
   一条记录是「一个 API」：接口地址 + 协议后缀 + 配套 Key。选中一条就整套切过来，
   Key 是地址的附属，不单独挑。
   刻意与 image-studio-browser-config-v1 分开存：浏览器私有配置是「当前生效的一份」，
   这里是「本机记住过哪些」。混在一个键里，删历史就会误伤当前配置。
   清单只留在浏览器本地，不进公开配置、请求载荷和服务端配置文件。 */

export const API_ENDPOINT_BOOK_STORAGE_KEY = "image-studio-api-endpoint-book-v1";
export const API_ENDPOINT_BOOK_LIMIT = 20;

function getLocalStorage() {
  return globalThis.window?.localStorage || null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

export function maskApiKeyForBook(apiKey) {
  const key = normalizeText(apiKey);
  if (!key) {
    return "";
  }

  if (key.length <= 8) {
    return `${key.slice(0, 2)}***`;
  }

  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

/* 地址在下拉里是主行，去掉协议头才看得清主机；末尾斜杠也去掉，
   避免同一个 API 因为多一个斜杠显示成两条。 */
export function formatApiEndpointLabel(baseUrl) {
  return normalizeText(baseUrl).replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/* 身份只取地址 + Key：用户心里「一个 API」是「某家 + 某把钥匙」，
   同一家同一把钥匙不该因为后缀不同而占两条。后缀跟着最近一次保存走。 */
function entryIdentity(entry) {
  return `${normalizeText(entry.baseUrl)}\n${normalizeText(entry.apiKey)}`;
}

function normalizeEntry(source) {
  const baseUrl = normalizeText(source?.baseUrl);
  const apiKey = normalizeText(source?.apiKey);
  // 没有地址或没有 Key 的条目无法「整套切过来」，不入清单。
  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl, endpointPath: normalizeText(source?.endpointPath), apiKey };
}

function normalizeEntries(values) {
  const seen = new Set();
  const entries = [];
  for (const value of Array.isArray(values) ? values : []) {
    const entry = normalizeEntry(value);
    if (!entry) {
      continue;
    }
    const identity = entryIdentity(entry);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    entries.push(entry);
    if (entries.length >= API_ENDPOINT_BOOK_LIMIT) {
      break;
    }
  }
  return entries;
}

/* 损坏的 JSON、被改成对象的 entries、storage 抛异常（隐私模式下 localStorage
   可能直接 throw）都按空清单处理，不能让历史清单阻断配置读取。 */
export function readApiEndpointBook(storage = getLocalStorage()) {
  try {
    const raw = storage?.getItem?.(API_ENDPOINT_BOOK_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return normalizeEntries(Array.isArray(parsed) ? parsed : parsed?.entries);
  } catch (_error) {
    return [];
  }
}

function writeApiEndpointBook(entries, storage = getLocalStorage()) {
  try {
    storage?.setItem?.(API_ENDPOINT_BOOK_STORAGE_KEY, JSON.stringify({ entries }));
  } catch (_error) {
    // 写不进去（配额满、隐私模式）不该影响本次配置保存，静默放过。
  }
  return entries;
}

/* 最近保存或最近选用的排最前，所以新条目一律插到队首再去重：已存在的旧条目会在
   normalizeEntries 里被后来的重复项跳过，等效于把它移到队首。 */
export function rememberApiEndpoints(sources, storage = getLocalStorage()) {
  const incoming = (Array.isArray(sources) ? sources : [sources]).map(normalizeEntry).filter(Boolean);
  const current = readApiEndpointBook(storage);
  if (incoming.length === 0) {
    return current;
  }

  return writeApiEndpointBook(normalizeEntries([...incoming, ...current]), storage);
}

export function forgetApiEndpoint(source, storage = getLocalStorage()) {
  const target = normalizeEntry(source);
  const current = readApiEndpointBook(storage);
  if (!target) {
    return current;
  }

  const identity = entryIdentity(target);
  const next = current.filter((entry) => entryIdentity(entry) !== identity);
  if (next.length === current.length) {
    return current;
  }

  return writeApiEndpointBook(next, storage);
}

/* 界面只拿 label 和 mask 渲染；明文 Key 留在 apiKey 字段里供控制器按索引回填，
   不进 DOM。 */
export function listApiEndpointBookEntries(storage = getLocalStorage()) {
  return readApiEndpointBook(storage).map((entry) => ({
    ...entry,
    label: formatApiEndpointLabel(entry.baseUrl),
    mask: maskApiKeyForBook(entry.apiKey),
  }));
}
