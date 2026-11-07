import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("真实浏览器验证自动开关、实际格式高亮、禁用选择及五种格式单行布局", async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const electron = join(root, "node_modules/electron/dist/electron.exe");
  try { await access(electron); } catch { t.skip("Electron runtime is unavailable"); return; }
  const profile = await mkdtemp(join(tmpdir(), "studio-prompt-output-layout-"));
  t.after(() => rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 }));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const fixture = fileURLToPath(new URL("./fixtures/prompt-output-format-layout-probe.mjs", import.meta.url));
  const result = await promisify(execFile)(electron, [fixture, profile], { cwd: root, env, windowsHide: true, timeout: 20000 });
  const { layouts, manual, otherModes } = JSON.parse(result.stdout.match(/PROMPT_OUTPUT_LAYOUT=(.+)/)[1]);
  assert.equal(layouts.length, 6);
  for (const layout of layouts) {
    assert.ok(layout.width > 0);
    assert.ok(layout.left >= 0 && layout.right <= layout.viewport + 1, '格式入口在视口内');
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, "视口 " + layout.viewport + " 不横向溢出");
    assert.equal(layout.autoSelected, "true");
    assert.equal(layout.toggleInHeading, true);
    assert.equal(layout.allDisabled, true);
    assert.deepEqual(layout.selected, [layout.decision.format]);
    assert.equal(layout.highlighted, true, '禁用时实际格式保留高亮');
    assert.equal(layout.buttons.length, 5);
    assert.ok(layout.buttons.every((button) => Math.abs(button.top - layout.buttons[0].top) < 1), '包含 SVG 的五种格式保持同一行');
    assert.ok(layout.buttons.every((button) => button.textFits && button.left >= layout.left && button.right <= layout.right), '按钮完整且文字不溢出');
    assert.equal(layout.error, "");
    assert.equal(layout.framesVisible, layout.decision.format === 'gif');
    assert.equal(layout.lowerFormatHidden, true, "提示词页不重复显示下方格式");
    assert.equal(layout.hintCount, 0, '输出格式区域没有文字提示节点');
  }
  assert.equal(manual.selected, "png");
  assert.equal(manual.allEnabled, true);
  assert.equal(manual.automatic, 'false');
  assert.equal(manual.decision.format, "png");
  assert.equal(manual.framesVisible, false);
  assert.equal(manual.error, "");
  assert.equal(manual.hintCount, 0, '手动格式冲突时也不显示文字提示');
  assert.deepEqual(otherModes, [
    { shortcutVisible: false, lowerVisible: true, selected: "png" },
    { shortcutVisible: false, lowerVisible: true, selected: "png" },
    { shortcutVisible: true, lowerVisible: false, selected: "png" },
  ]);
});
