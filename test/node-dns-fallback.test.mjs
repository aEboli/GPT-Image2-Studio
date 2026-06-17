import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  configureNodeDnsFallback,
  parseNodeDnsFallbackServers,
} from "../lib/node-dns-fallback.mjs";

test("node DNS fallback prepends stable public resolvers before existing servers", () => {
  const calls = [];
  const dns = {
    getServers: () => ["192.0.2.53", "1.1.1.1"],
    setServers: (servers) => calls.push(servers),
  };

  const configured = configureNodeDnsFallback({ dns, env: {} });

  assert.equal(configured, true);
  assert.deepEqual(calls, [["223.5.5.5", "1.1.1.1", "192.0.2.53"]]);
});

test("node DNS fallback accepts custom servers and can be disabled", () => {
  assert.deepEqual(parseNodeDnsFallbackServers("8.8.8.8, 1.1.1.1;223.5.5.5"), [
    "8.8.8.8",
    "1.1.1.1",
    "223.5.5.5",
  ]);

  const calls = [];
  const dns = {
    getServers: () => ["192.0.2.53"],
    setServers: (servers) => calls.push(servers),
  };

  const disabled = configureNodeDnsFallback({
    dns,
    env: { IMAGE_STUDIO_DISABLE_DNS_FALLBACK: "1", IMAGE_STUDIO_DNS_FALLBACK_SERVERS: "8.8.8.8" },
  });
  const configured = configureNodeDnsFallback({
    dns,
    env: { IMAGE_STUDIO_DNS_FALLBACK_SERVERS: "8.8.8.8" },
  });

  assert.equal(disabled, false);
  assert.equal(configured, true);
  assert.deepEqual(calls, [["8.8.8.8", "192.0.2.53"]]);
});

test("node DNS fallback patches lookup to resolve through fallback servers after OS lookup fails", async () => {
  const setServerCalls = [];
  const resolveCalls = [];
  const originalLookup = (_hostname, options, callback) => {
    const done = typeof options === "function" ? options : callback;
    queueMicrotask(() => done(Object.assign(new Error("system resolver failed"), { code: "ENOTFOUND" })));
  };
  const dns = {
    getServers: () => ["192.0.2.53"],
    setServers: (servers) => setServerCalls.push(servers),
    lookup: originalLookup,
    Resolver: class {
      setServers(servers) {
        this.servers = servers;
      }

      resolve4(hostname, callback) {
        resolveCalls.push({ hostname, servers: this.servers, type: "A" });
        callback(null, ["198.51.100.10"]);
      }

      resolve6(hostname, callback) {
        resolveCalls.push({ hostname, servers: this.servers, type: "AAAA" });
        callback(new Error("no AAAA"));
      }
    },
  };

  const configured = configureNodeDnsFallback({ dns, env: {} });
  const result = await new Promise((resolve, reject) => {
    dns.lookup("api.example.test", (error, address, family) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ address, family });
    });
  });

  assert.equal(configured, true);
  assert.notEqual(dns.lookup, originalLookup);
  assert.deepEqual(result, { address: "198.51.100.10", family: 4 });
  assert.deepEqual(setServerCalls, [["223.5.5.5", "1.1.1.1", "192.0.2.53"]]);
  assert.deepEqual(resolveCalls, [
    { hostname: "api.example.test", servers: ["223.5.5.5"], type: "A" },
  ]);
});

test("node DNS fallback lookup patch honors custom server order and all results", async () => {
  const resolveCalls = [];
  const dns = {
    getServers: () => ["192.0.2.53"],
    setServers: () => {},
    lookup: (_hostname, options, callback) => {
      const done = typeof options === "function" ? options : callback;
      queueMicrotask(() => done(Object.assign(new Error("temporary resolver failure"), { code: "EAI_AGAIN" })));
    },
    Resolver: class {
      setServers(servers) {
        this.servers = servers;
      }

      resolve4(hostname, callback) {
        resolveCalls.push({ hostname, servers: this.servers, type: "A" });
        if (this.servers[0] === "8.8.8.8") {
          callback(new Error("first custom server failed"));
          return;
        }
        callback(null, ["198.51.100.20", "198.51.100.21"]);
      }

      resolve6(_hostname, callback) {
        callback(new Error("no AAAA"));
      }
    },
  };

  configureNodeDnsFallback({
    dns,
    env: { IMAGE_STUDIO_DNS_FALLBACK_SERVERS: "8.8.8.8 9.9.9.9" },
  });
  const addresses = await new Promise((resolve, reject) => {
    dns.lookup("api.example.test", { all: true, family: 4 }, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results);
    });
  });

  assert.deepEqual(addresses, [
    { address: "198.51.100.20", family: 4 },
    { address: "198.51.100.21", family: 4 },
  ]);
  assert.deepEqual(resolveCalls, [
    { hostname: "api.example.test", servers: ["8.8.8.8"], type: "A" },
    { hostname: "api.example.test", servers: ["9.9.9.9"], type: "A" },
  ]);
});

test("node DNS fallback does not patch lookup when disabled", () => {
  const originalLookup = () => {};
  const dns = {
    getServers: () => ["192.0.2.53"],
    setServers: () => {
      throw new Error("setServers should not run");
    },
    lookup: originalLookup,
    Resolver: class {},
  };

  const configured = configureNodeDnsFallback({
    dns,
    env: { IMAGE_STUDIO_DISABLE_DNS_FALLBACK: "1" },
  });

  assert.equal(configured, false);
  assert.equal(dns.lookup, originalLookup);
});

test("node DNS fallback lets resolver errors reach the server warning log", () => {
  const dns = {
    getServers: () => ["192.0.2.53"],
    setServers: () => {
      throw new Error("bad resolver");
    },
  };

  assert.throws(
    () => configureNodeDnsFallback({ dns, env: {} }),
    /bad resolver/,
  );
});

test("server guards DNS fallback setup with a stable warning", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.match(server, /import dns from "node:dns";/);
  assert.match(server, /import \{ configureNodeDnsFallback \} from "\.\/lib\/node-dns-fallback\.mjs";/);
  assert.match(server, /try \{\s*configureNodeDnsFallback\(\{ dns \}\);\s*\} catch \(error\) \{/);
  assert.match(server, /console\.warn\(`DNS fallback 配置失败：\$\{error instanceof Error \? error\.message : String\(error\)\}`\);/);
});

test("package docs expose DNS fallback defaults and runtime switches", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const installerDoc = await readFile(new URL("../docs/windows-installer.md", import.meta.url), "utf8");
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  for (const source of [readme, installerDoc, envExample]) {
    assert.match(source, /223\.5\.5\.5/);
    assert.match(source, /1\.1\.1\.1/);
    assert.match(source, /IMAGE_STUDIO_DISABLE_DNS_FALLBACK/);
    assert.match(source, /IMAGE_STUDIO_DNS_FALLBACK_SERVERS/);
  }

  assert.match(readme, /逗号、分号或空白分隔/);
  assert.match(readme, /dns\.lookup/);
  assert.match(installerDoc, /安装包会继承启动环境变量/);
  assert.match(installerDoc, /命令行/);
  assert.match(envExample, /IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0/);
});
