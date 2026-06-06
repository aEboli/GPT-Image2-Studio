import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { handleApiRequest, handleGenerationQueue } from "../cloudflare-pages-worker.mjs";
import {
  MAX_CREATION_REFERENCE_IMAGES,
  MAX_CREATION_STYLE_REFERENCE_IMAGES,
} from "../lib/studio-constants.mjs";

function makeSseResponse(base64 = "ZmluYWw=") {
  return new Response(
    [
      "event: response.output_item.done",
      `data: {"item":{"type":"image_generation_call","result":"${base64}"}}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function parseSseEvents(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((chunk) => {
      const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1] || "";
      const data = chunk.match(/^data:\s*(.+)$/m)?.[1] || "";
      return eventName && data ? { eventName, payload: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

function makeImageBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, options = {}) {
      objects.set(key, {
        body: value,
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
      });
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) {
        return null;
      }
      return {
        body: object.body,
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
        async text() {
          if (typeof object.body === "string") {
            return object.body;
          }
          return new TextDecoder().decode(object.body);
        },
        writeHttpMetadata(headers) {
          if (object.httpMetadata.contentType) {
            headers.set("Content-Type", object.httpMetadata.contentType);
          }
        },
      };
    },
    async delete(key) {
      objects.delete(key);
    },
    async list({ prefix = "", limit = 1000 } = {}) {
      return {
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .slice(0, limit)
          .map((key) => ({ key })),
      };
    },
  };
}

function makeGenerationQueue() {
  const messages = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
    },
  };
}

function makeListingDraft(overrides = {}) {
  return {
    title: "1 Pack Blue Travel Bottle Daily Hydration Compact Bottle",
    sellingPoints: ["Compact bottle details make the blue travel option easy to compare."],
    painPoints: ["Bulky bottles can be awkward during commutes; the compact format fits everyday hydration routines."],
    fiveBullets: [
      "CORE VALUE: 1 Pack 340.19 g (12 oz) format keeps quantity and size easy to review.",
      "BUILT TO LAST: Blue bottle details keep the selected color easy to identify without extra claims.",
      "REAL-LIFE USE: Daily hydration positioning supports home, office, travel, and gym routines.",
      "SIZE & FIT: Compact bottle details keep the offer easy to compare before purchase.",
      "PACKAGE SNAPSHOT: Concise product information keeps the draft focused on the included bottle.",
    ],
    description: "Blue travel bottle option for shoppers comparing compact daily hydration bottles.",
    backendSearchTerms: "blue travel bottle daily hydration",
    keywordBuckets: {
      exact: ["blue travel bottle"],
      longTail: ["340.19 g 12 oz travel bottle"],
      traffic: ["daily hydration bottle"],
      descriptive: ["compact blue bottle"],
    },
    missingInfo: [],
    warnings: [],
    ...overrides,
  };
}

test("Cloudflare quick blend queued request snapshot preserves optional group and layout metadata", () => {
  const source = fs.readFileSync(new URL("../cloudflare-pages-worker.mjs", import.meta.url), "utf8");
  const start = source.indexOf("await writeJsonObject(imageBucket, requestKey, {");
  const end = source.indexOf("  await generationQueue.send", start);
  const snapshotBlock = source.slice(start, end);

  assert.match(snapshotBlock, /quickBlendPairIndex:\s*context\.quickBlendPairIndex/);
  assert.match(snapshotBlock, /quickBlendAImageName:\s*context\.quickBlendAImageName/);
  assert.match(snapshotBlock, /quickBlendBImageName:\s*context\.quickBlendBImageName/);
  assert.match(snapshotBlock, /quickBlendCImageName:\s*context\.quickBlendCImageName/);
  assert.match(snapshotBlock, /quickBlendDImageName:\s*context\.quickBlendDImageName/);
  assert.match(snapshotBlock, /quickBlendLayoutOrder:\s*context\.quickBlendLayoutOrder/);
  assert.match(snapshotBlock, /quickBlendPlacementShape:\s*context\.quickBlendPlacementShape/);
});

test("Cloudflare creation listing route accepts explicit set metadata and returns input-only drafts", async () => {
  const request = new Request("https://studio.example/api/creation/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      set: {
        setId: "worker-set",
        productName: "Travel Bottle",
        dimensionSpecs: "12 oz",
        skuSubjects: [{ id: "blue", title: "Blue Bottle", bundleCount: 1 }],
        items: [{ itemId: "1-hero", role: "hero", status: "failed" }],
      },
    }),
  });

  const response = await handleApiRequest(request, {
    env: { IMAGE_STUDIO_MOCK_LISTING_AGENT: "1" },
    fetchImpl() {
      throw new Error("mock listing route should not call upstream fetch");
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.set.setId, "worker-set");
  assert.equal(body.set.listingDrafts.length, 1);
  assert.equal(body.listingDrafts.length, 1);
  assert.equal(body.listingDrafts[0].evidenceMode, "input-only");
});

test("Cloudflare creation listing route requires explicit set metadata with setId", async () => {
  for (const payload of [{}, { set: { productName: "Travel Bottle" } }, { set: { setId: " " } }]) {
    const response = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }), {
      env: { IMAGE_STUDIO_MOCK_LISTING_AGENT: "1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /set/i);
  }
});

test("Cloudflare creation listing route uses payload API settings outside mock mode", async () => {
  const seenRequests = [];
  const response = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: "https://payload.example/v1",
      apiKey: "payload-key",
      responsesModel: "gpt-payload",
      reasoningEffort: "high",
      set: {
        setId: "worker-set-upstream",
        productName: "Travel Bottle",
        dimensionSpecs: "12 oz",
        skuSubjects: [{ id: "blue", title: "Blue Bottle", bundleCount: 1 }],
        items: [{ itemId: "1-hero", role: "hero", status: "failed" }],
      },
    }),
  }), {
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return new Response(JSON.stringify({ output_text: JSON.stringify(makeListingDraft()) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://payload.example/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer payload-key");
  assert.equal(seenRequests[0].body.model, "gpt-payload");
  assert.equal(seenRequests[0].body.reasoning.effort, "high");
  assert.equal(body.listingDrafts[0].title, "1 Pack Blue Travel Bottle Daily Hydration Compact Bottle");
  assert.doesNotMatch(JSON.stringify(body), /payload-key/);
});

test("Cloudflare creation listing route uses env API settings outside mock mode", async () => {
  const seenRequests = [];
  const response = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      set: {
        setId: "worker-set-env",
        productName: "Travel Bottle",
        dimensionSpecs: "12 oz",
        skuSubjects: [{ id: "blue", title: "Blue Bottle", bundleCount: 1 }],
        items: [{ itemId: "1-hero", role: "hero", status: "failed" }],
      },
    }),
  }), {
    env: {
      OPENAI_BASE_URL: "https://env.example/v1",
      OPENAI_API_KEY: "env-key",
      RESPONSES_MODEL: "gpt-env",
      REASONING_EFFORT: "low",
    },
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return new Response(JSON.stringify({ output_text: JSON.stringify(makeListingDraft()) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://env.example/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer env-key");
  assert.equal(seenRequests[0].body.model, "gpt-env");
  assert.equal(seenRequests[0].body.reasoning.effort, "low");
  assert.equal(body.listingDrafts[0].skuSubjectId, "");
  assert.doesNotMatch(JSON.stringify(body), /env-key/);
});

test("Cloudflare generation uses browser-provided API settings without echoing the key", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const chunkEvents = events.filter((event) => event.eventName === "final_image_chunk");
  const savedEvent = events.find((event) => event.eventName === "saved");
  const imageUrl = savedEvent.payload.item.imageUrl;

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(seenRequests[0].body.model, "gpt-5.5");
  assert.match(text, /event: saved/);
  assert.doesNotMatch(text, /^event: final_image$/m);
  assert.ok(chunkEvents.length > 0);
  assert.equal(chunkEvents.map((event) => event.payload.chunk).join(""), "ZmluYWw=");
  assert.equal(imageUrl, "");
  assert.equal(savedEvent.payload.item.thumbnailUrl, "");
  assert.equal(Number.isFinite(Number(savedEvent.payload.item.generationDurationMs)), true);
  assert.match(savedEvent.payload.item.generationStartedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(savedEvent.payload.item.generationCompletedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(imageBucket.objects.size, 1);
  assert.doesNotMatch(text, /data:image\/png;base64,ZmluYWw=/);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare prompt generation labels uploaded reference images and saves reference metadata", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-prompt-reference");
  formData.set("prompt", "提升画质");
  formData.set("ratio", "16:9");
  formData.set("size", "1536x864");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["source-image"], "castle-source.jpg", { type: "image/jpeg" }));

  const response = await handleApiRequest(
    new Request("https://studio.example/api/generate", {
      method: "POST",
      body: formData,
    }),
    {
      imageBucket,
      async fetchImpl(url, init) {
        seenRequests.push({
          url,
          body: JSON.parse(init.body),
        });
        return makeSseResponse();
      },
    },
  );

  const events = parseSseEvents(await response.text());
  const savedEvent = events.find((event) => event.eventName === "saved");
  const content = seenRequests[0]?.body.input[0].content || [];

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.match(
    content.find((item) => item.type === "input_text" && item.text.includes("Prompt mode reference image"))?.text || "",
    /Prompt mode reference image 1 of 1: castle-source\.jpg/,
  );
  assert.equal(content.filter((item) => item.type === "input_image").length, 1);
  assert.equal(savedEvent.payload.item.hasReferenceImage, true);
  assert.deepEqual(savedEvent.payload.item.referenceImageNames, ["castle-source.jpg"]);
});

test("Cloudflare creation filenames use Chinese image type names", async () => {
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero", "review-qa"]));
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl() {
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const complete = events.find((event) => event.eventName === "complete");
  const filenames = complete.payload.set.items.map((item) => item.filename).join("\n");

  assert.equal(response.status, 200);
  assert.match(complete.payload.set.items[0].filename, /^01-主图-cloudflare-/u);
  assert.match(complete.payload.set.items[1].filename, /^02-口碑问答图-cloudflare-/u);
  assert.doesNotMatch(filenames, /(?:^|-)hero(?:-|\.|$)|(?:^|-)review(?:-|\.|$)|(?:^|-)qa(?:-|\.|$)|ewqa/i);
  assert.equal(imageBucket.objects.size, 2);
});

test("Cloudflare creation plan route returns the shared preview plan", async () => {
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure for bass fishing");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero", "scene"]));
  formData.set("visualLanguage", "lifestyle-editorial");

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/plan", {
    method: "POST",
    body: formData,
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.plan.productName, "Jointed fishing lure");
  assert.equal(payload.plan.visualLanguage, "lifestyle-editorial");
  assert.deepEqual(payload.plan.selectedRoles, ["hero", "scene"]);
});

test("Cloudflare creation reference analysis route uses browser API settings", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("reasoningEffort", "high");
  formData.append("referenceImages", new File(["lure"], "lure.png", { type: "image/png" }));

  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/reference/analyze", {
      method: "POST",
      body: formData,
    }),
    {
      async fetchImpl(url, init) {
        seenRequests.push({
          url,
          auth: init.headers.Authorization,
          body: JSON.parse(init.body),
        });
        return new Response(
          [
            "event: response.output_text.done",
            `data: {"type":"response.output_text.done","text":${JSON.stringify(
              JSON.stringify({
                summary: "Fishing lure reference",
                category_hint: "Fishing Lures",
                category_path: "Sports > Fishing > Fishing Lures",
                reference_roles: [
                  {
                    index: 1,
                    filename: "lure.png",
                    role: "product",
                    note: "Use this image to preserve the lure body and finish.",
                  },
                ],
                sku_subjects: [],
                risks: [],
              }),
            )}}`,
            "",
            "",
            "data: [DONE]",
            "",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      },
    },
  );
  const payload = await response.json();
  const inputImages = seenRequests[0]?.body.input[0].content.filter((item) => item.type === "input_image") || [];

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(seenRequests[0].body.text.format.name, "creation_reference_analysis_json");
  assert.equal(inputImages.length, 1);
  assert.equal(payload.ok, true);
  assert.equal(payload.analysis.reference_roles[0].role, "product");
  assert.doesNotMatch(JSON.stringify(payload), /test-browser-key/);
});

test("Cloudflare creation reference analysis route rejects missing reference images with readable Chinese", async () => {
  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/reference/analyze", {
      method: "POST",
      body: new FormData(),
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.message, "请先上传套图参考图。");
});

test("Cloudflare creation reference analysis route rejects too many reference images with readable Chinese", async () => {
  const formData = new FormData();
  for (let index = 0; index < MAX_CREATION_REFERENCE_IMAGES + 1; index += 1) {
    formData.append("referenceImages", new File(["lure"], `lure-${index + 1}.png`, { type: "image/png" }));
  }

  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/reference/analyze", {
      method: "POST",
      body: formData,
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.message, `参考图最多支持 ${MAX_CREATION_REFERENCE_IMAGES} 张。`);
});

test("Cloudflare creation reference analysis route rejects non-image reference files with readable Chinese", async () => {
  const formData = new FormData();
  formData.append("referenceImages", new File(["not an image"], "notes.txt", { type: "text/plain" }));

  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/reference/analyze", {
      method: "POST",
      body: formData,
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.message, "仅支持图片参考文件。");
});

test("Cloudflare portrait generation uses browser settings, split references and three digit filenames", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("subjectName", "Studio model");
  formData.set("subjectSummary", "adult subject in a navy blazer");
  formData.set("analysis", JSON.stringify({
    visiblePresentation: "feminine-presenting",
    heightImpression: "unclear",
    bodyBuild: "slim",
    clothing: "navy blazer",
    hair: "short dark hair",
  }));
  formData.set("imageCount", "2");
  formData.set("selectedStyles", JSON.stringify(["business-profile"]));
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("portraitReferenceImages", new File(["person"], "person.png", { type: "image/png" }));
  formData.append("portraitActionReferenceImages", new File(["pose"], "pose.png", { type: "image/png" }));
  formData.append("portraitAccessoryReferenceImages", new File(["jacket"], "jacket.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/portrait/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const complete = events.find((event) => event.eventName === "complete");
  const filenames = complete.payload.set.items.map((item) => item.filename);
  const inputImages = seenRequests[0]?.body.input[0].content.filter((item) => item.type === "input_image") || [];
  const requestText = JSON.stringify(seenRequests[0]?.body || {});

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 2);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(inputImages.length, 3);
  assert.match(requestText, /Portrait person reference 1 of 1/);
  assert.match(requestText, /Portrait action and pose reference 1 of 1/);
  assert.match(requestText, /pose, gesture, body movement, limb placement, and action rhythm/);
  assert.match(requestText, /Portrait clothing, prop, and accessory reference 1 of 1/);
  assert.match(requestText, /do not treat it as another person identity/);
  assert.match(filenames[0], /^001-long-shot-cloudflare-/);
  assert.match(filenames[1], /^002-full-body-cloudflare-/);
  assert.equal(complete.payload.set.subjectSummary, "adult subject in a navy blazer");
  assert.deepEqual(complete.payload.set.referenceImageNames, ["person.png", "pose.png", "jacket.png"]);
  assert.equal(imageBucket.objects.size, 2);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare portrait reference analysis uses complete portrait task references", async () => {
  const seenRequests = [];
  const analysis = {
    summary: "Visible person with armor styling references.",
    visiblePresentation: "feminine-presenting",
    heightImpression: "unclear",
    bodyBuild: "average",
    pose: "standing reference plus separate pose cue",
    clothing: "fantasy armor styling reference",
    hair: "dark shoulder-length hair",
    faceVisibility: "clear",
    distinctVisibleFeatures: ["centered face reference"],
    referenceRoles: [
      "person.png is the person identity reference",
      "pose.png is pose-only guidance",
      "armor.png is clothing and prop styling guidance",
    ],
    risks: [],
    safety: "Use ordinary portrait styling and avoid sensitive inferences.",
    confidence: "medium",
  };
  const formData = new FormData();
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("portraitReferenceImages", new File(["person"], "person.png", { type: "image/png" }));
  formData.append("portraitActionReferenceImages", new File(["pose"], "pose.png", { type: "image/png" }));
  formData.append("portraitAccessoryReferenceImages", new File(["armor"], "armor.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/portrait/reference/analyze", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      seenRequests.push({ url, body });
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify(analysis) }] }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const payload = await response.json();
  const inputContent = seenRequests[0]?.body.input[0].content || [];
  const requestText = JSON.stringify(seenRequests[0]?.body || {});

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].body.reasoning?.effort, "low");
  assert.equal(inputContent.filter((item) => item.type === "input_image").length, 3);
  assert.match(requestText, /Portrait person reference 1 of 1/);
  assert.match(requestText, /Portrait action and pose reference 1 of 1/);
  assert.match(requestText, /Portrait clothing, prop, and accessory reference 1 of 1/);
  assert.deepEqual(payload.analysis.referenceRoles, analysis.referenceRoles);
});

test("Cloudflare portrait local record actions return unsupported capability contract", async () => {
  const response = await handleApiRequest(new Request("https://studio.example/api/portrait/sets/paths", {
    method: "POST",
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "unsupported_runtime_capability");
  assert.equal(payload.runtime, "cloudflare");
  assert.equal(payload.path, "/api/portrait/sets/paths");
});

test("Cloudflare creation generation accepts fifteen set reference images", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero"]));
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  for (let index = 1; index <= MAX_CREATION_REFERENCE_IMAGES; index += 1) {
    formData.append("referenceImages", new File([`ref-${index}`], `ref-${index}.png`, { type: "image/png" }));
  }

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const complete = events.find((event) => event.eventName === "complete");
  const inputImages = seenRequests[0]?.body.input[0].content.filter((item) => item.type === "input_image") || [];

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(inputImages.length, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(complete.payload.set.referenceImageNames.length, MAX_CREATION_REFERENCE_IMAGES);
  assert.equal(imageBucket.objects.size, 1);
  assert.doesNotMatch(text, /参考图最多支持/);
});

test("Cloudflare creation generation rejects reference and style images above the combined limit", async () => {
  const formData = new FormData();
  for (let index = 1; index <= MAX_CREATION_REFERENCE_IMAGES - 1; index += 1) {
    formData.append("referenceImages", new File([`ref-${index}`], `ref-${index}.png`, { type: "image/png" }));
  }
  for (let index = 1; index <= MAX_CREATION_STYLE_REFERENCE_IMAGES - 1; index += 1) {
    formData.append("styleReferenceImages", new File([`style-${index}`], `style-${index}.png`, { type: "image/png" }));
  }

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), { imageBucket: makeImageBucket() });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.equal(error?.payload.message, `套图参考图和参考风格图合计最多支持 ${MAX_CREATION_REFERENCE_IMAGES} 张。`);
});

test("Cloudflare creation generation labels reference count order roles and excludes logo from the reference list", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("visualLanguage", "lifestyle-editorial");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero"]));
  formData.set(
    "referenceImageRoles",
    JSON.stringify([
      {
        filename: "yellow-red.png",
        role: "product",
        note: "yellow red SKU",
      },
      {
        filename: "silver-black.png",
        role: "style",
        note: "silver black finish",
      },
    ]),
  );
  formData.set("logoOptions", JSON.stringify({
    enabled: true,
    filename: "brand-mark.png",
    placement: "bottom-right",
    background: "transparent",
  }));
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["ref-1"], "yellow-red.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["ref-2"], "silver-black.png", { type: "image/png" }));
  formData.append("logoImage", new File(["logo"], "brand-mark.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const complete = parseSseEvents(text).find((event) => event.eventName === "complete");
  const content = seenRequests[0]?.body.input[0].content || [];
  const inputImages = content.filter((item) => item.type === "input_image");
  const inputText = content
    .filter((item) => item.type === "input_text")
    .map((item) => item.text)
    .join("\n");

  assert.equal(response.status, 200);
  assert.equal(complete?.payload?.set?.visualLanguage, "lifestyle-editorial");
  assert.equal(complete?.payload?.set?.visualLanguageLabel, "生活方式杂志");
  assert.equal(inputImages.length, 3);
  assert.match(inputText, /Shared visual language: 生活方式杂志/);
  assert.match(inputText, /lifestyle magazine editorial/);
  assert.match(inputText, /Creation reference image 1 of 2: yellow-red\.png\./);
  assert.match(inputText, /Creation reference image 2 of 2: silver-black\.png\./);
  assert.match(inputText, /Uploaded reference count: 2\./);
  assert.match(inputText, /Uploaded reference files: 1\. yellow-red\.png; 2\. silver-black\.png\./);
  assert.match(inputText, /Role: product subject\./);
  assert.match(inputText, /Note: yellow red SKU\./);
  assert.match(inputText, /Role: visual style reference\./);
  assert.match(inputText, /Note: silver black finish\./);
  assert.doesNotMatch(inputText, /Uploaded reference files:[^\n]*brand-mark\.png/);
});

test("Cloudflare creation generation applies edited preview plan overrides", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero"]));
  formData.set("planOverrides", JSON.stringify([
    {
      itemId: "1-hero",
      prompt: "UNIQUE_WORKER_CREATION_OVERRIDE_PROMPT_SENTINEL",
      marketingCopy: "Edited preview copy",
    },
  ]));
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const complete = parseSseEvents(text).find((event) => event.eventName === "complete");
  const requestInput = JSON.stringify(seenRequests[0]?.body.input || "");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.match(requestInput, /UNIQUE_WORKER_CREATION_OVERRIDE_PROMPT_SENTINEL/);
  assert.equal(complete?.payload?.set?.items?.[0]?.prompt, "UNIQUE_WORKER_CREATION_OVERRIDE_PROMPT_SENTINEL");
  assert.equal(complete?.payload?.set?.items?.[0]?.marketingCopy, "Edited preview copy");
});

test("Cloudflare creation style references are style-only generation inputs", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("visualLanguage", "reference-style");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero"]));
  formData.set(
    "referenceImageRoles",
    JSON.stringify([
      {
        filename: "product.png",
        role: "product",
        note: "main product body",
      },
    ]),
  );
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["product"], "product.png", { type: "image/png" }));
  formData.append("styleReferenceImages", new File(["warm"], "warm-lighting.png", { type: "image/png" }));
  formData.append("styleReferenceImages", new File(["paper"], "paper-texture.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const complete = parseSseEvents(text).find((event) => event.eventName === "complete");
  const content = seenRequests[0]?.body.input[0].content || [];
  const inputImages = content.filter((item) => item.type === "input_image");
  const inputText = content
    .filter((item) => item.type === "input_text")
    .map((item) => item.text)
    .join("\n");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(complete?.payload?.set?.visualLanguage, "reference-style");
  assert.equal(complete?.payload?.set?.visualLanguageLabel, "参考模式");
  assert.deepEqual(complete?.payload?.set?.referenceImageNames, ["product.png"]);
  assert.equal(inputImages.length, 3);
  assert.match(inputText, /Creation reference image 1 of 1: product\.png\./);
  assert.match(inputText, /Creation style reference image 1 of 2: warm-lighting\.png\./);
  assert.match(inputText, /Creation style reference image 2 of 2: paper-texture\.png\./);
  assert.match(inputText, /Use this image only for style, lighting, color grading/);
  assert.match(inputText, /Do not copy the style reference subject/);
  assert.doesNotMatch(inputText, /Uploaded reference files:[^\n]*warm-lighting\.png/);
});

test("Cloudflare creation SKU bundle generation only sends the selected SKU subject reference", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("productName", "Jointed fishing lure");
  formData.set("productDescription", "Segmented lifelike lure");
  formData.set("sellingPoints", "realistic swim action");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "standard");
  formData.set("industryTemplate", "general");
  formData.set("selectedRoles", JSON.stringify(["hero"]));
  formData.set(
    "referenceImageRoles",
    JSON.stringify([
      { filename: "blue-lure.png", role: "product", note: "blue lure SKU" },
      { filename: "silver-lure.png", role: "product", note: "silver lure SKU" },
      { filename: "package.png", role: "package", note: "retail package" },
    ]),
  );
  formData.set(
    "skuSubjects",
    JSON.stringify([
      {
        id: "silver",
        title: "Silver lure",
        filenames: ["silver-lure.png"],
        note: "silver lure SKU",
      },
    ]),
  );
  formData.set("skuBundleCount", "2");
  formData.set("logoOptions", JSON.stringify({
    enabled: true,
    filename: "brand-mark.png",
    placement: "bottom-right",
    background: "transparent",
  }));
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["blue"], "blue-lure.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["silver"], "silver-lure.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["package"], "package.png", { type: "image/png" }));
  formData.append("logoImage", new File(["logo"], "brand-mark.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  await response.text();
  const storedCreationFilenames = [...imageBucket.objects.values()]
    .map((object) => object.customMetadata.filename)
    .filter(Boolean)
    .join("\n");
  const skuRequest = seenRequests.find((request) =>
    request.body.input[0].content.some(
      (item) => item.type === "input_text" && /Render exactly 2 identical copies/.test(item.text),
    ),
  );
  const content = skuRequest?.body.input[0].content || [];
  const inputImages = content.filter((item) => item.type === "input_image");
  const inputText = content
    .filter((item) => item.type === "input_text")
    .map((item) => item.text)
    .join("\n");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 2);
  assert.ok(skuRequest, "expected one SKU generation request");
  assert.equal(inputImages.length, 2);
  assert.match(inputText, /Creation reference image 1 of 1: silver-lure\.png\./);
  assert.match(inputText, /Uploaded reference count: 1\./);
  assert.doesNotMatch(inputText, /blue-lure\.png/);
  assert.doesNotMatch(inputText, /package\.png/);
  assert.match(storedCreationFilenames, /silver-lure\.png/);
  assert.doesNotMatch(storedCreationFilenames, /Silverlure/);
});

test("Cloudflare creation logo batch edits each uploaded source with the shared logo", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("title", "Marketplace logo pass");
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("logoOptions", JSON.stringify({
    enabled: true,
    filename: "brand-mark.png",
    placement: "bottom-right",
    background: "transparent",
  }));
  formData.append("sourceImages", new File(["front"], "front.png", { type: "image/png" }));
  formData.append("sourceImages", new File(["detail"], "detail.png", { type: "image/png" }));
  formData.append("logoImage", new File(["logo"], "brand-mark.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/creation/logo-batch", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvents = events.filter((event) => event.eventName === "item_saved");
  const completeEvent = events.find((event) => event.eventName === "complete");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 2);
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(seenRequests[0].body.input[0].content.filter((item) => item.type === "input_image").length, 2);
  assert.match(seenRequests[0].body.input[0].content[0].text, /Preserve the source image/);
  assert.match(seenRequests[0].body.input[0].content[1].text, /SOURCE image/);
  assert.match(seenRequests[0].body.input[0].content[3].text, /LOGO image/);
  assert.equal(savedEvents.length, 2);
  assert.equal(completeEvent.payload.set.logo.filename, "brand-mark.png");
  assert.equal(completeEvent.payload.set.referenceImageNames.length, 2);
  assert.deepEqual(
    completeEvent.payload.set.referenceImageRoles.map((entry) => [entry.filename, entry.role]),
    [
      ["front.png", "product"],
      ["detail.png", "product"],
    ],
  );
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare image decomposition uses a single reference image and generated target-language prompt", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-decompose");
  formData.set("mode", "image-decomposition");
  formData.set("targetLanguage", "Français");
  formData.set("featureCardsEnabled", "1");
  formData.set("ratio", "1:1");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["source"], "source.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvent = events.find((event) => event.eventName === "saved");
  const inputContent = seenRequests[0].body.input[0].content;
  const inputImages = inputContent.filter((item) => item.type === "input_image");
  const inputText = inputContent.filter((item) => item.type === "input_text").map((item) => item.text).join("\n");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(inputImages.length, 1);
  assert.match(inputText, /Français/);
  assert.match(inputText, /SOURCE image/);
  assert.match(inputText, /Do not invent brands/);
  assert.match(inputText, /must include left and right side feature cards/i);
  assert.match(inputText, /detailed callout boxes/i);
  assert.equal(savedEvent.payload.item.generationMode, "image-decomposition");
  assert.equal(savedEvent.payload.item.assetKind, "image-decomposition");
  assert.equal(savedEvent.payload.item.targetLanguage, "Français");
  assert.equal(savedEvent.payload.item.sourceImageName, "source.png");
  assert.equal(savedEvent.payload.item.featureCardsEnabled, true);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare quick blend uses exactly two references, generated prompt, labels, and saved metadata", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-quick-blend");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "3");
  formData.set("quickBlendAName", "a-chair.png");
  formData.set("quickBlendBName", "b-table.png");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["chair"], "a-chair.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["table"], "b-table.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvent = events.find((event) => event.eventName === "saved");
  const serverImageEvent = events.find((event) => event.eventName === "server_image");
  const inputContent = seenRequests[0]?.body?.input?.[0]?.content || [];
  const inputImages = inputContent.filter((item) => item.type === "input_image");
  const inputText = inputContent.filter((item) => item.type === "input_text").map((item) => item.text).join("\n");
  const storedImage = [...imageBucket.objects.values()].find(
    (object) => object.customMetadata.filename === savedEvent?.payload?.item?.filename,
  );

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(inputImages.length, 2);
  assert.match(inputText, /Reference image 1: A image/);
  assert.match(inputText, /Reference image 2: B image/);
  assert.match(inputText, /A subject group above the B subject group/);
  assert.match(inputText, /assigned layout slot using contain-style proportional scaling/);
  assert.match(inputText, /Do not stretch, squash, warp, bend, elongate, compress, crop, or force any subject/);
  assert.ok(savedEvent, "expected saved SSE event");
  assert.equal(savedEvent.payload.item.generationMode, "quick-blend");
  assert.equal(savedEvent.payload.item.assetKind, "quick-blend");
  assert.equal(savedEvent.payload.item.quickBlendPairIndex, "3");
  assert.equal(savedEvent.payload.item.quickBlendAImageName, "a-chair.png");
  assert.equal(savedEvent.payload.item.quickBlendBImageName, "b-table.png");
  assert.match(savedEvent.payload.item.filename, /^a-chair-b-table-cloudflare-\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(savedEvent.payload.item.referenceImageNames, ["a-chair.png", "b-table.png"]);
  assert.match(savedEvent.payload.item.prompt, /A subject group above the B subject group/);
  assert.match(savedEvent.payload.item.prompt, /assigned layout slot using contain-style proportional scaling/);
  assert.ok(serverImageEvent, "expected server_image SSE event");
  assert.equal(serverImageEvent.payload.item.assetKind, "quick-blend");
  assert.ok(storedImage, "expected generated image to be stored in R2");
  assert.equal(storedImage.customMetadata.generationMode, "quick-blend");
  assert.equal(storedImage.customMetadata.assetKind, "quick-blend");
  assert.equal(storedImage.customMetadata.quickBlendPairIndex, "3");
  assert.equal(storedImage.customMetadata.quickBlendAImageName, "a-chair.png");
  assert.equal(storedImage.customMetadata.quickBlendBImageName, "b-table.png");
  assert.deepEqual(JSON.parse(storedImage.customMetadata.referenceImageNames), ["a-chair.png", "b-table.png"]);
  assert.doesNotMatch(JSON.stringify(storedImage.customMetadata), /test-browser-key/);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare quick blend accepts optional C and D groups with layout metadata", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-quick-blend-groups");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "7");
  formData.set("quickBlendAImageName", "a-chair.png");
  formData.set("quickBlendBImageName", "b-table.png");
  formData.set("quickBlendCImageName", "c-lamp.png");
  formData.set("quickBlendDImageName", "d-rug.png");
  formData.set("quickBlendLayoutOrder", "horizontal");
  formData.set("quickBlendPlacementShape", "rectangle");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["chair"], "a-chair.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["table"], "b-table.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["lamp"], "c-lamp.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["rug"], "d-rug.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvent = events.find((event) => event.eventName === "saved");
  const serverImageEvent = events.find((event) => event.eventName === "server_image");
  const inputContent = seenRequests[0]?.body?.input?.[0]?.content || [];
  const inputImages = inputContent.filter((item) => item.type === "input_image");
  const inputText = inputContent.filter((item) => item.type === "input_text").map((item) => item.text).join("\n");
  const storedImage = [...imageBucket.objects.values()].find(
    (object) => object.customMetadata.filename === savedEvent?.payload?.item?.filename,
  );

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(inputImages.length, 4);
  assert.match(inputText, /Reference image 1: A image/);
  assert.match(inputText, /Reference image 2: B image/);
  assert.match(inputText, /Reference image 3: C image/);
  assert.match(inputText, /Reference image 4: D image/);
  assert.match(inputText, /Reference image 3 is product group C/);
  assert.match(inputText, /Reference image 4 is product group D/);
  assert.match(inputText, /left to right, then continue on the next row/);
  assert.match(inputText, /rectangular sorting layout/);
  assert.match(inputText, /use a 2 by 2 matrix inside the rectangular canvas/);
  assert.match(inputText, /assigned layout slot using contain-style proportional scaling/);
  assert.doesNotMatch(inputText, /placement zones/);
  assert.ok(savedEvent, "expected saved SSE event");
  assert.equal(savedEvent.payload.item.generationMode, "quick-blend");
  assert.equal(savedEvent.payload.item.assetKind, "quick-blend");
  assert.equal(savedEvent.payload.item.quickBlendPairIndex, "7");
  assert.equal(savedEvent.payload.item.quickBlendAImageName, "a-chair.png");
  assert.equal(savedEvent.payload.item.quickBlendBImageName, "b-table.png");
  assert.equal(savedEvent.payload.item.quickBlendCImageName, "c-lamp.png");
  assert.equal(savedEvent.payload.item.quickBlendDImageName, "d-rug.png");
  assert.equal(savedEvent.payload.item.quickBlendLayoutOrder, "horizontal");
  assert.equal(savedEvent.payload.item.quickBlendPlacementShape, "rectangle");
  assert.match(savedEvent.payload.item.filename, /^a-chair-b-table-c-lamp-d-rug-cloudflare-\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(savedEvent.payload.item.referenceImageNames, [
    "a-chair.png",
    "b-table.png",
    "c-lamp.png",
    "d-rug.png",
  ]);
  assert.ok(serverImageEvent, "expected server_image SSE event");
  assert.equal(serverImageEvent.payload.item.quickBlendCImageName, "c-lamp.png");
  assert.equal(serverImageEvent.payload.item.quickBlendDImageName, "d-rug.png");
  assert.equal(serverImageEvent.payload.item.quickBlendLayoutOrder, "horizontal");
  assert.equal(serverImageEvent.payload.item.quickBlendPlacementShape, "rectangle");
  assert.ok(storedImage, "expected generated image to be stored in R2");
  assert.equal(storedImage.customMetadata.quickBlendCImageName, "c-lamp.png");
  assert.equal(storedImage.customMetadata.quickBlendDImageName, "d-rug.png");
  assert.equal(storedImage.customMetadata.quickBlendLayoutOrder, "horizontal");
  assert.equal(storedImage.customMetadata.quickBlendPlacementShape, "rectangle");
  assert.deepEqual(JSON.parse(storedImage.customMetadata.referenceImageNames), [
    "a-chair.png",
    "b-table.png",
    "c-lamp.png",
    "d-rug.png",
  ]);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare quick blend D-only third reference stays D instead of falling back to C", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-quick-blend-d-only");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "4");
  formData.set("quickBlendAImageName", "a-chair.png");
  formData.set("quickBlendBImageName", "b-table.png");
  formData.set("quickBlendDImageName", "d-rug.png");
  formData.set("quickBlendLayoutOrder", "horizontal");
  formData.set("quickBlendPlacementShape", "square");
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["chair"], "a-chair.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["table"], "b-table.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["rug"], "d-rug.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvent = events.find((event) => event.eventName === "saved");
  const inputContent = seenRequests[0]?.body?.input?.[0]?.content || [];
  const inputText = inputContent.filter((item) => item.type === "input_text").map((item) => item.text).join("\n");
  const inputImages = inputContent.filter((item) => item.type === "input_image");
  const storedImage = [...imageBucket.objects.values()].find(
    (object) => object.customMetadata.filename === savedEvent?.payload?.item?.filename,
  );

  assert.equal(response.status, 200);
  assert.equal(inputImages.length, 3);
  assert.match(inputText, /Reference image 3: D image/);
  assert.match(inputText, /Reference image 3 is product group D/);
  assert.doesNotMatch(inputText, /Reference image 3: C image/);
  assert.doesNotMatch(inputText, /Reference image 3 is product group C/);
  assert.equal(savedEvent.payload.item.quickBlendCImageName, "");
  assert.equal(savedEvent.payload.item.quickBlendDImageName, "d-rug.png");
  assert.equal(storedImage.customMetadata.quickBlendCImageName || "", "");
  assert.equal(storedImage.customMetadata.quickBlendDImageName, "d-rug.png");
});

test("Cloudflare quick blend rejects malformed reference count", async () => {
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-quick-blend-invalid");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "1");
  formData.set("quickBlendAName", "a-chair.png");
  formData.set("quickBlendBName", "b-table.png");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["chair"], "a-chair.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl() {
      throw new Error("quick blend malformed reference count should not call upstream");
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const errorEvent = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(errorEvent, "expected SSE error event");
  assert.match(errorEvent.payload.message, /Quick Blend mode requires 2 to 4 reference images/);
});

test("Cloudflare prompt agent analyzes browser reference images without generation tools", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("mode", "reference-orchestration");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["person"], "person.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["pants"], "pants.png", { type: "image/png" }));

  const response = await handleApiRequest(
    new Request("https://studio.example/api/prompt-agent/analyze", {
      method: "POST",
      body: formData,
    }),
    {
      async fetchImpl(url, init) {
        seenRequests.push({
          url,
          auth: init.headers.Authorization,
          body: JSON.parse(init.body),
        });
        return new Response(
          [
            "event: response.output_text.done",
            `data: {"type":"response.output_text.done","text":${JSON.stringify(
              JSON.stringify({
                title: "穿搭编排",
                summary: "人物主体与裤装参考图的穿搭关系。",
                image_roles: ["图 1：人物主体", "图 2：裤装"],
                relationship: "人物穿搭",
                prompts: [
                  {
                    title: "街拍穿搭",
                    intent: "让人物穿上参考裤装。",
                    prompt: "让参考人物穿上参考裤装，站在城市街头，自然回望，柔和日光，时尚街拍质感。",
                  },
                ],
                risks: [],
              }),
            )}}`,
            "",
            "",
            "data: [DONE]",
            "",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      },
    },
  );

  const payload = await response.json();
  const inputImages = seenRequests[0].body.input[0].content.filter((item) => item.type === "input_image");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(seenRequests[0].body.text.format.name, "reference_orchestration_prompt_json");
  assert.equal("tools" in seenRequests[0].body, false);
  assert.equal(inputImages.length, 2);
  assert.equal(payload.item.json.prompts.length, 1);
  assert.equal(payload.item.json.prompt, "让参考人物穿上参考裤装，站在城市街头，自然回望，柔和日光，时尚街拍质感。");
  assert.doesNotMatch(JSON.stringify(payload), /test-browser-key/);
});

test("Cloudflare reference orchestration defaults to low reasoning effort", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("mode", "reference-orchestration");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["person"], "person.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["pants"], "pants.png", { type: "image/png" }));

  const response = await handleApiRequest(
    new Request("https://studio.example/api/prompt-agent/analyze", {
      method: "POST",
      body: formData,
    }),
    {
      async fetchImpl(url, init) {
        seenRequests.push({
          url,
          body: JSON.parse(init.body),
        });
        return new Response(
          [
            "event: response.output_text.done",
            `data: {"type":"response.output_text.done","text":${JSON.stringify(
              JSON.stringify({
                title: "Reference blend",
                summary: "Two references.",
                image_roles: ["Image 1: person", "Image 2: clothing"],
                relationship: "Person wears the clothing reference.",
                prompts: [
                  {
                    title: "Street portrait",
                    intent: "Blend references.",
                    prompt: "Generate the person wearing the referenced clothing.",
                  },
                ],
                risks: [],
              }),
            )}}`,
            "",
            "",
            "data: [DONE]",
            "",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      },
    },
  );

  await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].body.reasoning?.effort, "low");
});

test("Cloudflare prompt agent image analysis defaults to medium reasoning effort", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("image", new File(["castle"], "castle.png", { type: "image/png" }));

  const response = await handleApiRequest(
    new Request("https://studio.example/api/prompt-agent/analyze", {
      method: "POST",
      body: formData,
    }),
    {
      async fetchImpl(url, init) {
        seenRequests.push({
          url,
          body: JSON.parse(init.body),
        });
        return new Response(
          [
            "event: response.output_text.done",
            `data: {"type":"response.output_text.done","text":${JSON.stringify(
              JSON.stringify({
                title: "Castle balcony",
                summary: "A fantasy balcony scene.",
                prompt: "Generate a detailed fantasy balcony scene.",
                tags: ["fantasy", "balcony"],
              }),
            )}}`,
            "",
            "",
            "data: [DONE]",
            "",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      },
    },
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].body.text.format.name, "image_prompt_json");
  assert.equal(seenRequests[0].body.reasoning?.effort, "medium");
  assert.equal(payload.item.reasoningEffort, "medium");
});

test("Cloudflare generation reports the server image URL after best-effort R2 storage", async () => {
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a large kitchen scene");
  formData.set("ratio", "1:1");
  formData.set("size", "2048x2048");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl() {
      return makeSseResponse();
    },
  });

  const events = parseSseEvents(await response.text());
  const savedIndex = events.findIndex((event) => event.eventName === "saved");
  const serverImageIndex = events.findIndex((event) => event.eventName === "server_image");
  const serverImageEvent = events[serverImageIndex];

  assert.equal(response.status, 200);
  assert.ok(savedIndex >= 0);
  assert.ok(serverImageIndex > savedIndex);
  assert.match(serverImageEvent.payload.item.imageUrl, /^\/api\/images\/images%2F/);
  assert.equal(serverImageEvent.payload.item.thumbnailUrl, serverImageEvent.payload.item.imageUrl);
  assert.equal(imageBucket.objects.size, 1);
  assert.equal([...imageBucket.objects.values()][0].customMetadata.imageRoute, "a");
});

test("Cloudflare generation still returns chunked browser image when R2 image storage fails", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const imageBucket = makeImageBucket();
  const originalPut = imageBucket.put;
  imageBucket.put = async function put(key, value, options = {}) {
    if (String(key).startsWith("images/")) {
      throw new Error("R2 write failed");
    }
    return originalPut.call(this, key, value, options);
  };
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  let response;
  let text = "";
  try {
    response = await handleApiRequest(new Request("https://studio.example/api/generate", {
      method: "POST",
      body: formData,
    }), {
      imageBucket,
      async fetchImpl() {
        return makeSseResponse();
      },
    });
    text = await response.text();
  } finally {
    console.warn = originalWarn;
  }

  const events = parseSseEvents(text);
  const chunkEvents = events.filter((event) => event.eventName === "final_image_chunk");
  const savedEvent = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.ok(chunkEvents.length > 0);
  assert.equal(chunkEvents.map((event) => event.payload.chunk).join(""), "ZmluYWw=");
  assert.ok(savedEvent);
  assert.equal(savedEvent.payload.item.imageUrl, "");
  assert.equal(savedEvent.payload.item.thumbnailUrl, "");
  assert.equal(savedEvent.payload.item.storageError, undefined);
  assert.doesNotMatch(text, /^event: error$/m);
  assert.match(text, /event: complete/);
});

test("Cloudflare generation fails clearly when the R2 image bucket is not bound", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("jobId", "job-cloudflare");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl() {
      seenRequests.push(true);
      return makeSseResponse();
    },
  });

  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 0);
  assert.match(text, /event: error/);
  assert.match(text, /IMAGE_BUCKET/);
});

test("Cloudflare interactive generation streams chunks even when a queue binding exists", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const generationQueue = makeGenerationQueue();
  const formData = new FormData();
  formData.set("jobId", "job-async");
  formData.set("clientSessionId", "session-async");
  formData.set("prompt", "Create a simple product poster");
  formData.set("ratio", "1:1");
  formData.set("size", "2048x2048");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    generationQueue,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse("aW50ZXJhY3RpdmUtZmluYWw=");
    },
  });
  const text = await response.text();
  const events = parseSseEvents(text);

  assert.equal(response.status, 200);
  assert.equal(generationQueue.messages.length, 0);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.ok(events.some((event) => event.eventName === "final_image_chunk"));
  assert.ok(events.some((event) => event.eventName === "saved"));
  assert.ok(events.some((event) => event.eventName === "complete"));
  assert.equal(events.some((event) => event.eventName === "queued"), false);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare style transfer generation labels source and style references", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-style-transfer");
  formData.set("prompt", "Transfer the second image style onto the first image");
  formData.set("mode", "style-transfer");
  formData.set("ratio", "1:1");
  formData.set("size", "2048x2048");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["source"], "source.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["style"], "style.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const content = seenRequests[0].body.input[0].content;

  assert.equal(response.status, 200);
  assert.match(text, /event: complete/);
  assert.equal(seenRequests.length, 1);
  assert.equal(content.filter((item) => item.type === "input_image").length, 2);
  assert.match(content[1].text, /SOURCE image/);
  assert.match(content[3].text, /STYLE reference/);
});

test("Cloudflare style transfer generation requires both source and style images", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-style-transfer-missing");
  formData.set("prompt", "Transfer style");
  formData.set("mode", "style-transfer");
  formData.set("ratio", "1:1");
  formData.set("size", "2048x2048");
  formData.set("format", "png");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["source"], "source.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({ url, body: init.body });
      return makeSseResponse();
    },
  });

  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 0);
  assert.match(text, /event: error/);
  assert.match(text, /风格迁移需要上传原图和风格参考图/);
});

test("Cloudflare image proxy rejects invalid keys", async () => {
  const imageBucket = makeImageBucket();
  const response = await handleApiRequest(new Request("https://studio.example/api/images/..%2Fsecret.png"), {
    imageBucket,
  });

  assert.equal(response.status, 400);
});

test("Cloudflare config endpoint never returns a saved API key", async () => {
  const response = await handleApiRequest(new Request("https://studio.example/api/config"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.apiKeyConfigured, false);
  assert.equal("apiKey" in payload, false);
  assert.equal(payload.responsesModel, "gpt-5.5");
  assert.equal(payload.defaults.size, "896x1120");
});

test("Cloudflare model list route uses browser API settings without echoing the key", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("baseUrl", "https://example.test");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/models", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
      });
      return new Response(JSON.stringify({
        data: [
          { id: "gpt-5.5" },
          { id: "gpt-image-2" },
          { id: "" },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/models");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.models, ["gpt-5.5", "gpt-image-2"]);
  assert.doesNotMatch(JSON.stringify(payload), /test-browser-key/);
});

test("Cloudflare model list route uses direct API settings for direct image mode", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("imageRoute", "b");
  formData.set("baseUrl", "https://route-a.example.test");
  formData.set("apiKey", "route-a-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("directBaseUrl", "https://direct.example.test");
  formData.set("directApiKey", "direct-browser-key");
  formData.set("directImageModel", "vendor-image-pro");

  const response = await handleApiRequest(new Request("https://studio.example/api/models", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
      });
      return new Response(JSON.stringify({
        data: [
          { id: "vendor-image-pro" },
          { id: "gpt-image-2" },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://direct.example.test/v1/models");
  assert.equal(seenRequests[0].auth, "Bearer direct-browser-key");
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.models, ["vendor-image-pro", "gpt-image-2"]);
  assert.doesNotMatch(JSON.stringify(payload), /direct-browser-key/);
  assert.doesNotMatch(JSON.stringify(payload), /route-a-key/);
});

test("Cloudflare model list route returns upstream failures as a gateway error when a key is present", async () => {
  const formData = new FormData();
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/models", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl() {
      return new Response(JSON.stringify({ error: { message: "upstream unavailable" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /upstream unavailable/);
  assert.doesNotMatch(JSON.stringify(payload), /test-browser-key/);
});

test("Cloudflare PPT analysis uses browser API settings and returns parameter recommendations", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("sourceText", "Quarterly sales grew 22%. Next quarter focuses on channel expansion.");
  formData.set("topic", "Quarterly review");
  formData.set("pageCount", "8");
  formData.set("stylePreset", "business");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/ppt/analyze", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            summary: "Quarterly review with growth and channel expansion.",
            recommendedPageCount: 6,
            recommendedStylePreset: "finance",
            rationale: "Data-heavy executive update.",
            sections: [
              { title: "Performance", keyMessage: "Sales grew 22%", suggestedSlides: 2 },
              { title: "Next Quarter", keyMessage: "Expand channels", suggestedSlides: 4 },
            ],
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-browser-key");
  assert.equal(seenRequests[0].body.text.format.name, "ppt_document_analysis");
  assert.equal(payload.ok, true);
  assert.equal(payload.analysis.recommendedPageCount, 6);
  assert.equal(payload.analysis.recommendedStylePreset, "finance");
  assert.equal(payload.analysis.sections.length, 2);
  assert.doesNotMatch(JSON.stringify(payload), /test-browser-key/);
});

test("Cloudflare PPT generation uses browser-provided API settings and returns a downloadable deck", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("topic", "Quarterly launch recap");
  formData.set("pageCount", "1");
  formData.set("stylePreset", "business");
  formData.set("dynamicPreset", "none");
  formData.set("transitionPreset", "none");
  formData.set("transitionSpeed", "medium");
  formData.set("autoAdvanceSeconds", "0");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/ppt/generate", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body,
      });

      if (body?.text?.format?.name === "ppt_deck_outline") {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              title: "Quarterly launch recap",
              summary: "One-slide recap",
              slides: [
                {
                  slideNumber: 1,
                  title: "Launch recap",
                  keyMessage: "Growth is on track",
                  visualBrief: "Clean business slide",
                  speakerNotes: "Discuss launch metrics",
                },
              ],
            }),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return makeSseResponse("aW1hZ2UtYnl0ZXM=");
    },
  });

  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 2);
  assert.deepEqual(seenRequests.map((entry) => entry.url), [
    "https://example.test/v1/responses",
    "https://example.test/v1/responses",
  ]);
  assert.deepEqual(seenRequests.map((entry) => entry.auth), [
    "Bearer test-browser-key",
    "Bearer test-browser-key",
  ]);
  assert.deepEqual(seenRequests.map((entry) => entry.body.model), ["gpt-5.5", "gpt-5.5"]);
  assert.match(text, /event: outline/);
  assert.match(text, /event: slide_saved/);
  assert.match(text, /event: deck_saved/);
  assert.match(text, /data:application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation;base64,/);
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare PPT generation reports editable reconstruction as local-only while preserving ordinary PPTX", async () => {
  const seenRequests = [];
  const formData = new FormData();
  formData.set("topic", "Quarterly launch recap");
  formData.set("pageCount", "1");
  formData.set("stylePreset", "business");
  formData.set("exportMode", "editable-reconstruction");
  formData.set("dynamicPreset", "none");
  formData.set("transitionPreset", "none");
  formData.set("transitionSpeed", "medium");
  formData.set("autoAdvanceSeconds", "0");
  formData.set("reasoningEffort", "high");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");

  const response = await handleApiRequest(new Request("https://studio.example/api/ppt/generate", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      seenRequests.push({ url, auth: init.headers.Authorization, body });

      if (body?.text?.format?.name === "ppt_deck_outline") {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              title: "Quarterly launch recap",
              summary: "One-slide recap",
              slides: [
                {
                  slideNumber: 1,
                  title: "Launch recap",
                  keyMessage: "Growth is on track",
                  visualBrief: "Clean business slide",
                  speakerNotes: "Discuss launch metrics",
                },
              ],
            }),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return makeSseResponse("aW1hZ2UtYnl0ZXM=");
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const deck = events.find((event) => event.eventName === "deck_saved")?.payload.deck;
  const warning = events.find((event) => event.eventName === "editable_reconstruction_warning");

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 2);
  assert.match(text, /event: deck_saved/);
  assert.match(deck.pptxUrl, /^data:application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation;base64,/);
  assert.equal(deck.editablePptxUrl, "");
  assert.equal(deck.exportMode, "editable-reconstruction");
  assert.ok(warning);
  assert.match(warning.payload.message, /local-only/i);
  assert.doesNotMatch(text, /test-browser-key/);
});
