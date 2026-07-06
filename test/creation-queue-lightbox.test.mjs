import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../public/app.js", import.meta.url);

test("creation queue result thumbnails resolve images from the displayed queue set", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function getCreationDisplayedSet\(\) \{/);
  assert.match(
    app,
    /function getCreationDisplayedSet\(\) \{[\s\S]*const selectedQueueJob = isCreationLogoBatchBranch\(\) \? null : getSelectedCreationQueueJob\(\);[\s\S]*return selectedQueueJob\?\.set \? normalizeCreationSetForView\(selectedQueueJob\.set\) : getCreationCurrentSet\(\);[\s\S]*\}/,
  );
  assert.match(
    app,
    /function renderCreationView\(\) \{[\s\S]*const selectedQueueJob = logoBatchBranch \? null : getSelectedCreationQueueJob\(\);[\s\S]*const currentSet = getCreationDisplayedSet\(\);[\s\S]*const showCreationResultActions = !selectedQueueJob;/,
  );
  assert.match(app, /syncCreationResultGrid\(items, \{ showActions: showCreationResultActions \}\);/);
  assert.match(
    app,
    /function syncCreationResultGrid\(items = \[\], \{ showActions = true \} = \{\}\) \{[\s\S]*getItemOptions: \(item, _index, \{ firstSkuItem, firstInfographicRebuildItem \}\) => \(\{[\s\S]*showActions,[\s\S]*isSkuStart: item === firstSkuItem,/,
  );
  assert.match(
    app,
    /function openCreationCurrentItemPreview\(itemId\) \{[\s\S]*const currentSet = getCreationDisplayedSet\(\);[\s\S]*const item = currentSet\?\.items\?\.find\(\(entry\) => entry\.itemId === itemId\);[\s\S]*const lightboxItem = buildCreationCurrentLightboxItem\(item\);[\s\S]*openLightbox\(lightboxItem,\s*\{[\s\S]*items:\s*currentSet\?\.items \|\| \[\],[\s\S]*buildItem:\s*buildCreationCurrentLightboxItem,[\s\S]*\}\);[\s\S]*\}/,
  );
  assert.doesNotMatch(
    app,
    /function openCreationCurrentItemPreview\(itemId\) \{[\s\S]*const item = getCreationCurrentSet\(\)\?\.items\?\.find/,
  );
});
