# API configuration

[Back to README](../README.md) · [简体中文](./configuration.zh-CN.md)

### Beginner API setup

Start here on a first run. Studio ships no model quota and never holds keys for you. It stores your own API credentials on the local machine and calls the service you choose with them.

#### Step 1: collect three things

| What you need | Meaning | Example |
| --- | --- | --- |
| Base URL | The API root the provider gives you, usually ending in `/v1` | `https://api.openai.com/v1` |
| API key | The key created in the provider's console | `sk-****` |
| Model name | A model identifier spelled the way that provider spells it | `gpt-6-luna`, `gpt-image-2` |

Create keys in the OpenAI console for the official channel; compatible services and third-party gateways publish their own base URL and key. Billing, rate limits, and content policy come from the provider you configure.

#### Step 2: open the configuration panel

- From source: run `cmd /c npm start` and open `http://127.0.0.1:3600`.
- Desktop app: launch `GPT-Image2-Studio`. The built-in service uses a dynamic loopback port, so there is no address to type.
- Click **配置** (Configuration) in the top-right corner, or use the top navigation **配置 → 配置 API**. The panel opens on the configuration sections.
- The drawer header carries a `CN` / `EN` switch. Press `EN` once and the whole interface, including every label below, turns English.
- Until a save succeeds, the top-right status stays on `配置未保存` (Configuration not saved).

#### Step 3: pick one configuration section

The drawer opens on four mutually exclusive sections: **GPT**, **Gemini**, **Grok**, and **配色** (Palette). Selecting GPT reveals a **路由模式** (Route mode) / **直连模式** (Direct mode) switch directly below the section row. Only the selected section's fields are shown; inactive connection controls and Fetch Models buttons stay disabled. Palette contains no connection fields.

Each image route stores its connection settings independently, and only the active route is used for image generation. When in doubt, keep GPT's default Route mode.

| Section | Fits a provider that | You fill in |
| --- | --- | --- |
| GPT / Route mode (default) | Supports `POST /responses` with the `image_generation` tool, such as OpenAI itself or a gateway aligned with it | Endpoint URL, API key, Responses model |
| GPT / Direct mode | Only offers `images/generations` or `chat/completions`, or when image and text come from two different providers | Independent image and text/vision settings |
| Gemini | Serves Gemini image models over an OpenAI-compatible image-generation protocol | Base URL, API key, image model |
| Grok | xAI or a gateway implementing the Grok Imagine image protocol | Base URL, API key, image endpoint, image model |
| Palette | Not a call channel. Holds the interface palette instead | Nothing; selecting a provider section again restores the connection fields |

Selecting **配色** hides the connection fields and shows 12 palette swatches in a four-column grid. The default palette is `黑曜` (Obsidian); `靛蓝` (Indigo) remains available alongside palettes inspired by Chinese traditional colours. The selected palette is saved locally and mirrored to the embedded Temu workbench.

Switching to **配色** and back does not change the active image route; the top-right status keeps reporting that route.

Long explanations are available from their hover/focus help markers; the configuration form and generation log scroll independently, while the log heading and section switch stay visible.

#### Step 4: fill in the fields for that channel

**Route mode.** The endpoint suffix is fixed to `responses`:

```text
Endpoint URL: https://api.openai.com/v1
API key:      sk-****
Responses model: gpt-6-luna
```

The default text/vision model is `gpt-6-luna`. Existing non-empty model settings remain in effect until you change them.

The Responses model is the outer model. The image tool model is chosen from the **生图工具模型** dropdown right below it, and the prompt page parameter row echoes it as `工具模型 <model>`. The dropdown is the only way to set it — there is no free-text field:

| Option | Notes |
| --- | --- |
| `gpt-image-2` | Default. |
| `gpt-image-2.5-sunburst` | Configured 2.5 image-tool option; availability depends on the provider. |
| `gpt-image-2.5-flare` | Configured 2.5 image-tool option; availability depends on the provider. |
| `gpt-image-2.6-sunburst` / `gpt-image-2.6-flare` | Advanced format and image options; see the [reference](./reference.md#gpt-image-26). |

The **发送 tools[].model** switch is on by default, so Route requests send the selected allowlisted image-tool model. Older configurations without the field also default to on. An explicitly saved false remains off, and partial configuration saves retain the existing setting. When off, requests omit `tools[].model` and let the configured service choose the tool model; the dropdown selection and queued snapshots are retained.

The prompt page parameter row also has a **质量** (quality) dropdown: `low`, `medium`, `high` (default), plus `xhigh` and `max`, which exist on the 2.5 and 2.6 models. Switching back to `gpt-image-2` while `xhigh`/`max` is selected clamps quality to `high`. Grok offers only `low` and `medium`, defaulting to `medium`; quality selections are remembered separately for GPT, Gemini, and Grok. Legacy automatic values migrate to concrete defaults and are never offered as options or sent upstream. Prompt-to-image also has an optional **透明背景** (transparent background) switch on GPT's Route and Direct image routes. Enabling it forces PNG, sends `background=transparent`, and stores the choice with the queued job. Gemini and Grok keep this switch hidden and do not send a background parameter.

**Direct mode** splits into two independent groups. The image group only generates and edits images; the text/vision group handles prompt enhancement, reference analysis, Listing drafts, and other model calls. The two groups can point at different providers:

```text
Image API:       https://api.openai.com/v1   suffix images/generations   model gpt-image-2
Text/vision API: https://api.openai.com/v1   suffix responses            model gpt-6-luna
```

If a provider uses a different image-model name, add a **生图模型映射** (Image model mapping) below **流式输出** (Streaming output), using `request model → actual request model`, for example `gpt-image-2.6-sunburst → IMAGE-2.6`: the left side matches the model named in the request, and the right side is the model ID actually sent to the provider. Both capsules accept manual IDs or model candidates; Fetch Models updates the mapping candidates too. Add or remove multiple rules, then save to persist them. Removing all rules and saving clears the mapping.

Rules match complete, case-sensitive IDs once and apply only to GPT Direct image generation and editing. Unmatched models keep their original IDs. Text/vision models and other channels remain independent, known-model capability checks are retained, and queued jobs keep their original mapping snapshots.

**Gemini.** The image endpoint suffix is fixed to `images/generations` and displayed in the same position as the GPT and Grok suffix controls:

```text
Base URL:    https://api.vendor.example/v1
API key:     <key from the provider>
Image model: gemini-3.1-flash-image-preview
```

**Grok.** Uses the xAI image-generation and editing JSON protocol with its own connection settings:

```text
Base URL:    https://api.x.ai/v1
API key:     <xAI key or a compatible provider's key>
Endpoint:    images/generations
Image model: grok-imagine-image-2.0
```

Requests with references use `/images/edits`; one request accepts at most five reference images. The app maps the selected dimensions to `1k` or `2k`, matches unsupported ratios to the nearest supported Grok ratio, and sends only `low` or `medium` quality. Grok image calls omit GPT reasoning effort, output-format and background parameters, and do not support local mask editing. Text/vision planning continues through the separately configured GPT channel.

If the provider gave you one complete address instead, press **完整 URL** (Full URL) next to the endpoint field and paste the whole thing, for example `https://vendor.example/v1/responses`. Studio splits it into a base URL and an endpoint suffix.

Leave the generation scheduling card at its defaults (`20` concurrent requests, `1000` ms between submissions). The concurrency value is the total limit across image-generation modes in the current session. Both fields lock while any generation task is running.

#### Step 5: test the connection, then save

- Press **测试连接** (Test connection). For the selected channel it requests `GET <base URL>/v1/models` (appending `/v1` when the address does not already end with it) using `Authorization: Bearer <your key>`. A key you just typed and have not saved yet is included in that test.
- **获取模型列表** (Fetch Models) uses the same endpoint, so you can pick a model name from the list instead of typing it.
- Press **保存** (Save). The top-right status turns into `配置已保存` (Configuration saved) and a masked hint appears next to the API key field.
- Saving with the API key box empty keeps the previously saved key rather than clearing it.

A passing connection test only proves that the credentials and the `/models` endpoint work. It is not proof that the channel supports generation, editing, references, or the largest sizes. Some gateways never implement `/models`, so the test can fail while generation still works: type the model name by hand, save, and verify with one real generation.

#### Step 6: generate one image to confirm

Close the panel, go back to **提示词生图** (Prompt-to-image), write one short prompt, choose `1:1`, and use the concrete default resolution (`1024x1024` on GPT, `1K` on Gemini; Grok derives `1k` from the square default). Progress shows on the preview stage; the full log lives in the configuration drawer's `生成日志` (Generation log) panel, beside the fields on wide screens and below them on narrow screens. Where the current-call parameter summary is visible, it also shows the selected image service's clickable origin (`scheme://host[:port]`) without the API path or credentials. A successful image is written to:

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

#### Reusable API list

Each endpoint field carries a toggle that opens the list of endpoints you have already saved, so switching providers no longer overwrites the previous one. Selecting an entry fills that channel's endpoint URL, endpoint suffix, and matching key together — the key follows the address rather than being picked separately. The model is left alone, and **保存** (Save) still has to be pressed.

- The five endpoint fields (GPT Route, GPT Direct image, GPT Direct text/vision, Gemini, and Grok) have isolated lists, each capped at 20 entries. Saving or deleting an entry in one list never changes another list.
- An entry's identity is "endpoint URL + key", so a second key for the same provider is a separate entry. A combination missing either part is not recorded, because it could not be restored as a set.
- The suffix only follows along when the current channel actually offers that option, so a stored `responses` never overwrites the direct image channel's `images/generations`.
- Each row shows the address above and `suffix · masked key` below, with a delete button that only removes it from the list and leaves the saved configuration untouched.
- The lists live solely in browser `localStorage` (`image-studio-api-endpoint-books-v2`). Legacy v1 history is assigned only to GPT Route, not copied into every channel. Nothing is added to `.local/config.json`, `.env`, or `/api/config`; request payloads never carry these lists, and they are not shared with the desktop build or other browsers. Plaintext keys never reach the DOM; rows render only the address and a mask.

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
| `GROK_BASE_URL`, `GROK_API_KEY`, `GROK_ENDPOINT_PATH`, `GROK_IMAGE_MODEL` | Independent Grok image-generation and editing channel |
| `DIRECT_BASE_URL`, `DIRECT_API_KEY`, `DIRECT_ENDPOINT_PATH`, `DIRECT_RESPONSES_MODEL` | Legacy fallback accepted for existing configurations |

### Environment variables

Copy `.env.example` for a local starting point. Important variables include:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
RESPONSES_MODEL=gpt-6-luna
IMAGE_TOOL_MODEL=gpt-image-2
IMAGE_QUALITY=high
DIRECT_IMAGE_BASE_URL=https://api.openai.com/v1
DIRECT_IMAGE_API_KEY=
DIRECT_IMAGE_ENDPOINT_PATH=images/generations
DIRECT_IMAGE_MODEL=gpt-image-2
DIRECT_TEXT_BASE_URL=https://api.openai.com/v1
DIRECT_TEXT_API_KEY=
DIRECT_TEXT_ENDPOINT_PATH=responses
DIRECT_TEXT_MODEL=gpt-6-luna
GROK_BASE_URL=https://api.x.ai/v1
GROK_API_KEY=
GROK_ENDPOINT_PATH=images/generations
GROK_IMAGE_MODEL=grok-imagine-image-2.0
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

The default listener is `127.0.0.1`. Do not expose it directly to the public internet. Non-loopback requests require the startup token through HTTP Basic, `Authorization: Bearer <token>`, or `X-Image-Studio-Token: <token>`. A reverse proxy must terminate TLS, authenticate users, enforce request limits, and inject an explicit fixed token for each backend request. Read [SECURITY.md](../SECURITY.md) before enabling LAN or hosted access.
