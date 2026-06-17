import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesPath = new URL("../public/styles.css", import.meta.url);

function getRule(styles, selector) {
  const normalized = styles.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(selector);
  assert.notEqual(start, -1, `Expected ${selector} rule to exist`);
  const open = normalized.indexOf("{", start);
  const close = normalized.indexOf("\n}", open);
  assert.notEqual(open, -1, `Expected ${selector} rule to open`);
  assert.notEqual(close, -1, `Expected ${selector} rule to close`);
  return normalized.slice(open + 1, close);
}

test("PPT desktop workspace keeps all sections inside the active viewport", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const pptStyles = styles.slice(styles.indexOf("/* PPT presentation generator */"));
  const pptViewRule = getRule(pptStyles, ".ppt-view");
  const pptWorkspaceRule = getRule(pptStyles, ".ppt-workspace");
  const pptPanelRule = getRule(pptStyles, ".ppt-settings-panel,\n.ppt-result-panel");
  const pptScrollRule = getRule(pptStyles, ".ppt-form,\n.ppt-slide-list,\n.ppt-record-list");

  assert.match(pptViewRule, /min-height:\s*0;/);
  assert.match(pptViewRule, /height:\s*100%;/);
  assert.match(
    pptWorkspaceRule,
    /grid-template-columns:\s*var\(--studio-grid-left,\s*392px\)\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(pptWorkspaceRule, /min-height:\s*0;/);
  assert.match(pptWorkspaceRule, /height:\s*100%;/);
  assert.match(pptWorkspaceRule, /overflow:\s*hidden;/);
  assert.match(pptPanelRule, /height:\s*100%;/);
  assert.match(pptPanelRule, /max-height:\s*100%;/);
  assert.match(pptPanelRule, /overflow:\s*hidden;/);
  assert.match(pptPanelRule, /display:\s*flex;/);
  assert.match(pptPanelRule, /flex-direction:\s*column;/);
  assert.match(pptScrollRule, /min-height:\s*0;/);
  assert.match(pptScrollRule, /overflow:\s*auto;/);
  assert.doesNotMatch(pptStyles, /\.ppt-history-panel|\.ppt-history-list|\.ppt-history-item/);
  assert.match(styles, /html\[data-ui-layout="stacked"\] \.ppt-workspace,/);
  assert.match(styles, /html\[data-ui-layout="stacked"\] \.ppt-settings-panel,/);
});
