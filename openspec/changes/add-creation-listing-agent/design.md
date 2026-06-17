## Context

Creation Mode currently stores product input, selling points, dimensions, target language, selected roles, category path, SKU subject groups, item prompts, item statuses, and saved image paths in set manifests. This is enough to drive a Listing Agent without creating a separate standalone listing tool.

The first version targets Amazon US English listings. Generated copy must be conservative because image understanding and generation results can fail or be incomplete.

## Goals

- Make listing generation optional and non-blocking for the main image generation workflow.
- Generate listing drafts by SKU count, using `skuSubjects` as the primary source of SKU count.
- Fall back to one main product listing when no SKU subject is present.
- Use generated images and analysis outputs when available.
- Fall back to typed input and manifest metadata when images fail or are missing.
- Enforce 500 characters per generated field and per bullet.
- Keep the listing output structured, editable, copyable, exportable, and persisted with the Creation set.

## Non-Goals

- Publishing listings to Amazon.
- Fetching live Amazon category rules by API.
- Guaranteeing legal, compliance, medical, or safety claims.
- Replacing the user's final listing review.

## Proposed Architecture

### Data Model

Each Creation set manifest may include `listingDrafts`:

```json
{
  "listingDrafts": [
    {
      "id": "listing-sku-blue",
      "marketplace": "amazon-us",
      "language": "en-US",
      "skuSubjectId": "blue",
      "skuTitle": "Blue lure",
      "evidenceMode": "image-backed",
      "status": "completed",
      "title": "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait ...",
      "sellingPoints": [],
      "painPoints": [],
      "fiveBullets": [],
      "description": "",
      "backendSearchTerms": "",
      "keywordBuckets": {
        "exact": [],
        "longTail": [],
        "traffic": [],
        "descriptive": []
      },
      "evidence": [],
      "missingInfo": [],
      "warnings": [],
      "createdAt": "2026-05-24T00:00:00.000Z",
      "updatedAt": "2026-05-24T00:00:00.000Z"
    }
  ]
}
```

`evidenceMode` values:

- `image-backed`: at least one completed generated image for the set or SKU was used.
- `mixed`: some completed images were used, but at least one relevant SKU or planned image failed.
- `input-only`: generated images were unavailable; listing was based on user inputs and manifest metadata only.

### Source Selection

For the parent listing package, the agent should collect:

- SKU subject title, note, filenames, and reference indexes.
- Product name, product description, selling points, dimension specs, category path, target language, visual language, marketing scenario, and industry template.
- Completed generated images relevant to the SKU when available.
- Completed non-SKU main images when SKU-specific images are absent but the set has usable visual evidence.
- Planned item prompts and saved marketing copy.
- Reference-role notes and category hints from Creation reference analysis.

If generated images are missing or failed, the agent must not block listing generation. It should switch to `input-only` or `mixed`, avoid image-derived claims, and add a warning such as `Generated images were unavailable; copy is based on product inputs and saved SKU metadata.`

### Generation Flow

1. User enables the Listing Agent in Creation Mode or clicks a manual action in Creation records.
2. The server resolves the Creation set manifest by `setId`.
3. The system builds one parent listing request for the Creation set, using SKU subjects as variant metadata and pack-count evidence.
4. The request asks the model for strict JSON using the listing schema.
5. The validator normalizes and checks every generated field and bullet.
6. If validation fails, the system retries once with explicit validation feedback.
7. If the retry fails, the listing draft is blocked or marked failed with warnings and missing information.
8. Successful drafts are saved back into the Creation set manifest and rendered in the Creation record detail.

Automatic listing generation after image generation is best-effort. It must not turn an otherwise usable Creation set into a failed image-generation set.

### Validation Rules

- `title`, `description`, `backendSearchTerms`, each selling point, each pain point, each keyword bucket item, and each five-point bullet must be no longer than 500 characters after trimming whitespace.
- Title must start with quantity. If SKU subject metadata shows multiple complete sellable units, the title must not fall back to `1 Pack`.
- Title must keep size, dimensions, weight, hook size, model specs, and measurement values out of the title.
- Title must avoid keyword stuffing, promotional phrases, unverifiable claims, competitor brands, and unsupported certifications.
- Five bullets must be distinct and must not repeat the title verbatim.
- Pain points must describe customer problems the product can address without making unsafe claims.
- Keywords must be deduplicated case-insensitively while preserving exact, long-tail, traffic, and descriptive buckets.
- Backend search terms must be non-empty, search-focused, and avoid punctuation-heavy stuffing and competitor brand terms.
- Claims about material, warranty, certifications, medical outcomes, safety ratings, compatibility, or performance must come from user input or explicit SKU metadata, not from image inference alone.

### UI Placement

- Creation Mode: add an optional Listing Agent switch near the generation options.
- Creation record detail: add a Listing section with generate, rewrite, copy, and export controls.
- Per listing: show title, five bullets, selling points, pain points, description, keyword buckets, backend search terms, evidence mode, warnings, and missing information.
- Failed or fallback drafts should remain visible with clear status instead of disappearing.

### Persistence And Export

- Listing drafts are saved into the selected Creation set manifest.
- Users can export listing drafts as JSON.
- Users can copy one SKU listing, all SKU listings, or selected fields.
- Export does not include API keys or local absolute paths.

## Risks / Trade-offs

- Image-based copy can overclaim. The validator and prompt must prefer conservative language and show evidence warnings.
- Amazon category rules vary. First version uses Amazon US general guardrails and keeps future category-specific rule packs out of scope.
- Search term byte limits can differ by surface. The first version should enforce the 500-character user requirement and leave stricter backend byte checks as an additional warning, not the only validation gate.
- Cloudflare cannot read local output files. Worker-side listing generation must use explicit payload metadata or browser-provided image data; otherwise it should fall back to input-only behavior.
