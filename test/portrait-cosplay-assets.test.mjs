import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../public/app.js", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);
const assetModulePath = new URL("../lib/portrait-accessory-assets.mjs", import.meta.url);
const attributionPath = new URL("../public/assets/portrait-accessories/ATTRIBUTION.md", import.meta.url);
const shellAssetVersion = "20260705-ui-scale-90-1";

const COSPLAY_ASSETS = [
  ["cosplay-shrine-miko", "巫女COS", "cosplay-shrine-miko.png", /cosplay portrait[\s\S]*costume[\s\S]*props/],
  ["cosplay-magical-girl", "魔法少女COS", "cosplay-magical-girl.png", /cosplay portrait[\s\S]*star wand[\s\S]*props/],
  ["cosplay-cyber-warrior", "赛博战士COS", "cosplay-cyber-warrior.png", /cosplay portrait[\s\S]*armor[\s\S]*props/],
  ["cosplay-fantasy-knight", "幻想骑士COS", "cosplay-fantasy-knight.png", /cosplay portrait[\s\S]*cape[\s\S]*props/],
];

test("portrait accessory library adds COS cosplay references with prompt metadata", async () => {
  const app = await readFile(appPath, "utf8");
  const assetModule = await readFile(assetModulePath, "utf8");
  const index = await readFile(indexPath, "utf8");
  const attribution = await readFile(attributionPath, "utf8");

  assert.match(assetModule, /value:\s*"hat",\s*label:\s*"帽子"[\s\S]*value:\s*"cosplay",\s*label:\s*"COS"/);
  assert.doesNotMatch(app, /COS 极简白T|COS 廓形西装|COS 直筒长裤|COS 极简直筒裙/);
  assert.match(app, /portrait-accessory-assets\.mjs\?v=20260528-portrait-assets-sort-1/);
  assert.match(app, /function getPortraitAccessoryPromptSummary\(\)/);
  assert.match(app, /applyPortraitAccessoryReferenceFiles\(\[file\],\s*\{\s*asset:\s*selectedVariant\s*\}\)/);
  assert.match(
    app,
    /formData\.set\("notes",\s*\[rawPortraitNotes,\s*getPortraitAccessoryPromptSummary\(\)\]\.filter\(Boolean\)\.join\("\\n\\n"\)\)/,
  );
  assert.match(index, new RegExp(`app\\.js\\?v=${shellAssetVersion}`));
  assert.match(attribution, /cosplay character reference assets/);
  assert.match(attribution, /generic anime-inspired and fantasy character archetypes/);

  for (const [id, label, filename, promptPattern] of COSPLAY_ASSETS) {
    const asset = await readFile(new URL(`../public/assets/portrait-accessories/${filename}`, import.meta.url));
    assert.equal(asset[0], 0x89, filename);
    assert.equal(asset[1], 0x50, filename);
    assert.equal(asset[2], 0x4e, filename);
    assert.equal(asset[3], 0x47, filename);
    assert.match(
      assetModule,
      new RegExp(`asset\\("${id}",\\s*"cosplay",\\s*"${label}"[\\s\\S]*`),
    );
    assert.match(assetModule, promptPattern);
  }
});
