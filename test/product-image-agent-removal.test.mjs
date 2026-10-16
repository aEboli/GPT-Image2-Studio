import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

import * as promptAgent from "../lib/prompt-agent.mjs";
import { ensureLazyViewModule, getLazyViewModuleUrl } from "../lib/view-mode-loader.mjs";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("removed product workbench has no navigation, panel, styles or lazy module", async () => {
  for (const path of ["../public/index.html", "../public/app.js", "../public/styles.css"]) {
    assert.doesNotMatch(await readSource(path), /product-agent|productAgent|图片裂变工作台/, path);
  }
  assert.equal(getLazyViewModuleUrl("product-agent"), "");
  const result = await ensureLazyViewModule("product-agent", {
    importer: () => assert.fail("removed workbench must not load a module"),
  });
  assert.equal(result.loaded, false);
  await assert.rejects(access(new URL("../public/lib/views/product-agent-view.mjs", import.meta.url)), { code: "ENOENT" });
});

test("old workbench deep links fall back to studio and supported views still resolve", async () => {
  const app = await readSource("../public/app.js");
  const body = app.match(/function getViewFromHash\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(body);
  for (const [hash, expected] of [["#product-agent", "studio"], ["#creation", "creation"], ["#image-decomposition", "image-decomposition"], ["#reference-analysis", "reference-analysis"]]) {
    assert.equal(vm.runInNewContext(`${body}\ngetViewFromHash()`, { window: { location: { hash } } }), expected);
  }
});

test("shared analysis no longer exposes the product group contract or server branch", async () => {
  assert.equal("PRODUCT_IMAGE_AGENT_MODE" in promptAgent, false);
  assert.equal("PRODUCT_IMAGE_AGENT_JSON_SCHEMA" in promptAgent, false);
  for (const path of ["../lib/prompt-agent.mjs", "../server.mjs"]) {
    assert.doesNotMatch(await readSource(path), /PRODUCT_IMAGE_AGENT|normalizeProductImageAgentJson|product-image-agent/, path);
  }
});

test("current feature documentation no longer advertises the removed workbench", async () => {
  for (const path of ["../README.md", "../README.zh-CN.md"]) {
    const source = await readSource(path);
    const currentFeatures = source.split(/^## (?:Version history|版本更新说明)/m)[0];
    assert.doesNotMatch(currentFeatures, /商品图裂变|product-image replication/i, path);
    assert.doesNotMatch(source, /^- \*\*(?:图片裂变工作台|Product image replication workbench)|^\| (?:图片裂变工作台|Product image replication)/im, path);
  }
});
