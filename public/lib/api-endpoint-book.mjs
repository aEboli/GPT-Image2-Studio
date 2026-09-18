/* 浏览器本地的可复用 API 清单。
   一条记录是「一个 API」：接口地址 + 协议后缀 + 配套 Key。选中一条就整套切过来，
   Key 是地址的附属，不单独挑。

   清单按调用通道隔离：路由、直连生图、直连文本/视觉、Gemini、Grok 各自维护自己的
   最近使用列表。这样在某个通道保存或删除 API，不会把另一个通道的候选项一起改掉。
   清单只留在浏览器本地，不进公开配置、请求载荷和服务端配置文件。 */

export const API_ENDPOINT_BOOK_STORAGE_KEY = "image-studio-api-endpoint-books-v2";
export const API_ENDPOINT_BOOK_LEGACY_STORAGE_KEY = "image-studio-api-endpoint-book-v1";
export const API_ENDPOINT_BOOK_LIMIT = 20;

export const API_ENDPOINT_BOOK_TARGET_ROUTE = "route";
export const API_ENDPOINT_BOOK_TARGET_DIRECT_IMAGE = "direct-image";
export const API_ENDPOINT_BOOK_TARGET_DIRECT_TEXT = "direct-text";
export const API_ENDPOINT_BOOK_TARGET_PROTOCOL = "protocol";
export const API_ENDPOINT_BOOK_TARGET_GROK = "grok";
export const API_ENDPOINT_BOOK_TARGETS = Object.freeze([
  API_ENDPOINT_BOOK_TARGET_ROUTE,
  API_ENDPOINT_BOOK_TARGET_DIRECT_IMAGE,
  API_ENDPOINT_BOOK_TARGET_DIRECT_TEXT,
  API_ENDPOINT_BOOK_TARGET_PROTOCOL,
  API_ENDPOINT_BOOK_TARGET_GROK,
]);

function getLocalStorage() {
  return globalThis.window?.localStorage || null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isBookTarget(value) {
  return API_ENDPOINT_BOOK_TARGETS.includes(normalizeText(value));
}

function normalizeTarget(value) {
  return isBookTarget(value) ? normalizeText(value) : API_ENDPOINT_BOOK_TARGET_ROUTE;
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

function createEmptyBooks() {
  return API_ENDPOINT_BOOK_TARGETS.reduce((books, target) => {
    books[target] = [];
    return books;
  }, {});
}

function readStorageValue(storage, key) {
  try {
    return storage?.getItem?.(key) || "";
  } catch (_error) {
    return "";
  }
}

function parseStorageValue(raw) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function readBooksFromParsed(parsed) {
  const books = createEmptyBooks();
  if (Array.isArray(parsed)) {
    // v1 的无归属历史无法可靠地分配给五个通道，只迁移到默认的路由通道。
    books[API_ENDPOINT_BOOK_TARGET_ROUTE] = normalizeEntries(parsed);
    return books;
  }

  if (!parsed || typeof parsed !== "object") {
    return books;
  }

  // 兼容 v1 的 { entries: [...] } 结构，同样只归入路由通道，绝不复制到所有入口。
  if (Array.isArray(parsed.entries)) {
    books[API_ENDPOINT_BOOK_TARGET_ROUTE] = normalizeEntries(parsed.entries);
  }

  const sourceBooks = parsed.books && typeof parsed.books === "object" ? parsed.books : parsed;
  API_ENDPOINT_BOOK_TARGETS.forEach((target) => {
    if (Array.isArray(sourceBooks[target])) {
      books[target] = normalizeEntries(sourceBooks[target]);
    }
  });
  return books;
}

/* 损坏的 JSON、被改成对象的 entries、storage 抛异常（隐私模式下 localStorage
   可能直接 throw）都按空清单处理，不能让历史清单阻断配置读取。 */
export function readApiEndpointBooks(storage = getLocalStorage()) {
  const current = parseStorageValue(readStorageValue(storage, API_ENDPOINT_BOOK_STORAGE_KEY));
  if (current !== null) {
    return readBooksFromParsed(current);
  }

  // 旧版本键只作为一次无副作用的兼容读取；下一次保存任一通道时会写入 v2 结构。
  return readBooksFromParsed(parseStorageValue(readStorageValue(storage, API_ENDPOINT_BOOK_LEGACY_STORAGE_KEY)));
}

function writeApiEndpointBooks(books, storage = getLocalStorage()) {
  const normalizedBooks = createEmptyBooks();
  API_ENDPOINT_BOOK_TARGETS.forEach((target) => {
    normalizedBooks[target] = normalizeEntries(books?.[target]);
  });

  try {
    storage?.setItem?.(API_ENDPOINT_BOOK_STORAGE_KEY, JSON.stringify({ version: 2, books: normalizedBooks }));
  } catch (_error) {
    // 写不进去（配额满、隐私模式）不该影响本次配置保存，静默放过。
  }
  return normalizedBooks;
}

function resolveReadArgs(targetOrStorage, maybeStorage) {
  if (isBookTarget(targetOrStorage)) {
    return { target: normalizeTarget(targetOrStorage), storage: maybeStorage === undefined ? getLocalStorage() : maybeStorage };
  }
  return { target: API_ENDPOINT_BOOK_TARGET_ROUTE, storage: targetOrStorage === undefined ? getLocalStorage() : targetOrStorage };
}

/* 传入 target 可读取指定通道；保留 readApiEndpointBook(storage) 形式给旧调用方，
   旧形式只代表默认路由通道，不会重新引入跨通道共享。 */
export function readApiEndpointBook(targetOrStorage, maybeStorage) {
  const { target, storage } = resolveReadArgs(targetOrStorage, maybeStorage);
  return readApiEndpointBooks(storage)[target];
}

function resolveRememberArgs(targetOrSources, sourcesOrStorage, maybeStorage) {
  if (isBookTarget(targetOrSources)) {
    return {
      target: normalizeTarget(targetOrSources),
      sources: sourcesOrStorage,
      storage: maybeStorage === undefined ? getLocalStorage() : maybeStorage,
    };
  }
  return {
    target: API_ENDPOINT_BOOK_TARGET_ROUTE,
    sources: targetOrSources,
    storage: sourcesOrStorage === undefined ? getLocalStorage() : sourcesOrStorage,
  };
}

/* 最近保存或最近选用的排最前，所以新条目一律插到队首再去重：已存在的旧条目会在
   normalizeEntries 里被后来的重复项跳过，等效于把它移到队首。 */
export function rememberApiEndpoints(targetOrSources, sourcesOrStorage, maybeStorage) {
  const { target, sources, storage } = resolveRememberArgs(targetOrSources, sourcesOrStorage, maybeStorage);
  const incoming = (Array.isArray(sources) ? sources : [sources]).map(normalizeEntry).filter(Boolean);
  const books = readApiEndpointBooks(storage);
  if (incoming.length === 0) {
    return books[target];
  }

  books[target] = normalizeEntries([...incoming, ...books[target]]);
  return writeApiEndpointBooks(books, storage)[target];
}

function resolveForgetArgs(targetOrSource, sourceOrStorage, maybeStorage) {
  if (isBookTarget(targetOrSource)) {
    return {
      target: normalizeTarget(targetOrSource),
      source: sourceOrStorage,
      storage: maybeStorage === undefined ? getLocalStorage() : maybeStorage,
    };
  }
  return {
    target: API_ENDPOINT_BOOK_TARGET_ROUTE,
    source: targetOrSource,
    storage: sourceOrStorage === undefined ? getLocalStorage() : sourceOrStorage,
  };
}

export function forgetApiEndpoint(targetOrSource, sourceOrStorage, maybeStorage) {
  const { target, source, storage } = resolveForgetArgs(targetOrSource, sourceOrStorage, maybeStorage);
  const targetEntry = normalizeEntry(source);
  const books = readApiEndpointBooks(storage);
  if (!targetEntry) {
    return books[target];
  }

  const identity = entryIdentity(targetEntry);
  const next = books[target].filter((entry) => entryIdentity(entry) !== identity);
  if (next.length === books[target].length) {
    return books[target];
  }

  books[target] = next;
  return writeApiEndpointBooks(books, storage)[target];
}

/* 界面只拿 label 和 mask 渲染；明文 Key 留在 apiKey 字段里供控制器按索引回填，
   不进 DOM。 */
export function listApiEndpointBookEntries(targetOrStorage, maybeStorage) {
  const { target, storage } = resolveReadArgs(targetOrStorage, maybeStorage);
  return readApiEndpointBooks(storage)[target].map((entry) => ({
    ...entry,
    label: formatApiEndpointLabel(entry.baseUrl),
    mask: maskApiKeyForBook(entry.apiKey),
  }));
}
