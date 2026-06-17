## 1. Planning And Storage

- [x] Add tests for article bundle merging, plan normalization, reference-card insertion, and dual text fields.
- [x] Implement article illustration planner helpers.
- [x] Add tests for dated article output directories and manifests.
- [x] Implement article illustration set storage.

## 2. Local API

- [x] Add independent `/api/article-illustration/plan`, `/generate-references`, `/generate`, and `/sets` routes.
- [x] Make plan call the text model only.
- [x] Save generated article images under the dated `article` folder with `galleryVisible: false`.

## 3. Frontend

- [x] Add Create navigation entry, input form, style preset selector, style bible editor, reference card view, storyboard editor, and confirmation gate.
- [x] Add Article Illustration Records under Assets with prompt/caption copy and retry/continue actions.
- [x] Add scoped responsive CSS.

## 4. Verification

- [x] Add static UI/API route tests.
- [x] Run full `npm test`.
- [x] Run `npm run build:pages`.
- [x] Run browser smoke verification.
- [x] Run live UI flow with real article plan, reference image generation, final illustration generation, record rendering, and prompt/caption copy.
