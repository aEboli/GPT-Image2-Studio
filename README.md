# GPT-Image2-Studio

<div align="center">

[![Version](https://img.shields.io/badge/version-v0.2.14-2563eb.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)
[![Windows](https://img.shields.io/badge/Windows-Installers-0078d4.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases)

**A local-first AI image generation and visual production workbench**

Prompt-to-image, reference analysis, editing, ecommerce sets, portraits, article illustrations, PPT generation, and asset history in one browser-based workspace.

Current version: `v0.2.14`

[Chinese README](./README.zh-CN.md)

</div>

## Quick start

Installing is not enough on its own: nothing generates until you enter your own API credentials. On a first run, follow [Beginner API setup](#beginner-api-setup).

### Run from source

Requirements:

- Node.js 20 or newer for the local service.
- An OpenAI API key or credentials for a compatible image service.

```powershell
git clone https://github.com/aEboli/GPT-Image2-Studio.git
cd GPT-Image2-Studio
cmd /c npm ci
cmd /c npm start
```

Open `http://127.0.0.1:3600`. To use another free port:

```powershell
$env:PORT="3601"
cmd /c npm start
```

On Windows, `launch-studio.cmd` starts the workbench and `stop-studio-services.cmd` stops this project's services on ports 3600-3606.

### Windows desktop app (recommended)

Download `GPT-Image2-Studio-Desktop-Setup-v0.2.14-x64.exe` from [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases). The Electron app runs in a dedicated window and includes its runtime, so Node.js is not required after installation. See [Windows desktop documentation](./docs/windows-desktop.md).

For a no-install desktop copy, download `GPT-Image2-Studio-Portable-v0.2.14-x64.zip`, extract the complete archive, and run `GPT-Image2-Studio.exe` at the archive root. Keep the extracted files together; this portable copy does not create an installer entry or uninstall record.

For desktop development, Electron 43 requires Node.js 22.12 or newer:

```powershell
cmd /c npm ci
cmd /c npm run desktop
```

### Windows browser installer

The legacy browser-installer flow remains documented for local builds, but the `v0.2.14` GitHub Release does not include its IExpress package. Use the desktop NSIS installer or the portable ZIP above; see [Windows installer documentation](./docs/windows-installer.md) only if you need to build the compatibility flow yourself.

## Configuration

### Beginner API setup

Start here on a first run. Studio ships no model quota and never holds keys for you. It stores your own API credentials on the local machine and calls the service you choose with them.

#### Step 1: collect three things

| What you need | Meaning | Example |
| --- | --- | --- |
| Base URL | The API root the provider gives you, usually ending in `/v1` | `https://api.openai.com/v1` |
| API key | The key created in the provider's console | `sk-****` |
| Model name | A model identifier spelled the way that provider spells it | `gpt-5.4-mini`, `gpt-image-2` |

Create keys in the OpenAI console for the official channel; compatible services and third-party gateways publish their own base URL and key. Billing, rate limits, and content policy come from the provider you configure.

#### Step 2: open the configuration panel

- From source: run `cmd /c npm start` and open `http://127.0.0.1:3600`.
- Desktop app: launch `GPT-Image2-Studio`. The built-in service uses a dynamic loopback port, so there is no address to type.
- Click **配置** (Configuration) in the top-right corner, or use the top navigation **配置 → 配置 API**. The first card in the panel is the call channel.
- The drawer header carries a `CN` / `EN` switch. Press `EN` once and the whole interface, including every label below, turns English.
- Until a save succeeds, the top-right status stays on `配置未保存` (Configuration not saved).

#### Step 3: pick one call channel

Each channel is stored independently, and only the selected one is used for generation. When in doubt, keep the default route mode.

| Channel | Fits a provider that | You fill in |
| --- | --- | --- |
| Route mode (default) | Supports `POST /responses` with the `image_generation` tool, such as OpenAI itself or a gateway aligned with it | Endpoint URL, API key, Responses model |
| Direct-call mode | Only offers `images/generations` or `chat/completions`, or when image and text come from two different providers | Three image fields plus three text/vision fields |
| Gemini model | Serves Gemini image models over the AGICTO image-generation protocol | Base URL, API key, image model |

#### Step 4: fill in the fields for that channel

**Route mode.** The endpoint suffix is fixed to `responses`:

```text
Endpoint URL: https://api.openai.com/v1
API key:      sk-****
Responses model: gpt-5.4-mini
```

The Responses model is the outer model. The image tool model is fixed to `gpt-image-2`, shown in the prompt page parameter row as `工具模型 gpt-image-2`.

**Direct-call mode** splits into two independent groups. The image group only generates and edits images; the text/vision group handles prompt enhancement, reference analysis, Listing drafts, and other model calls. The two groups can point at different providers:

```text
Image API:       https://api.openai.com/v1   suffix images/generations   model gpt-image-2
Text/vision API: https://api.openai.com/v1   suffix responses            model gpt-5.4-mini
```

**Gemini model.** The actual request is the base URL plus `/images/generations`:

```text
Base URL:    https://api.agicto.cn/v1
API key:     <key from the provider>
Image model: gemini-3.1-flash-image-preview
```

If the provider gave you one complete address instead, press **完整 URL** (Full URL) next to the endpoint field and paste the whole thing, for example `https://vendor.example/v1/responses`. Studio splits it into a base URL and an endpoint suffix.

Leave the generation scheduling card at its defaults (`20` concurrent requests, `1000` ms between submissions). Both fields lock while any generation task is running.

#### Step 5: test the connection, then save

- Press **测试连接** (Test connection). For the selected channel it requests `GET <base URL>/v1/models` (appending `/v1` when the address does not already end with it) using `Authorization: Bearer <your key>`. A key you just typed and have not saved yet is included in that test.
- **获取模型列表** (Fetch Models) uses the same endpoint, so you can pick a model name from the list instead of typing it.
- Press **保存** (Save). The top-right status turns into `配置已保存` (Configuration saved) and a masked hint appears next to the API key field.
- Saving with the API key box empty keeps the previously saved key rather than clearing it.

A passing connection test only proves that the credentials and the `/models` endpoint work. It is not proof that the channel supports generation, editing, references, or the largest sizes. Some gateways never implement `/models`, so the test can fail while generation still works: type the model name by hand, save, and verify with one real generation.

#### Step 6: generate one image to confirm

Close the panel, go back to **提示词生图** (Prompt-to-image), write one short prompt, choose the `1:1` ratio, leave the size on automatic, and generate. Progress shows on the preview stage; the full log lives in the `生成日志` (Activity log) panel at the bottom of the configuration drawer. A successful image is written to:

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\prompt\
```

#### Common first-run problems

| Symptom | Usual cause | What to do |
| --- | --- | --- |
| Status stays on `配置未保存` | Save was never pressed, or the filled-in group is not the selected channel | Confirm the selected channel is the group you filled in, then save |
| Test connection returns 401 or reports an invalid key | Wrong key, whitespace pasted with it, or a key that does not belong to that base URL | Paste the key again and confirm key and address come from the same provider |
| Test connection returns 404, or reports no callable model | The provider serves no `/models` list | Skip the test, type the model name, save, and verify with a real generation |
| Generation reports an unknown model | The identifier is not spelled the way that provider spells it | Use Fetch Models to read the real names |
| Route mode fails for images while text calls succeed | The provider does not support the Responses `image_generation` tool | Switch to direct-call mode and set the image suffix to `images/generations` |
| A token or remote authentication prompt appears | You are reaching the local service over a non-loopback address | See [Remote access](#remote-access) |

Configuration stays local: the Node service writes `.local/config.json`, the desktop build writes the Electron app-data directory, and cloud deployments keep private values in the browser. Do not leave keys on a shared machine.

### Configure in the UI

The first-run walkthrough is in [Beginner API setup](#beginner-api-setup). Existing installations using `directBaseUrl`, `directApiKey`, `directEndpointPath`, `directImageModel`, and `directResponsesModel` continue to work as a bounded compatibility fallback. New channel-specific values take precedence independently, and a blank key input keeps the previously saved private key.

Common endpoint suffixes:

| Suffix | Typical use |
| --- | --- |
| `responses` | Responses-style routed requests |
| `chat/completions` | Chat Completions-compatible gateways |
| `images/generations` | Direct image generation |
| `images/edits` | Image editing requests |

Direct-call environment variables are split by purpose:

| Variables | Purpose |
| --- | --- |
| `DIRECT_IMAGE_BASE_URL`, `DIRECT_IMAGE_API_KEY`, `DIRECT_IMAGE_ENDPOINT_PATH`, `DIRECT_IMAGE_MODEL` | Direct image-generation and editing channel |
| `DIRECT_TEXT_BASE_URL`, `DIRECT_TEXT_API_KEY`, `DIRECT_TEXT_ENDPOINT_PATH`, `DIRECT_TEXT_MODEL` | Direct text/vision analysis channel |
| `DIRECT_BASE_URL`, `DIRECT_API_KEY`, `DIRECT_ENDPOINT_PATH`, `DIRECT_RESPONSES_MODEL` | Legacy fallback accepted for existing configurations |

### Environment variables

Copy `.env.example` for a local starting point. Important variables include:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
RESPONSES_MODEL=gpt-5.4-mini
DIRECT_IMAGE_BASE_URL=https://api.openai.com/v1
DIRECT_IMAGE_API_KEY=
DIRECT_IMAGE_ENDPOINT_PATH=images/generations
DIRECT_IMAGE_MODEL=gpt-image-2
DIRECT_TEXT_BASE_URL=https://api.openai.com/v1
DIRECT_TEXT_API_KEY=
DIRECT_TEXT_ENDPOINT_PATH=responses
DIRECT_TEXT_MODEL=gpt-5.4-mini
HOST=
PORT=3600
IMAGE_STUDIO_OUTPUT_DIR=
IMAGE_STUDIO_LOCAL_DATA_DIR=
IMAGE_STUDIO_REQUEST_TOKEN=
IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP=0
IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0
IMAGE_STUDIO_DNS_FALLBACK_SERVERS=
```

The Node service keeps the system `dns.lookup` path first. When system resolution fails, the fallback sequence defaults to `223.5.5.5`, `1.1.1.1`, then the system's existing servers. Set `IMAGE_STUDIO_DISABLE_DNS_FALLBACK=1` to disable it, or provide a comma-, semicolon-, or space-separated list in `IMAGE_STUDIO_DNS_FALLBACK_SERVERS`.

### Remote access

The default listener is `127.0.0.1`. Do not expose it directly to the public internet. Non-loopback requests require the startup token through HTTP Basic, `Authorization: Bearer <token>`, or `X-Image-Studio-Token: <token>`. A reverse proxy must terminate TLS, authenticate users, enforce request limits, and inject an explicit fixed token for each backend request. Read [SECURITY.md](./SECURITY.md) before enabling LAN or hosted access.

## Why this workbench

GPT-Image2-Studio is designed for creators, ecommerce operators, designers, and content teams who need more than a single image prompt. It keeps references, plans, queued jobs, retries, generated assets, and request metadata together while preserving a local-first trust boundary.

The same application can run in three ways:

| Runtime | Best for | Data boundary |
| --- | --- | --- |
| Local Node.js service | Full daily workflow and development | Configuration, records, and outputs stay on the local machine by default |
| Windows desktop app | A dedicated window, taskbar identity, and standard uninstall flow | Electron provides the runtime; closing the last window stops the local service |
| Windows browser installer | The legacy browser-launch workflow | The installer includes `node.exe` and opens the default browser |

The repository also contains a Vercel configuration. Vercel functions use temporary storage, so Preview validation is required for long jobs, SSE, and file lifecycles before production deployment.

## Core capabilities

### Image creation

- **Prompt-to-image** with up to 15 reference images, prompt enhancement, aspect-ratio presets, explicit pixel sizes, PNG/JPG output, and live progress.
- **Style transfer** with a separate source image, style reference, built-in presets, and a two-image before/after comparison viewer.
- **Reference analysis** that turns 1-15 images into structured subjects, relationships, risks, and an applied generation prompt.
- **Image decomposition** for products, devices, and packaging, producing structured callouts and selling-point visuals.
- **Image editing** for whole-image changes or multiple local masks, with merged or sequential region execution.
- **Quick blend** that pairs A/B/C/D material groups by index for repeatable batch composition.
- **Browser-local compression** with resizing, format conversion, quality/target-size controls, and no upload to the image service.

### Commerce and content workflows

- **Ecommerce sets** with platform, category, product facts, audience, SKU, language, carousel roles, frozen plans, retries, and Listing drafts. A separate logo-batch branch adds one uploaded Logo to up to 15 source images. Nineteen platform profiles are included; the generic baseline keeps 18 native carousel slots.
- **Portrait mode** for consistent people, actions, clothing, props, locations, framing, and 1-100 image batches.
- **Article illustration mode** for text packages, style bibles, character and scene references, reading-order storyboards, and final illustrations.
- **PPT generation** from PDF, DOCX, PPTX, TXT, Markdown, CSV, pasted text, or a topic; supports 1-20 pages, page repair, image-based PPTX, and editable reconstruction.

### Assets and operations

- Waterfall gallery and a shared lightbox with fit, zoom, pan, download, deletion, prompt review, and request-parameter inspection.
- Separate records for Creation sets, portraits, article illustrations, and PPT decks.
- Background queue status, progress, structured errors, and retry of failed items.
- Prompt Kit, Prompt Agent image-to-prompt output, Logo library, portrait outfit/prop library, and model selection controls.
- Dark/light themes, Chinese/English UI, and responsive desktop, tablet, and mobile layouts.

## Interface preview

These screenshots come from isolated browser sessions of the current workbench. They show layout and interaction structure; prompts and generated results are examples, not a promise of fixed upstream model output.

### Prompt-to-image

![Prompt-to-image workspace](./docs/images/studio-prompt.jpg)

### Style transfer

![Style transfer workspace](./docs/images/style-transfer.jpg)

### Image editing

![Image editing workspace](./docs/images/image-edit.jpg)

### Ecommerce set planning

![Ecommerce set workspace](./docs/images/creation-suite.jpg)

### Portrait mode

![Portrait mode workspace](./docs/images/portrait-mode.jpg)

### Article illustrations

![Article illustration workspace](./docs/images/article-illustration.jpg)

### PPT generation

![PPT generation workspace](./docs/images/ppt-generation.jpg)

### Gallery

![Waterfall gallery workspace](./docs/images/gallery.jpg)

## Workflow map

| Workflow | Inputs | Result |
| --- | --- | --- |
| Prompt-to-image | Prompt, up to 15 references, ratio, size, format | PNG/JPG assets, progress, filmstrip, download, and metadata review |
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

## Product image collector extension

The repository includes an optional Chrome/Edge extension for supported 1688, Amazon, Temu, TikTok Shop, SHEIN, and Dajian Yuncang consumer product pages. It can collect main, detail, and named SKU images, filter groups, preview originals, copy selected images to Studio, and download individual or product-folder batches.

The extension reads supported product regions only after the user starts a collection. It does not read cookies, API keys, passwords, or other credentials. Studio only downloads a reviewable ZIP; Chrome/Edge still requires the user to load or reload the extension manually. See the [extension guide](./extensions/product-image-collector/README.md).

## Deployment and packaging

### Vercel

The repository includes `vercel.json` and a standard request handler for Serverless functions. Vercel uses ephemeral filesystems and cloud-specific request lifecycles. Validate a Preview deployment, SSE completion, long-running jobs, and `/api/config` before a production deployment.

### Windows packages

```powershell
cmd /c npm run build:desktop
cmd /c npm run build:installer
```

Artifacts are written below `artifacts/desktop/` and `artifacts/windows-installer/`. Build output, runtime data, logs, and credentials are ignored and must not be committed.

## Local data and privacy

The local service stores generated images by date under:

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

Typical workflow folders include `prompt`, `style-transfer`, `reference-analysis`, `image-decomposition`, `image-edit`, `creation`, `portrait`, `article`, and `ppt`. Record indexes are normally under `%USERPROFILE%\Pictures\json\`; private service configuration is under `.local/config.json`, or under the Electron app-data directory for the desktop build.

API keys, prompts, references, generated images, manifests, and request logs can contain sensitive information. Keep `.env`, `.local/`, `output/`, `outputs/`, `artifacts/`, `dist/`, and real generation records out of commits. Third-party gateways receive the credentials and media that you send to them; review their data policies independently.

Generated content still needs human review for factual accuracy, brand rules, portrait rights, copyright, platform policy, and unsupported claims. The app does not automatically log in to Temu or publish listings.

## Parameters, resolutions, and limits

> [!IMPORTANT]
> These tables describe the candidates this application offers and the constraints it applies. They are not a promise that every upstream model, compatible gateway, or ecommerce platform supports these sizes. Accepted parameters, billing, delivered pixels, formats, and platform review rules come from the provider and target platform you choose, and a gateway may ignore, rewrite, or reject what the app sends.

### Aspect ratios and pixel sizes

Route mode and direct-call mode share the pixel candidates below. `Auto` resolves to the base size for the selected ratio; the middle column lists the remaining explicit candidates in UI order, excluding the base and largest values.

| Ratio | Typical use | Base size (`Auto`) | Other candidates | Largest |
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

Two details are easy to misread. The `21:9` and `9:21` lists are not sorted by pixel count: their `720P` candidate (`1680x720` / `720x1680`) sits after the base size in the UI but is smaller than it. And `3:1` and `1:3` genuinely offer only three choices each (`Auto`, the base size, and the largest), so their middle column is empty rather than incomplete.

### How size differs across the three channels

| Channel | Protocol | Size values the app sends | Automatic value | Constraint to know |
| --- | --- | --- | --- | --- |
| Route mode | Responses API plus the image tool | The explicit ratio-bound pixels above | Base size for the current ratio | The UI offers only the `responses` suffix, and the upstream can still adjust delivered pixels. Image editing is the exception: it always posts to `images/edits` and ignores the configured suffix |
| Direct-call mode | `images/generations`, `responses`, or `chat/completions` | The same explicit pixels as route mode | Base size for the current ratio | Compatibility depends on the gateway and model; edit requests may be rerouted to `images/edits` |
| Gemini model | Gemini image generation, or a `chat/completions`-compatible shape for non-Gemini models | `512`, `1K`, `2K`, `4K` | `1K` | These are tiers, not promised pixel counts; the default model identifier is an app default, not proof the provider serves it, and some models or gateways reject references, ratios, or `4K` |

Three consequences of that split are worth knowing before you pick a ratio:

- **A size is only legal for its own ratio.** The requested pixels must be one of the candidates listed for the selected ratio; anything else is rejected before the upstream call with `当前比例 <ratio> 不支持分辨率 <size>` ("the current ratio does not support that resolution"). That is why `1:1` will not accept `1824x1024` even though `16:9` offers it.
- **Switching the call channel resets a non-default size.** Pixel values and tier values share no members, so a saved `2048x2048` becomes `Auto` the moment you switch to the Gemini channel, and a saved `4K` becomes `Auto` when you switch back.
- **The Gemini image path supports 10 of the 15 ratios.** It accepts `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, and `21:9`. The other five are substituted with the closest supported ratio that keeps the requested orientation: `2:1` and `3:1` become `16:9` and `21:9`; `1:2`, `9:21`, and `1:3` become `9:16`. On this channel the delivered shape is therefore close to your request rather than exact, and it stays landscape or portrait as asked.
- **Quality and output format never reach the Gemini image path.** The request body only carries `aspectRatio` and `imageSize`; PNG vs JPG and the High quality control have no effect here.
- **The Gemini image body is selected by the model name, not by the channel.** The name must contain `gemini` plus one of `image`, `banana`, `图像`, or `生图`. Any other model on this channel is posted to `chat/completions` with neither size nor ratio.

### Workflow limits

The UI exposes conservative application candidates, not a guarantee from every upstream model or gateway. Actual accepted parameters, billing, output pixels, image formats, and platform review rules are controlled by the selected provider.

| Area | Current application boundary |
| --- | --- |
| Prompt references | Up to 15 images; a session has up to 15 parallel task slots |
| Style transfer | One source image plus one style reference or built-in preset |
| Image-edit masks | Each local mask is limited to 50 MB and normalized to the source dimensions |
| Ecommerce SKU combinations | Up to 20 combinations; frozen plans are limited to 64 items and 4 MiB serialized size |
| Portrait batches | 1-100 images; the default is 12 |
| PPT pages | 1-20 pages; the default is 8 |
| Output formats | PNG or JPG for generated images; browser compression can also produce WebP |

Large images, high resolutions, and large batches increase browser memory use and the chance of upstream timeouts or rate limits. Start with an automatic or medium size and a small batch, then increase scale after the selected channel is proven compatible.

## Project structure

```text
GPT-Image2-Studio/
|-- desktop/                     # Electron main process and security policy
|-- docs/                        # Installation, release, design, and screenshots
|-- examples/                    # API and SSE examples
|-- lib/                         # Server and browser-shared modules
|-- openspec/                    # Current specs and in-progress changes
|-- public/                      # Browser UI, styles, modules, and assets
|-- scripts/                     # Sync, cloud, and Windows packaging scripts
|-- test/                        # Node.js tests
|-- server.mjs                   # Local Node.js service
|-- generate-image.mjs           # CLI image-generation entry point
|-- package.json
`-- package-lock.json
```

## Development and verification

```powershell
cmd /c npm run dev
cmd /c npm run desktop
cmd /c npm run help
cmd /c npm run sync:public-lib
cmd /c npm test
cmd /c npm run check:release
```

Before a pull request or release, run the maintained contract from a clean checkout or isolated worktree:

```powershell
cmd /c npm ci
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run check:release
cmd /c npx --no-install openspec validate --all --strict
git diff --check
```

Desktop and installer changes additionally require `npm run test:desktop-smoke`, `npm run build:desktop`, and `npm run build:installer`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the OpenSpec workflow and dirty-worktree rules.

## Releases

- The source and lockfile versions are authoritative; tags use `v<version>`.
- Current release notes: [v0.2.14](./docs/releases/v0.2.14.md).
- Windows packages are distributed through [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases). Check the release notes for hashes and signing status.
- `npm run check:release:strict` requires a clean worktree and a matching tag on the current commit.

## Documentation

- [Chinese README](./README.zh-CN.md)
- [Windows desktop app](./docs/windows-desktop.md)
- [Windows browser installer](./docs/windows-installer.md)
- [Product image collector extension](./extensions/product-image-collector/README.md)
- [Security policy](./SECURITY.md)
- [Contribution and maintenance guide](./CONTRIBUTING.md)

## Version history

Full notes, hashes, and verification records live on [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases). Current-version notes: [v0.2.14](./docs/releases/v0.2.14.md).

### v0.2.14

- The Gemini channel no longer turns an unsupported ratio into a square. It accepts 10 of the 15 ratios; the other five now resolve to the closest supported ratio in the same orientation (`2:1` → `16:9`, `3:1` → `21:9`, and `1:2`, `9:21`, `1:3` → `9:16`) instead of collapsing to `1:1`. Because this channel sends a size tier rather than pixels, the ratio the user picked is now the fallback source for that match.
- `release:patch` and `check:release` maintain the derived version facts as well: both README badges, the installer and portable filenames quoted in prose, the release-note links, and the `v<version>` GitHub Release references. Previously only one anchored fact per file was checked, so a bump could pass while the README still advertised the previous version's download.

### v0.2.13

- Article illustration planning now produces a dense consecutive-keyframe storyboard. The planner counts the source's natural paragraph clusters and asks for at least one finished frame per paragraph or distinct visual beat, plus extra consecutive frames whenever action, emotion, dialogue, camera angle, or location changes. No maximum illustration count is applied, and `recommendedImageCount` reports the frames actually produced.
- Article illustration generation fans out the whole planned set through the same bounded-concurrency loop the other set modes use, honoring the configured generation concurrency and start delay instead of walking one item at a time. Pending reference cards in a run finish before storyboard items start, so later frames can use them.
- A failed direct-route image request now names the endpoint it actually used and unwraps Node's bare `fetch failed` into the underlying reason (`ENOTFOUND`, `ECONNREFUSED`, a TLS error, or `UND_ERR_CONNECT_TIMEOUT`). This route rewrites `images/generations` to `images/edits` once references are attached, so the failing URL is not always the configured one.
- Both READMEs gained a step-by-step [Beginner API setup](#beginner-api-setup) walkthrough.
