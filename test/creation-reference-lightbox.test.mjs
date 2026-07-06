import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildCreationReferenceLightboxItem } from "../lib/creation-reference-lightbox.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

test("creation reference lightbox items are image-only previews", () => {
  const item = {
    id: "ref-1",
    previewUrl: "blob:http://localhost/ref-1",
    file: { name: "dress-reference.png" },
    role: "product",
    note: "Product reference note that must stay out of the enlarged preview.",
  };

  assert.deepEqual(buildCreationReferenceLightboxItem(item), {
    id: "creation-reference-ref-1",
    filename: "dress-reference.png",
    imageUrl: "blob:http://localhost/ref-1",
    thumbnailUrl: "blob:http://localhost/ref-1",
    prompt: "",
    isImageOnlyLightboxItem: true,
  });
});

test("creation reference lightbox returns null without a preview URL", () => {
  assert.equal(buildCreationReferenceLightboxItem({ id: "ref-1", file: { name: "dress-reference.png" } }), null);
});

test("creation reference thumbnails open the image-only lightbox", async () => {
  const [app, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(app, /buildCreationReferenceLightboxItem/);
  assert.match(app, /openLightbox\(lightboxItem,\s*\{[\s\S]*buildItem:\s*buildCreationReferenceLightboxItem,[\s\S]*\}\)/);
  assert.match(app, /isImageOnlyLightboxItem/);
  assert.match(styles, /\.lightbox\.is-image-only-preview\s+\.lightbox-fields/);
  assert.match(styles, /\.lightbox\.is-image-only-preview\s+\.lightbox-meta/);
});

test("creation style reference thumbnails open the image-only lightbox", async () => {
  const app = await readFile(appPath, "utf8");
  const body = app.match(/function openCreationStyleReferencePreview\(referenceId\) \{(?<body>[\s\S]*?)\n\}/)?.groups?.body || "";

  assert.match(body, /buildCreationReferenceLightboxItem\(item\)/);
  assert.match(body, /openLightbox\(lightboxItem,\s*\{[\s\S]*items:\s*state\.creationStyleReferenceFiles,[\s\S]*buildItem:\s*buildCreationReferenceLightboxItem,[\s\S]*\}\)/);
  assert.doesNotMatch(body, /referencePreviewViewer|referencePreviewImage/);
});

test("creation logo batch source thumbnails open the image-only lightbox", async () => {
  const app = await readFile(appPath, "utf8");
  const body = app.match(/function openCreationLogoBatchSourcePreview\(sourceId\) \{(?<body>[\s\S]*?)\n\}/)?.groups?.body || "";

  assert.match(body, /buildCreationReferenceLightboxItem\(item\)/);
  assert.match(body, /openLightbox\(lightboxItem,\s*\{[\s\S]*items:\s*state\.creationLogoBatchFiles,[\s\S]*buildItem:\s*buildCreationReferenceLightboxItem,[\s\S]*\}\)/);
  assert.doesNotMatch(body, /referencePreviewViewer|referencePreviewImage/);
});
