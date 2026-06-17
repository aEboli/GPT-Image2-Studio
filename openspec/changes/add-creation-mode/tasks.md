## 1. Specification And Planning

- [x] 1.1 Validate the `creation-mode` OpenSpec change.
- [x] 1.2 Create the Superpowers implementation plan with file-level task boundaries.

## 2. Creation Planning And Storage

- [x] 2.1 Add failing tests for fixed four-item ecommerce planning and target-language prompt injection.
- [x] 2.2 Implement creation planning helpers.
- [x] 2.3 Add failing tests for dated creation relative directories and set manifests.
- [x] 2.4 Implement creation set storage and relative directory helpers.

## 3. Local API

- [x] 3.1 Add failing SSE/API tests for `/api/creation/generate` and `/api/creation/sets`.
- [x] 3.2 Implement independent local creation generation and set listing routes.
- [x] 3.3 Ensure saved creation images use `galleryVisible: false` and `assetKind: creation-image`.

## 4. Frontend

- [x] 4.1 Add failing layout tests for the Creation Mode tab, hash route, panel, and independent state.
- [x] 4.2 Implement Creation Mode HTML, state, refs, routing, submit flow, and SSE rendering.
- [x] 4.3 Add scoped Creation Mode CSS while preserving existing studio, gallery, and PPT layouts.

## 5. Worker, Docs, And Verification

- [x] 5.1 Align Cloudflare worker routing or provide a clear unsupported state if parity is not in scope.
- [x] 5.2 Update README output-path documentation.
- [x] 5.3 Run unit tests, syntax checks, build, UTF-8/mojibake checks, and browser verification.

## 6. Creation Mode V2 Controls

- [x] 6.1 Add failing tests for Creation Mode image count, marketing scenarios, reference images, and manifest metadata.
- [x] 6.2 Extend creation planning to support configurable image roles and scenario-specific prompts.
- [x] 6.3 Pass Creation Mode reference images through local and Cloudflare generation paths without sharing prompt-mode reference state.
- [x] 6.4 Add scoped Creation Mode UI controls for reference images, set size, and marketing scenario.
- [x] 6.5 Update the Creation Mode spec and documentation, then rerun verification.

## 7. Creation Record Details And Repair

- [x] 7.1 Add failing tests for Creation Mode set detail records including metadata, item prompts, statuses, errors, and saved paths.
- [x] 7.2 Implement the set detail read path without exposing Creation Mode records in prompt-mode gallery history.
- [x] 7.3 Add failing tests for single-item regeneration, missing-item fill, and failed-item retry against the same set manifest.
- [x] 7.4 Implement item-level repair so only selected, missing, or failed items regenerate and the existing set manifest is updated in place.
- [x] 7.5 Add scoped Creation Mode detail UI actions for single-image regeneration, missing-image fill, and failed-item completion, then rerun verification.

## 8. Creation Item Prompt Refinement

- [x] 8.1 Add failing tests for item-level prompt/copy overrides in Creation Mode repair.
- [x] 8.2 Implement repair override handling so one regenerated item can use an adjusted prompt while preserving the same set manifest.
- [x] 8.3 Add scoped card-level UI for editing and saving a single item prompt before regeneration.

## 9. Creation Reference Role Labels

- [x] 9.1 Add failing tests for reference image role metadata in planning, local server handling, manifest storage, and UI.
- [x] 9.2 Implement local-only reference role parsing and prompt guidance without touching Cloudflare worker code.
- [x] 9.3 Add compact per-reference role selectors in Creation Mode and pass them with generation and repair requests.

## 10. Expanded Creation Sets And Scenarios

- [x] 10.1 Add failing tests for 10/12-image Creation Mode sets and expanded marketing scenarios.
- [x] 10.2 Extend local creation planning to support material close-up, usage steps, dimensions, and review/Q&A image roles.
- [x] 10.3 Add local Creation Mode UI options and compact guidance for expanded image counts and scenarios.

## 11. Creation Role Selection

- [x] 11.1 Add failing tests for selected Creation Mode role planning, local server submit handling, and frontend role controls.
- [x] 11.2 Implement local Creation Mode role selection so quick counts preselect role groups and custom role choices drive the generated set.
- [x] 11.3 Update Creation Mode documentation/spec coverage and rerun targeted verification.

## 12. Scenario Role Presets

- [x] 12.1 Add failing tests for scenario-specific role presets and frontend scenario-to-role synchronization.
- [x] 12.2 Implement local scenario templates that update selected image roles and keep manual role edits available.
- [x] 12.3 Update Creation Mode documentation/spec coverage and rerun verification.

## 13. Scenario Role Prompt Strategy

- [x] 13.1 Add failing tests for role-specific prompt guidance inside selected marketing scenarios.
- [x] 13.2 Implement local planner guidance so the same image role receives different prompt strategy in different scenarios.
- [x] 13.3 Update Creation Mode documentation/spec coverage and rerun verification.

## 14. Creation Reference Analysis

- [x] 14.1 Add failing tests for Creation Mode-specific reference-image analysis schema, local API route, planner notes, and UI state.
- [x] 14.2 Implement independent reference analysis so suggested roles and notes apply only to Creation Mode.
- [x] 14.3 Update Creation Mode documentation/spec coverage and rerun verification.

## 15. Creation Plan Preview

- [x] 15.1 Add failing tests for plan preview API, frontend preview controls, and planner-level item prompt overrides.
- [x] 15.2 Implement local `/api/creation/plan` without API-key dependency and reuse the same plan overrides in `/api/creation/generate`.
- [x] 15.3 Add Creation Mode UI for previewing the planned set, editing a planned item prompt, and generating with those edits.

## 16. Assets Navigation and Creation Records

- [x] 16.1 Add failing layout tests for Assets-owned gallery, waterfall, PPT records, and Creation set records.
- [x] 16.2 Move PPT records and Creation set records into the Assets navigation and remove the top-level Records item.
- [x] 16.3 Render saved Creation set history in a dedicated asset record view while keeping the Creation Mode workspace focused on the current set only.

## 17. Navigation Simplification and Record Reuse

- [x] 17.1 Add failing layout tests for Create/Assets/Settings-only global navigation.
- [x] 17.2 Move PPT generation into Create, move image-to-prompt into Create tools, remove the Presentation top-level item, and trim Settings to API/theme.
- [x] 17.3 Add failing layout tests for Creation record search and explicit reuse into the active Creation Mode workspace.
- [x] 17.4 Implement Creation record search and a reuse action that switches to Creation Mode without changing records on simple selection.

## 18. Creation Record Asset Actions

- [x] 18.1 Add failing tests for Creation set record actions that copy image paths and open the corresponding creation folder.
- [x] 18.2 Implement browser-side Creation record action feedback and clipboard export for selected set image paths.
- [x] 18.3 Implement a local-only set-folder opener that resolves folders from the saved manifest ID instead of accepting arbitrary paths.

## 19. Creation Record Reuse Form Hydration

- [x] 19.1 Add failing tests for Creation record reuse hydrating Creation Mode form controls.
- [x] 19.2 Restore product inputs, target language, scenario, image count, and selected roles when a saved set is reused.
- [x] 19.3 Clear unrecoverable local reference-image file inputs while keeping the saved record manifest visible.

## 20. Creation Parameter Layout

- [x] 20.1 Add failing layout tests for Creation Mode parameter controls in a six-control grid.
- [x] 20.2 Add ratio and resolution controls to Creation Mode beside count, scenario, language, and output format.
- [x] 20.3 Keep the parameter grid as three columns by two rows on desktop and single-column on mobile.

## 21. Creation Reference Analysis Apply Step

- [x] 21.1 Add failing layout tests for an explicit Creation Mode reference-analysis apply action.
- [x] 21.2 Store reference-image analysis recommendations without immediately overwriting uploaded reference roles.
- [x] 21.3 Apply recommended reference roles and notes only when the user clicks Apply suggestions.

## 22. Creation Reference Role Consistency

- [x] 22.1 Add failing tests for reference-role summaries in active and asset record details.
- [x] 22.2 Add shared browser helpers for formatting saved reference roles and building repair payloads.
- [x] 22.3 Preserve applied reference roles in the in-progress set and reuse saved roles when repairing without re-uploaded reference files.

## 23. Creation Reference Reupload Workflow

- [x] 23.1 Add failing layout tests for historical reference images that need reupload after record reuse.
- [x] 23.2 Track saved reference names, roles, and notes as missing or uploaded items in the active Creation Mode workspace.
- [x] 23.3 Apply saved roles and notes to matching reuploaded files and only send uploaded reference files in preview, generation, and repair requests.

## 24. Creation Reference Manual Binding

- [x] 24.1 Add failing layout tests for manually binding a reuploaded file to a saved historical reference image.
- [x] 24.2 Add a compact binding selector on reuploaded Creation reference cards.
- [x] 24.3 Apply the selected historical reference role and note to the bound uploaded file and keep restore status synchronized.

## 25. Creation Industry Templates

- [x] 25.1 Add failing tests for Creation Mode industry templates in the planner, local API, Cloudflare worker, manifest storage, and frontend controls.
- [x] 25.2 Implement general, apparel, beauty, food, consumer electronics, and home/living templates with role presets and prompt guidance.
- [x] 25.3 Persist industry metadata in Creation set records, hydrate it on reuse, update README/spec coverage, and rerun targeted verification.

## 26. Creation End-to-End Regression

- [x] 26.1 Add a failing Creation Mode regression test that exercises plan preview, reference reupload metadata, prompt overrides, generation, incomplete-item repair, single-item regeneration, and asset path reporting.
- [x] 26.2 Add local-only mock image generation and isolated output/local-data directories so the regression can run without real API spend or user-profile writes.
- [x] 26.3 Expose the regression as `npm run test:creation-e2e` and keep static server assertions aligned with the new test harness.

## 27. Creation Record Export Actions

- [x] 27.1 Add failing layout tests for Creation record prompt export controls and per-item full-path copying.
- [x] 27.2 Add record-level actions to copy all prompts, export prompts as text, and export the selected set manifest as JSON.
- [x] 27.3 Add a per-item full-path copy action that reuses the safe local path report endpoint.

## 28. Creation Record Lightbox Parity

- [x] 28.1 Add failing layout tests for Creation record cards that hide inline prompts and use the shared lightbox for item details.
- [x] 28.2 Move single-item prompt/path/download access into the lightbox while keeping the card-level View action.
- [x] 28.3 Keep Creation record lightbox parameters aligned with saved relative paths and gallery-style enlarged image viewing.

## 29. Fourth-Level Category Industry Templates

- [x] 29.1 Add failing tests for a shared fourth-level category template module generated from `电商四级类目分级结构表.xlsx`.
- [x] 29.2 Implement searchable category-coded Creation Mode industry templates with duplicate-name-safe category paths.
- [x] 29.3 Inject category-specific prompt guidance into Creation Mode plans and persist category path metadata in creation records.
- [x] 29.4 Let Creation reference-image smart analysis emit category hints and automatically switch to a matched fourth-level category template.
- [x] 29.5 Update README/spec coverage and rerun targeted tests, full `npm test`, Pages build, and Chinese text encoding checks.

## 30. Progressive Category Template Browser

- [x] 30.1 Move the Creation Mode industry template control below the primary parameter grid.
- [x] 30.2 Replace the flat industry-template dropdown with a first-level-to-fourth-level progressive category browser.
- [x] 30.3 Keep category search next to the browser and return only fourth-level category templates.
- [x] 30.4 Remove the previous broad industry templates from the visible Creation Mode template choices.
- [x] 30.5 Change the category browser into a floating cascading dropdown that shows only the active level and current category name in the form.
- [x] 30.6 Restrict category search to category codes plus third-level and fourth-level category names, excluding first-level and second-level name matches.

## 31. Creation SKU Images

- [x] 31.1 Add planner tests for appending SKU images after the selected carousel roles.
- [x] 31.2 Extend Creation reference analysis with distinct sellable SKU subject groups.
- [x] 31.3 Pass SKU subject groups through local server, Cloudflare Worker, and browser plan/generation payloads.
- [x] 31.4 Preserve product identity and existing logos while changing SKU backgrounds and applying the supplied Logo reference.
- [x] 31.5 Add same-SKU combination count controls and prompt constraints for duplicating the unchanged subject into 2, 5, or other selected counts.
- [x] 31.6 Filter SKU generation references to the matched subject files so combination packs do not use the entire uploaded reference set.
- [x] 31.7 Filter non-SKU generation references by image role so single-subject roles do not receive every uploaded product variant.

## 32. Creation Set Visual Language

- [x] 32.1 Add planner and store regression tests for default visual-language fallback, selected visual-language prompt guidance, and legacy manifest normalization.
- [x] 32.2 Pass set-level visual language through plan preview, local generation, Cloudflare generation, manifests, record details, reuse, and repair flows.
- [x] 32.3 Add a Creation Mode-only visual-language selector while keeping the upload-image logo branch unchanged.
