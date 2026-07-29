## 1. Specification

- [x] 1.1 Add the `add-portrait-mode` OpenSpec change with proposal, design, requirements, and tasks.
- [x] 1.2 Update README with Portrait Mode workflow, routes, storage, and parameters.

## 2. Planning and Storage

- [x] 2.1 Add failing planner tests for 1, 12, and 100 image plans, style distribution, photography vocabulary, and prompt overrides.
- [x] 2.2 Implement `lib/portrait-planner.mjs`.
- [x] 2.3 Add failing store tests for portrait manifest and dated output directory paths.
- [x] 2.4 Implement `lib/portrait-store.mjs` and `lib/portrait-repair.mjs`.
- [x] 2.5 Clamp portrait image count to 1-100 and support selected shot-type cycling in the planner.

## 3. Safe Reference Analysis

- [x] 3.1 Add prompt-agent tests for portrait reference analysis mode and safe schema output.
- [x] 3.2 Add `PORTRAIT_REFERENCE_ANALYSIS_MODE`, schema normalization, and prompt-agent labels.

## 4. Local API

- [x] 4.1 Add API contract and static server tests for `/api/portrait/*`.
- [x] 4.2 Implement local reference analysis, plan, generate, repair, set listing, path report, and folder opening routes.
- [x] 4.3 Save portrait images with portrait metadata and hidden default gallery visibility.

## 5. Cloudflare

- [x] 5.1 Add Worker tests for portrait plan/generate and unsupported local-only actions.
- [x] 5.2 Implement Cloudflare reference analysis, plan, and generate routes.
- [x] 5.3 Return unsupported capability payloads for repair, local paths, and folder opening.

## 6. Frontend

- [x] 6.1 Add static layout tests for `#portrait` and `#portrait-record`.
- [x] 6.2 Add lazy view modules and view-loader mappings.
- [x] 6.3 Implement independent `state.portrait`, DOM refs, renderers, route handling, event bindings, and record actions.
- [x] 6.4 Add isolated `.portrait-*` styling and responsive layout rules.
- [x] 6.5 Remove the workbench output metadata strip, make the desktop grid five columns, add shot filters, spinner feedback, and all supported ratio options.

## 7. Verification

- [x] 7.1 Run `cmd /c npm test`.
- [x] 7.2 Run `cmd /c npm run build:pages`.
- [x] 7.3 Run `cmd /c npm run sync:public-lib -- --check`.
- [x] 7.4 Smoke test `#portrait` and `#portrait-record` in the built-in browser.
- [x] 7.5 Run UTF-8/mojibake checks for newly written Chinese content.
