import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePptDocumentAnalysis,
  requestPptDocumentAnalysis,
} from "../lib/ppt-document-analysis.mjs";

test("PPT document analysis normalizes recommended page count, style and sections", () => {
  const analysis = normalizePptDocumentAnalysis({
    summary: "Sales proposal with product positioning and rollout plan.",
    recommendedPageCount: 32,
    recommendedStylePreset: "unknown",
    rationale: "Use a concise business deck.",
    sections: [
      { title: "Context", keyMessage: "Market changed", suggestedSlides: 2 },
      { title: "Plan", keyMessage: "Launch in phases", suggestedSlides: 3 },
    ],
  });

  assert.equal(analysis.recommendedPageCount, 20);
  assert.equal(analysis.recommendedStylePreset, "business");
  assert.equal(analysis.sections.length, 2);
  assert.deepEqual(
    analysis.sections.map((section) => section.suggestedSlides),
    [2, 3],
  );
  assert.match(analysis.summary, /Sales proposal/);
});

test("PPT document analysis request asks the model to split content and choose from known styles", async () => {
  const seenRequests = [];
  const result = await requestPptDocumentAnalysis({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.5",
    sourceText: "Quarterly sales grew 22%. Next quarter focuses on channel expansion.",
    topic: "Quarterly review",
    currentPageCount: 8,
    currentStylePreset: "finance",
    fetchImpl: async (url, init) => {
      seenRequests.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            summary: "Quarterly review with growth and channel expansion.",
            recommendedPageCount: 6,
            recommendedStylePreset: "finance",
            rationale: "The source is data-heavy and executive-facing.",
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

  const inputText = seenRequests[0].body.input[0].content
    .filter((item) => item.type === "input_text")
    .map((item) => item.text)
    .join("\n");

  assert.equal(seenRequests.length, 1);
  assert.equal(seenRequests[0].url, "https://example.test/v1/responses");
  assert.equal(seenRequests[0].auth, "Bearer test-key");
  assert.equal(seenRequests[0].body.text.format.name, "ppt_document_analysis");
  assert.equal(result.recommendedPageCount, 6);
  assert.equal(result.recommendedStylePreset, "finance");
  assert.match(inputText, /split the source into presentation sections/i);
  assert.match(inputText, /business/);
  assert.match(inputText, /finance/);
});
