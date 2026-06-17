import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);
const accessoryAssetsPath = new URL("../lib/portrait-accessory-assets.mjs", import.meta.url);
const locationSelectorPath = new URL("../lib/portrait-location-selector.mjs", import.meta.url);

test("portrait mode has independent navigation, routes and DOM refs", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /href="#portrait"[\s\S]*写真模式/);
  assert.match(html, /href="#portrait-record"[\s\S]*写真记录/);
  assert.match(html, /data-view-panel="portrait"/);
  assert.match(html, /data-view-panel="portrait-record"/);

  assert.match(app, /const CREATE_VIEW_IDS = new Set\(\[[\s\S]*"portrait"[\s\S]*\]\);/);
  assert.match(app, /const ASSET_VIEW_IDS = new Set\(\[[\s\S]*"portrait-record"[\s\S]*\]\);/);
  assert.match(app, /if \(window\.location\.hash === "#portrait"\)/);
  assert.match(app, /if \(window\.location\.hash === "#portrait-record"\)/);
  assert.match(app, /view === "portrait" \? "#portrait"/);
  assert.match(app, /view === "portrait-record"[\s\S]*\? "#portrait-record"/);
  assert.match(app, /portraitReferenceAnalyzeButton: document\.querySelector\("#portraitReferenceAnalyzeButton"\)/);
  assert.match(app, /portraitSubjectSummaryInput: document\.querySelector\("#portraitSubjectSummaryInput"\)/);
  assert.match(app, /portraitStyleInputs: \[\.\.\.document\.querySelectorAll\("\[name=\\\"portraitStyles\\\"\]"\)\]/);
  assert.match(app, /portraitShotTypeInputs: \[\.\.\.document\.querySelectorAll\("\[name=\\\"portraitShotTypes\\\"\]"\)\]/);
  assert.match(app, /portraitActionInputs: \[\.\.\.document\.querySelectorAll\("\[name=\\\"portraitActions\\\"\]"\)\]/);
  assert.match(app, /portraitRecordSetList: document\.querySelector\("#portraitRecordSetList"\)/);
});

test("portrait view has workspace and record styling isolated from creation", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.portrait-view\s*\{/);
  assert.match(styles, /\.portrait-workspace\s*\{/);
  assert.match(
    styles,
    /\.portrait-workspace\s*\{[\s\S]*grid-template-columns:\s*var\(--studio-grid-left,\s*392px\) minmax\(0, 1fr\);[\s\S]*gap:\s*var\(--studio-grid-gap,\s*14px\);/,
  );
  assert.match(styles, /\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important;/);
  assert.match(styles, /\.portrait-reference-grid\s*\{/);
  assert.match(styles, /\.portrait-style-grid[\s\S]*\{/);
  assert.match(styles, /\.portrait-action-grid[\s\S]*\{/);
  assert.match(styles, /\.portrait-record-view\s*\{/);
  assert.match(styles, /\.portrait-record-browser\s*\{/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.portrait-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
});

test("portrait workbench supports shot and action filters, full ratio set, loading state and scrollable five-column output", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  ["long-shot", "full-body", "medium-shot", "close-up", "extreme-close-up"].forEach((shotType) => {
    assert.match(html, new RegExp(`name="portraitShotTypes"[\\s\\S]*value="${shotType}"`));
  });
  [
    "standing-relaxed",
    "walking-step",
    "seated-pose",
    "leaning-wall",
    "looking-back",
    "adjusting-sleeve",
    "holding-prop",
    "turning-motion",
  ].forEach((action) => {
    assert.match(html, new RegExp(`name="portraitActions"[\\s\\S]*value="${action}"`));
  });
  assert.match(html, /src="\.\/assets\/portrait-actions\/action-standing\.png"/);
  assert.match(html, /src="\.\/assets\/portrait-actions\/action-walking\.png"/);
  ["1:1", "4:3", "3:4", "16:9", "9:16", "5:4", "21:9", "3:2", "4:5", "2:3"].forEach((ratio) => {
    assert.match(html, new RegExp(`<option value="${ratio}"`));
  });

  assert.match(styles, /\.portrait-action-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /\.portrait-action-card img\s*\{[\s\S]*aspect-ratio:\s*4 \/ 5;/);
  assert.match(styles, /\.portrait-output-panel\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);
  assert.match(styles, /\.portrait-output-panel\s*\{[\s\S]*gap:\s*8px;/);
  assert.match(styles, /\.portrait-output-panel > \.panel-title\s*\{[\s\S]*margin-bottom:\s*6px;/);
  assert.match(styles, /\.portrait-result-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);[\s\S]*overflow:\s*auto;/);
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.portrait-result-grid,[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);[\s\S]*overflow:\s*auto;/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="tablet"\] \.portrait-view,[\s\S]*overflow:\s*auto;/,
  );
  assert.match(styles, /\.portrait-analysis-actions \.toolbar-button\.is-loading::after/);
  assert.match(styles, /\.portrait-analysis-actions \.toolbar-button\.is-loading:disabled\s*\{[\s\S]*opacity:\s*1;/);
  assert.match(styles, /\.portrait-reference-card\.is-analyzing::after[\s\S]*animation:\s*portrait-reference-scan/);

  assert.match(app, /function clampPortraitImageCount/);
  assert.match(app, /formData\.set\("selectedShotTypes", JSON\.stringify\(getPortraitSelectedShotTypes\(\)\)\)/);
  assert.match(app, /formData\.set\("selectedActions", JSON\.stringify\(getPortraitSelectedActions\(\)\)\)/);
  assert.match(app, /const PORTRAIT_ANALYSIS_FEEDBACK_MIN_MS = \d+;/);
  assert.match(app, /await waitForPortraitAnalysisFeedback\(analysisStartedAt\);[\s\S]*state\.portrait\.analyzing = false;/);
  assert.match(app, /card\.classList\.toggle\("is-analyzing", config\.clearsAnalysis && state\.portrait\.analyzing\)/);
  assert.match(app, /classList\.toggle\("is-loading", state\.portrait\.analyzing\)/);
  assert.match(app, /refs\.portraitSetMeta\.hidden = !currentSet;/);
  assert.match(app, /refs\.portraitDetail\.hidden = true/);
});

test("portrait mode adds location portrait province city district town controls", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const locationSelector = await readFile(locationSelectorPath, "utf8");

  assert.match(html, /id="portraitLocationEnabledInput"[\s\S]*地点写真/);
  assert.match(html, /id="portraitLocationProvinceInput"[\s\S]*id="portraitLocationCityInput"[\s\S]*id="portraitLocationDistrictInput"[\s\S]*id="portraitLocationTownInput"/);
  assert.match(html, /id="portraitLocationFeatureText"/);

  assert.match(styles, /\.portrait-location-section\s*\{/);
  assert.match(styles, /\.portrait-location-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(styles, /html\[data-ui-layout="tablet"\] \.portrait-location-grid,[\s\S]*html\[data-ui-layout="mobile"\] \.portrait-location-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);

  assert.match(locationSelector, /portraitLocationEnabledInput:[\s\S]*documentRef\.querySelector\("#portraitLocationEnabledInput"\)/);
  assert.match(app, /createPortraitLocationSelectorController/);
  assert.match(locationSelector, /PORTRAIT_LOCATION_DATA_SOURCE/);
  assert.match(locationSelector, /async function loadProvinces\(\)/);
  assert.match(locationSelector, /async function loadProvinceDetail\(province\)/);
  assert.match(app, /portraitLocationController\.appendFormData\(formData\)/);
  assert.match(locationSelector, /formData\.set\("portraitLocationSelection", JSON\.stringify\(payload\.selection\)\)/);
  assert.match(locationSelector, /formData\.set\("portraitLocationPrompt", payload\.prompt\)/);
});

test("portrait action selector uses local PNG preview assets", async () => {
  const standingAsset = await readFile(new URL("../public/assets/portrait-actions/action-standing.png", import.meta.url));
  const walkingAsset = await readFile(new URL("../public/assets/portrait-actions/action-walking.png", import.meta.url));
  const attribution = await readFile(new URL("../public/assets/portrait-actions/ATTRIBUTION.md", import.meta.url), "utf8");

  assert.equal(standingAsset[0], 0x89);
  assert.equal(standingAsset[1], 0x50);
  assert.equal(standingAsset[2], 0x4e);
  assert.equal(standingAsset[3], 0x47);
  assert.equal(walkingAsset[0], 0x89);
  assert.equal(walkingAsset[1], 0x50);
  assert.equal(walkingAsset[2], 0x4e);
  assert.equal(walkingAsset[3], 0x47);
  assert.match(attribution, /portrait action selector/);
  assert.match(attribution, /locally generated/);
});

test("portrait analysis suggestions auto-collapse after analysis and can be expanded again", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="portraitAnalysisToggleButton"/);
  assert.match(html, /aria-controls="portraitAnalysisPanel"/);
  assert.match(html, /aria-expanded="false"/);

  assert.match(app, /analysisCollapsed: false/);
  assert.match(app, /portraitAnalysisToggleButton: document\.querySelector\("#portraitAnalysisToggleButton"\)/);
  assert.match(app, /function togglePortraitAnalysisPanel\(\)/);
  assert.match(app, /const hasPortraitAnalysis = Boolean\(state\.portrait\.analysis\);[\s\S]*if \(!hasPortraitAnalysis\) state\.portrait\.analysisCollapsed = false;[\s\S]*refs\.portraitAnalysisPanel\.hidden = !hasPortraitAnalysis \|\| state\.portrait\.analysisCollapsed;/);
  assert.match(app, /refs\.portraitAnalysisToggleButton\.setAttribute\("aria-expanded", String\(hasPortraitAnalysis && !state\.portrait\.analysisCollapsed\)\)/);
  assert.match(app, /state\.portrait\.analysis = payload\.analysis \|\| null;[\s\S]*state\.portrait\.analysisCollapsed = true;/);
  assert.match(app, /portraitAnalysisToggleButton\.addEventListener\("click", togglePortraitAnalysisPanel\)/);
});

test("portrait analysis task always submits low reasoning effort", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(
    app,
    /async function analyzePortraitReference\(\) \{[\s\S]*const formData = buildPortraitFormData\(\{ includeFiles: true \}\);[\s\S]*formData\.set\("reasoningEffort", "low"\);[\s\S]*fetch\("\/api\/portrait\/reference\/analyze"/,
  );
});

test("portrait reference uploads split person and styling accessory limits", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="portraitReferenceCount">0 \/ 3/);
  assert.match(html, /id="portraitAccessoryReferenceCount">0 \/ 9/);
  assert.match(html, /id="portraitActionReferenceCount">0 \/ 3/);
  assert.match(html, /id="portraitActionReferenceInput" name="portraitActionReferenceImages"/);
  assert.match(html, /id="portraitAccessoryReferenceInput" name="portraitAccessoryReferenceImages"/);
  assert.match(html, /服装道具配饰参考图/);
  assert.doesNotMatch(html, /服装参考图/);

  assert.match(app, /maxPortraitPersonReferenceImages:\s*3/);
  assert.match(app, /maxPortraitActionReferenceImages:\s*3/);
  assert.match(app, /maxPortraitAccessoryReferenceImages:\s*9/);
  assert.match(app, /portraitActionReferenceInput:\s*document\.querySelector\("#portraitActionReferenceInput"\)/);
  assert.match(app, /formData\.append\("portraitActionReferenceImages", item\.file\)/);
  assert.match(app, /portraitAccessoryReferenceInput:\s*document\.querySelector\("#portraitAccessoryReferenceInput"\)/);
  assert.match(app, /formData\.append\("portraitAccessoryReferenceImages", item\.file\)/);
  assert.doesNotMatch(app, /buildPortraitFormData\(\{\s*includeFiles:\s*true,\s*includeActionFiles:\s*false,\s*includeAccessoryFiles:\s*false\s*\}\)/);
  assert.match(app, /const formData = buildPortraitFormData\(\{\s*includeFiles:\s*true\s*\}\);/);
});

test("portrait accessory asset library inserts real image assets into accessory references", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const assetModule = await readFile(accessoryAssetsPath, "utf8");
  const whiteShirtAsset = await readFile(new URL("../public/assets/portrait-accessories/upper-white-shirt.png", import.meta.url));
  const cosplayMikoAsset = await readFile(new URL("../public/assets/portrait-accessories/cosplay-shrine-miko.png", import.meta.url));
  const cosplayMagicalGirlAsset = await readFile(new URL("../public/assets/portrait-accessories/cosplay-magical-girl.png", import.meta.url));
  const cosplayCyberWarriorAsset = await readFile(new URL("../public/assets/portrait-accessories/cosplay-cyber-warrior.png", import.meta.url));
  const cosplayFantasyKnightAsset = await readFile(new URL("../public/assets/portrait-accessories/cosplay-fantasy-knight.png", import.meta.url));
  const attribution = await readFile(new URL("../public/assets/portrait-accessories/ATTRIBUTION.md", import.meta.url), "utf8");

  assert.match(html, /id="portraitAccessoryAssetButton"/);
  assert.match(html, /id="portraitAccessoryAssetPopover"/);
  assert.match(
    html,
    /<div class="portrait-accessory-title">[\s\S]*服装道具配饰参考图[\s\S]*id="portraitAccessoryReferenceCount">0 \/ 9[\s\S]*<\/div>[\s\S]*<div class="portrait-accessory-head-actions">[\s\S]*id="portraitAccessoryAssetButton"/,
  );
  assert.match(app, /from "\/lib\/portrait-accessory-assets\.mjs/);
  assert.match(app, /accessoryAssetColors:\s*\{\}/);
  assert.match(app, /data-portrait-accessory-color-id/);
  assert.match(app, /getPortraitAccessoryAssetFileDescriptor/);
  assert.match(app, /selectedVariant\.filename/);
  assert.match(assetModule, /asset\("upper-white-shirt",\s*"upper",\s*"白衬衫"[\s\S]*colors:\s*colorSet\("upper-white-shirt"/);
  assert.match(assetModule, /value:\s*"bag",\s*label:\s*"包袋"/);
  assert.match(assetModule, /value:\s*"accessory",\s*label:\s*"配饰"/);
  assert.match(assetModule, /value:\s*"hat",\s*label:\s*"帽子"/);
  assert.match(assetModule, /value:\s*"cosplay",\s*label:\s*"COS"/);
  assert.match(assetModule, /asset\("bag-tote",\s*"bag",\s*"托特包"[\s\S]*colors:\s*colorSet\("bag-tote"/);
  assert.match(assetModule, /asset\("cosplay-shrine-miko",\s*"cosplay",\s*"巫女COS"[\s\S]*prompt:\s*"[^"]*cosplay portrait[^"]*costume[^"]*props/);
  assert.match(assetModule, /asset\("cosplay-magical-girl",\s*"cosplay",\s*"魔法少女COS"[\s\S]*prompt:\s*"[^"]*cosplay portrait[^"]*star wand[^"]*props/);
  assert.match(assetModule, /asset\("cosplay-cyber-warrior",\s*"cosplay",\s*"赛博战士COS"[\s\S]*prompt:\s*"[^"]*cosplay portrait[^"]*armor[^"]*props/);
  assert.match(assetModule, /asset\("cosplay-fantasy-knight",\s*"cosplay",\s*"幻想骑士COS"[\s\S]*prompt:\s*"[^"]*cosplay portrait[^"]*cape[^"]*props/);
  assert.match(assetModule, /colors:\s*colorSet\("upper-white-shirt"/);
  assert.doesNotMatch(app, /COS 极简白T|COS 廓形西装|COS 直筒长裤|COS 极简直筒裙/);
  assert.doesNotMatch(app, /portrait-accessories\/[^"]+\.jpg/);
  assert.match(app, /async function addPortraitAccessoryAssetReference/);
  assert.match(app, /new File\(\[blob\], selectedVariant\.filename,\s*\{ type:\s*blob\.type \|\| "image\/png", lastModified:\s*1 \}\)/);
  assert.match(app, /applyPortraitAccessoryReferenceFiles\(\[file\],\s*\{\s*asset:\s*selectedVariant\s*\}\)/);
  assert.match(app, /function getPortraitAccessoryPromptSummary\(\)/);
  assert.match(app, /formData\.set\("notes",\s*\[rawPortraitNotes,\s*getPortraitAccessoryPromptSummary\(\)\]\.filter\(Boolean\)\.join\("\\n\\n"\)\)/);
  assert.match(app, /Math\.min\(canvas\.width \/ image\.naturalWidth, canvas\.height \/ image\.naturalHeight\)/);
  assert.match(styles, /\.portrait-accessory-asset-panel\s*\{/);
  assert.match(styles, /\.portrait-accessory-head\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/);
  assert.match(styles, /\.portrait-accessory-title\s*\{[\s\S]*display:\s*grid;/);
  assert.match(styles, /\.portrait-accessory-head-actions\s*\{[\s\S]*justify-self:\s*end;/);
  assert.match(styles, /\.portrait-accessory-asset-button\s*\{[\s\S]*font-family:\s*"Sora",\s*"Microsoft YaHei",\s*sans-serif;[\s\S]*background:/);
  assert.match(styles, /\.portrait-accessory-asset-panel\s*\{[\s\S]*font-family:\s*"IBM Plex Sans",\s*"Microsoft YaHei",\s*sans-serif;[\s\S]*background:/);
  assert.match(
    styles,
    /:root\s*\{[\s\S]*--portrait-accessory-asset-panel-bg:\s*linear-gradient\(180deg,\s*rgba\(21,\s*28,\s*48,\s*0\.98\),\s*rgba\(13,\s*18,\s*31,\s*0\.98\)\)/,
  );
  assert.match(
    styles,
    /html\[data-theme="light"\]\s*\{[\s\S]*--portrait-accessory-asset-panel-bg:\s*linear-gradient\(180deg,\s*#fffaf1 0%,\s*#f4e7d6 52%,\s*#efe1cf 100%\);/,
  );
  assert.match(
    styles,
    /\.portrait-accessory-asset-panel\s*\{[\s\S]*right:\s*clamp\(16px,\s*3vw,\s*48px\);[\s\S]*left:\s*auto;[\s\S]*width:\s*min\(760px,\s*calc\(100vw - 32px\)\);[\s\S]*background:\s*var\(--portrait-accessory-asset-panel-bg\);/,
  );
  assert.match(
    styles,
    /html\[data-ui-layout="mobile"\] \.portrait-accessory-asset-panel\s*\{[\s\S]*left:\s*12px;[\s\S]*right:\s*12px;[\s\S]*width:\s*auto;/,
  );
  assert.match(app, /label\.className = "portrait-accessory-asset-label"/);
  assert.match(styles, /\.portrait-accessory-asset-panel\s*\{[\s\S]*--portrait-accessory-library-columns:\s*4;/);
  assert.match(styles, /\.portrait-accessory-asset-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(var\(--portrait-accessory-library-columns\),\s*minmax\(0,\s*1fr\)\);[\s\S]*grid-auto-rows:\s*var\(--portrait-accessory-card-height\);[\s\S]*max-height:\s*calc\(\(var\(--portrait-accessory-card-height\) \* 2\) \+ var\(--portrait-accessory-asset-gap\)\);[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.portrait-accessory-asset-item\s*\{[\s\S]*grid-template-rows:\s*auto auto;/);
  assert.match(styles, /\.portrait-accessory-asset-add\s*\{[\s\S]*grid-template-rows:\s*auto auto;/);
  assert.match(styles, /\.portrait-accessory-asset-label\s*\{[\s\S]*display:\s*block;[\s\S]*color:\s*var\(--text\);[\s\S]*white-space:\s*normal;/);
  assert.doesNotMatch(styles, /\.portrait-accessory-asset-item span\s*\{/);
  assert.match(styles, /\.portrait-accessory-color-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(28px,\s*1fr\)\);/);
  assert.match(styles, /\.portrait-accessory-color-option img\s*\{[\s\S]*aspect-ratio:\s*1;/);
  assert.equal(whiteShirtAsset[0], 0x89);
  assert.equal(whiteShirtAsset[1], 0x50);
  assert.equal(whiteShirtAsset[2], 0x4e);
  assert.equal(whiteShirtAsset[3], 0x47);
  assert.equal(cosplayMikoAsset[0], 0x89);
  assert.equal(cosplayMikoAsset[1], 0x50);
  assert.equal(cosplayMikoAsset[2], 0x4e);
  assert.equal(cosplayMikoAsset[3], 0x47);
  assert.equal(cosplayMagicalGirlAsset[0], 0x89);
  assert.equal(cosplayMagicalGirlAsset[1], 0x50);
  assert.equal(cosplayMagicalGirlAsset[2], 0x4e);
  assert.equal(cosplayMagicalGirlAsset[3], 0x47);
  assert.equal(cosplayCyberWarriorAsset[0], 0x89);
  assert.equal(cosplayCyberWarriorAsset[1], 0x50);
  assert.equal(cosplayCyberWarriorAsset[2], 0x4e);
  assert.equal(cosplayCyberWarriorAsset[3], 0x47);
  assert.equal(cosplayFantasyKnightAsset[0], 0x89);
  assert.equal(cosplayFantasyKnightAsset[1], 0x50);
  assert.equal(cosplayFantasyKnightAsset[2], 0x4e);
  assert.equal(cosplayFantasyKnightAsset[3], 0x47);
  assert.match(attribution, /white-background product-reference assets/);
  assert.match(attribution, /cosplay character reference assets/);
  assert.match(attribution, /generic anime-inspired and fantasy character archetypes/);
  assert.doesNotMatch(attribution, /COS-style/);
  assert.doesNotMatch(attribution, /Wikimedia Commons/);
});

test("portrait workbench exposes failed item retry controls without prompt tuning", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const portraitPlanActions = html.match(/<div class="creation-plan-actions">([\s\S]*?)<\/div>/)?.[1] || "";

  assert.match(html, /id="portraitRepairFailedButton"/);
  assert.match(
    html,
    /class="panel-title between portrait-output-title"[\s\S]*id="portraitRepairFailedButton"/,
  );
  assert.doesNotMatch(portraitPlanActions, /portraitRepairFailedButton/);
  assert.match(styles, /\.panel-title\.portrait-output-title\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/);
  assert.match(styles, /\.portrait-output-retry-button\s*\{[\s\S]*justify-self:\s*end;/);
  assert.doesNotMatch(app, /data-portrait-edit-item-id/);
  assert.doesNotMatch(app, /data-portrait-save-prompt-item-id/);
  assert.match(app, /data-portrait-retry-item-id/);
  assert.match(app, /portrait-card-actions/);
  assert.match(app, /function canRepairPortraitSet/);
  assert.match(app, /async function repairPortraitItems/);
  assert.match(app, /requestGenerationStream\("\/api\/portrait\/repair"/);
  assert.match(app, /refs\.portraitResultGrid\.addEventListener\("click"[\s\S]*portraitRetryItemId/);
  assert.match(app, /refs\.portraitRepairFailedButton\.addEventListener\("click"/);
});

test("portrait lazy view modules delegate to portrait renderers", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /portrait: renderPortraitView/);
  assert.match(app, /portraitRecord: renderPortraitRecordView/);
  assert.match(app, /if \(view === "portrait-record"\) \{[\s\S]*loadPortraitSets\(\)/);
  assert.match(app, /requestGenerationStream\("\/api\/portrait\/generate"/);
  assert.match(app, /fetch\("\/api\/portrait\/plan"/);
  assert.match(app, /fetch\("\/api\/portrait\/reference\/analyze"/);
});
