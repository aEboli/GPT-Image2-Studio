# Workflow and parameter reference

[Back to README](../README.md) · [简体中文](./reference.zh-CN.md)

## GPT Image 2.6

Choose **gpt-image-2.6-sunburst** or **gpt-image-2.6-flare** in configuration. Existing model selections remain unchanged. Route A uses Responses; “Send tools[].model” now defaults to on. If previously disabled explicitly, enable it for advanced features. Route B supports Images API or Responses; Responses keeps its outer text model separate from the image tool model.

All GPT prompt-generation models and direct aliases on routes A/B share Auto / PNG / JPG / WebP / GIF animation / SVG vector shortcuts. Auto is the default: explicit format or animation requests select that format; otherwise PNG is used. Animation styles and format names within depicted text do not imply an animated output. Manual choices take priority, with conflicts shown as advisory messages. Unconfirmed model format support is also advisory: requests retain the chosen format for the provider to accept or reject, without a PNG fallback. The effective format, selection source, and GIF timing appear before Generate and are frozen when queued. GIF frames and timing are editable there; More 2.6 settings opens the shared advanced panel for 2.6 models.

The shared advanced panel exposes complexity, background, compression, partial previews, size override, candidate count, GIF frames/timing, and SVG author settings. Blank fields retain upstream defaults. Image complexity, render quality, outer reasoning, and SVG author reasoning remain independent. The 2.6 quality choices include auto, low, medium, high, xhigh, and max.

- Prompt generation supports PNG, JPG, WebP, GIF, and SVG. Ordinary Images requests support 1–10 candidates and up to 16 references; GIF/SVG generation requires no reference image.
- Image editing adds a markup strategy using the existing drawing canvas. It submits a transparent PNG matching the source dimensions; markup and mask are mutually exclusive.
- GIF originals retain animation and support pause/play in the lightbox. GIF requests that return PNG or a single-frame GIF report a format or animation validation error. SVG gallery tiles, filmstrip images, and details prefer the validated vector original even when a bitmap thumbnail is cached. Tiles identify SVG vectors and download controls explicitly offer the SVG original. Downloads retain GIF/SVG/WebP rather than silently converting to PNG.
- Ecommerce, portrait, article, and PPT image slots remain static, single-result workflows with applicable shared options. Task snapshots and repairs preserve advanced settings.
- Images GIF/SVG requests use JSON completion. Responses GIF may retain lifecycle SSE; neither requests partial image previews. Transparency requires PNG/WebP; compression applies to JPG/WebP.

GIF requires preview access, and selecting an SVG author model requires separate permission. Leave SVG author settings blank without that access. GIF defaults to 9 frames at 200 ms. The application accepts 2–64 frames; confirm the actual frame limit with your configured provider. Custom sizes receive basic positive-integer validation; actual bounds remain provider/model enforced. Unsupported combinations surface errors without changing the selected model or format.

CLI examples:

~~~powershell
cmd /c npm run generate -- --image-model gpt-image-2.6-flare --endpoint images/generations --prompt "A simple blue icon" --format svg --output ./output/icon.svg
cmd /c npm run generate -- --image-model gpt-image-2.6-sunburst --endpoint images/generations --prompt "A looping floating balloon" --format gif --frame-count 9 --frame-duration-ms 200 --output ./output/balloon.gif
~~~

Run npm run help for all flags. Mock transport integration, browser checks, and Electron startup were verified; this development configuration has no usable API key, so real model calls and account permissions remain unverified. See the [v0.2.127 release notes](./releases/v0.2.127.md).

## Workflow map

| Workflow | Inputs | Result |
| --- | --- | --- |
| Prompt-to-image | Prompt, up to 15 references, optional enhancement, ratio, size, format, optional transparent background | Selected-format assets, progress, filmstrip, downloads, and metadata review |
| Image-to-prompt | One image | Reusable subject and framing JSON with prioritized source-style anchors, crisp subject/texture intent, `4K/8K` visual-quality wording, and image-specific drift constraints |
| Style transfer | Source image, style image or preset, optional prompt | A generated result plus a before/after preset comparison |
| Reference analysis | 1-15 images, analysis language, target description | Structured analysis and an optional generation prompt/result |
| Image decomposition | One product/device/package image and a decomposition brief | Callout or infographic-style PNG/JPG and saved analysis |
| Image editing | Source image, whole-image instruction, or local masks | Edited PNG/JPG, region retry, and lightbox review |
| Quick blend | Indexed A/B groups, optional C/D groups, layout settings | One independent generation task per matched group |
| Ecommerce set | Product facts, references, platform, category, SKU | Frozen carousel plan, generated set, Listing draft, and record; separate logo-batch processing for uploaded source images |
| Portraits | Person/action/clothing references, location, style, framing, count | A consistent 1-100 image series and retryable record |
| Article illustrations | Text package or pasted article, style and content type | Style bible, reference cards, storyboard, and PNG illustrations |
| PPT | Documents, text, or topic; 1-20 pages | Page PNGs, image-based PPTX, or editable reconstructed PPTX |

## Temu Excel export

Select one or more Creation records, open **temuexcel导出工作台**, and switch to **Batch quick export**. The exporter uses the versioned template shipped in the repository, writes one row per SKU, reuses public HTTPS image URLs, and can convert local images through a Cloudinary unsigned upload (`cloudName` plus `uploadPreset`). It never asks for or stores a Cloudinary API key, API secret, signature, Authorization header, or browser cookie.

This is a local Node.js / Windows desktop capability. It does not log in to Temu, import the workbook, solve verification challenges, or publish a product. Missing product facts or public images remain blank and are reported in the `Export issues` sheet. Review the workbook and Temu's current validation results before uploading.

### Temu listing workbench

**temuexcel导出工作台** opens the built-in Temu listing workbench as a full-screen overlay. No record selection is required, and selected Creation records never trigger an automatic import. There is no second service to start and no second port to manage. The workbench opens on its main editing interface; use its explicit **Import from Studio** action when you want to bring in existing Creation records. It lets you fill in the 51 template columns by hand per product, maintain the two-variant SKU matrix, override price, dimensions, weight and stock per SKU, manage carousel and packaging images, and export the workbook directly.

The overlay has two sibling tabs:

- **Listing workbench** — the default tab, for manual per-field editing and export. Its workbook keeps the template's original two sheets.
- **Batch quick export** — the existing batch flow. Preflight, strict versus fill-in export modes, the batch defaults form, and per-record export state write-back all behave exactly as before, and its workbook still carries the `Export issues` sheet.

Closing the overlay only hides it: in-progress drafts, scroll position, and not-yet-uploaded local image previews survive, so reopening resumes where you left off. Workbench drafts live in the current browser; use the workbench's own draft backup export/restore to move them across browsers or reinstalls.

The workbench only reads existing Creation records. It never starts a generation job, logs in to a store, or publishes a product. SKU images must be square and larger than 800 pixels on both sides, carousel images are capped at 10 and packaging images at 6, and every template image field must be a public HTTPS URL verified by the local server.

## Parameters, resolutions, and limits

> [!IMPORTANT]
> These tables describe the candidates this application offers and the constraints it applies. They are not a promise that every upstream model, compatible gateway, or ecommerce platform supports these sizes. Accepted parameters, billing, delivered pixels, formats, and platform review rules come from the provider and target platform you choose, and a gateway may ignore, rewrite, or reject what the app sends.

### Aspect ratios and pixel sizes

GPT's Route and Direct modes share the explicit pixel candidates below. The first candidate is the default for the selected ratio; no automatic resolution option is displayed or sent. The middle column lists the other candidates in UI order, excluding the default and largest values.

The parameter selectors keep the visible values literal: reasoning options show only `Low`, `Medium`, `High`, and `XHigh`, while concrete GPT sizes show only `width x height`. The `value` sent to the provider is unchanged. Gemini's `512`/`1K`/`2K`/`4K` and Grok's `1k`/`2k` remain provider-specific resolution tiers.

| Ratio | Typical use | Default size | Other candidates | Largest |
| --- | --- | --- | --- | --- |
| `1:1` | Ecommerce hero images, avatars, social posts | `1024x1024` | `1536x1536`, `2048x2048`, `2560x2560` | `2880x2880` |
| `4:3` | Slides, in-page web imagery | `1360x1024` | `2048x1536`, `2720x2048` | `3312x2480` |
| `3:4` | Posters, portraits | `1024x1360` | `1536x2048`, `2048x2720` | `2480x3312` |
| `3:2` | Landscape photography | `1536x1024` | `2304x1536`, `3072x2048` | `3520x2352` |
| `2:3` | Portrait photography | `1024x1536` | `1536x2304`, `2048x3072` | `2352x3520` |
| `5:4` | Product display | `1280x1024` | `1920x1536`, `2560x2048` | `3200x2560` |
| `4:5` | Vertical social posts | `1024x1280` | `1536x1920`, `2048x2560` | `2560x3200` |
| `16:9` | Landscape covers, video thumbnails | `1824x1024` | `2736x1536`, `3648x2048` | `3840x2160` |
| `9:16` | Short-video covers, phone wallpaper | `1024x1824` | `1536x2736`, `2048x3648` | `2160x3840` |
| `21:9` | Ultra-wide banners | `2384x1024` | `1680x720`, `3584x1536` | `3840x1648` |
| `9:21` | Ultra-tall images | `1024x2384` | `720x1680`, `1536x3584` | `1648x3840` |
| `2:1` | Banners | `2048x1024` | `3072x1536` | `3840x1920` |
| `1:2` | Tall posters | `1024x2048` | `1536x3072` | `1920x3840` |
| `3:1` | Ultra-wide advertising images | `3072x1024` | none | `3840x1280` |
| `1:3` | Ultra-tall advertising images | `1024x3072` | none | `1280x3840` |

Two details are easy to misread. The `21:9` and `9:21` lists are not sorted by pixel count: their `720P` candidate (`1680x720` / `720x1680`) sits after the default in the UI but is smaller than it. And `3:1` and `1:3` offer only two choices each (the default and largest), so their middle column is empty rather than incomplete.

### How size differs across image routes

| Channel | Protocol | Size values the app sends | Concrete default | Constraint to know |
| --- | --- | --- | --- | --- |
| Route mode | Responses API plus the image tool | The explicit ratio-bound pixels above | Base size for the current ratio | The UI offers only the `responses` suffix, and the upstream can still adjust delivered pixels. Image editing is the exception: it always posts to `images/edits` and ignores the configured suffix |
| Direct mode | `images/generations`, `responses`, or `chat/completions` | The same explicit pixels as route mode | Base size for the current ratio | Compatibility depends on the gateway and model; edit requests may be rerouted to `images/edits` |
| Gemini | Gemini image generation, or a `chat/completions`-compatible shape for non-Gemini models | `512`, `1K`, `2K`, `4K` | `1K` | These are tiers, not promised pixel counts; the default model identifier is an app default, not proof the provider serves it, and some models or gateways reject references, ratios, or `4K` |
| Grok | xAI JSON `images/generations` / `images/edits` | `resolution: 1k` or `2k`, plus a supported `aspect_ratio` | Derived from the current ratio's explicit default dimensions | Requested pixels are not sent as `size`; references are limited to five, quality to `low` / `medium`, and local masks are unsupported |

The following constraints are worth knowing before you pick a ratio:

- **A size is only legal for its own ratio.** The requested pixels must be one of the candidates listed for the selected ratio; anything else is rejected before the upstream call with `当前比例 <ratio> 不支持分辨率 <size>` ("the current ratio does not support that resolution"). That is why `1:1` will not accept `1824x1024` even though `16:9` offers it.
- **Switching between pixel and tier routes resolves an incompatible size to a concrete default.** A saved `2048x2048` becomes `1K` on Gemini; a saved `4K` becomes the selected ratio's default pixels on GPT. Legacy automatic values follow the same normalization.
- **The Gemini image path supports 10 of the 15 ratios.** It accepts `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, and `21:9`. The other five are substituted with the closest supported ratio that keeps the requested orientation: `2:1` and `3:1` become `16:9` and `21:9`; `1:2`, `9:21`, and `1:3` become `9:16`. On this channel the delivered shape is therefore close to your request rather than exact, and it stays landscape or portrait as asked.
- **Quality, output format, and transparent backgrounds never reach the Gemini image path.** The request body only carries `aspectRatio` and `imageSize`; PNG vs JPG, the High quality control, and the prompt background switch have no effect here.
- **Transparent prompt backgrounds are supported on GPT Route and Direct image routes only.** The control is hidden for Gemini and Grok, and their requests omit the background parameter.
- **Grok uses its own image controls.** Image requests send only `low` / `medium` quality and `1k` / `2k` resolution, never GPT reasoning effort. Quality and reasoning remain independent for GPT text/vision planning.
- **The Gemini image body is selected by the model name, not by the channel.** The name must contain `gemini` plus one of `image`, `banana`, `图像`, or `生图`. Any other model on this channel is posted to `chat/completions` with neither size nor ratio.

### Workflow limits

The UI exposes conservative application candidates, not a guarantee from every upstream model or gateway. Actual accepted parameters, billing, output pixels, image formats, and platform review rules are controlled by the selected provider.

| Area | Current application boundary |
| --- | --- |
| Prompt references | Up to 15 images, or five on Grok; a session has up to 15 parallel task slots |
| Style transfer | One source image plus one style reference or built-in preset |
| Image-edit masks | Each local mask is limited to 50 MB and normalized to the source dimensions |
| Ecommerce SKU plans | New plans use one subject per SKU bundle; frozen plans are limited to 64 items and 4 MiB serialized size |
| Portrait batches | 1-100 images; the default is 12 |
| PPT pages | 1-20 pages; the default is 8 |
| Output formats | GPT prompt jobs offer PNG/JPG/WebP/GIF/SVG; other workflows use static formats. Actual support follows the selected model and endpoint |

Large images, high resolutions, and large batches increase browser memory use and the chance of upstream timeouts or rate limits. Start with the selected route's explicit default size and a small batch, then increase scale after compatibility is proven.

Creation, Portrait, Article Illustration, and PPT each expose independent reasoning-effort and image-quality selectors. GPT planning retains its reasoning setting, while Grok image calls and their saved metadata omit GPT-only reasoning. Quality is normalized for the selected route and model (`xhigh` / `max` on GPT 2.5 and 2.6 image models; `low` / `medium` on Grok). A queued set or deck keeps its effective values for generation, repair, missing-slide completion, and slide editing. Creation keeps the SKU generation rule editable while new plans use a fixed one-subject SKU count.
