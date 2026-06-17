## Context

GPT-Image2-Studio currently has prompt-driven single image generation, PPT generation, gallery history, and PPT records. Single image generation is centered on one prompt, optional reference images, one queued job, and gallery-visible output under the dated `image` folder. The requested Creation Mode is similar only at the low-level image-generation API layer; its product workflow, state, records, and output directory must stay independent.

## Goals / Non-Goals

**Goals:**

- Add a Creation Mode tab under the existing creation workspace.
- Generate a fixed first-version set of four ecommerce marketing images for one product.
- Support a target language selector that is injected into every generated marketing prompt.
- Support a set-level visual-language selector so one generated set can vary image roles while sharing the same lighting, tonal treatment, material handling, and brand atmosphere.
- Persist the creation set as a set-level manifest and persist generated images under `YYYY-MM-DD-creation/<set-folder>/`.
- Avoid reading from or writing to prompt-mode form state, Prompt Kit templates, reference image state, job feed, or default gallery visibility.
- Group saved gallery, waterfall gallery, PPT records, and Creation Mode set records under the Assets navigation.
- Keep the global navigation mode-oriented: creation modes under Create, saved outputs under Assets, API/theme under Settings.
- Let users find a saved Creation Mode set and explicitly load it into the active Creation Mode workspace for follow-up edits or repair.
- Let users perform low-risk asset actions from Creation set records: open the saved creation folder and copy the selected set's image paths.

**Non-Goals:**

- Multi-product or multi-SKU set generation.
- Platform-specific size packs for marketplace channels.
- Promotional banner generation.
- Mixing Creation Mode history into the active prompt-mode or Creation Mode workspace.
- Reworking the gallery storage model or PPT record storage model.

## Decisions

1. **Use an independent `creation-mode` capability and `/api/creation/*` API namespace.**
   - Rationale: Adding `mode=creation` to `/api/generate` would mix single-image SSE payloads and queue state with set-level progress.
   - Alternative considered: reuse `/api/generate` for each item from the browser. This was rejected because it would pollute prompt-mode activity and gallery history.

2. **Use one set manifest plus image sidecar metadata.**
   - Rationale: A set needs product input, language, item roles, prompts, relative paths, and partial-failure status. That relationship does not fit the gallery index or PPT deck manifest.
   - Alternative considered: encode the set through `deckId` and `slideNumber`. This was rejected because PPT semantics must remain reserved for presentations.

3. **Store images under `YYYY-MM/MM-DD/YYYY-MM-DD-creation/<set-folder>/`.**
   - Rationale: This satisfies the requirement that Creation Mode output sits beside `image` and `ppt`, while keeping each set grouped.
   - Alternative considered: a top-level `Pictures/creation` folder. This was rejected because the app already groups assets under month/date folders.

4. **Keep Creation Mode out of default gallery visibility.**
   - Rationale: The user asked for data separation. Creation Mode records should be read through creation manifests, not mixed into the default gallery waterfall.
   - Alternative considered: show creation images in gallery with filters. This can be added later, but default mixing is out of scope.

5. **Use fixed four-item planning for the first version.**
   - Rationale: A fixed role set makes the workflow predictable and easier to verify: hero, benefit, scene, detail/trust.
   - Alternative considered: user-configurable count and custom slots. This is deferred to avoid turning the first version into a full campaign designer.

6. **Treat saved record browsers as asset views.**
   - Rationale: Gallery output, waterfall browsing, PPT records, and Creation Mode set records are all saved assets, while the Creation Mode workspace should focus on the current in-progress set.
   - Alternative considered: keep a top-level Records navigation item. This was rejected because it splits asset history across two global navigation groups.

7. **Make record reuse explicit.**
   - Rationale: Opening a saved set in the asset browser should be read-only by default, but users need a deliberate action to continue work from that record in the Creation Mode workspace.
   - Alternative considered: selecting a saved record automatically replaces the active set. This was rejected because it can discard the user's current working context unexpectedly.

8. **Resolve record folder actions from manifest IDs.**
   - Rationale: The browser should not be allowed to send arbitrary local paths. The local server reads the selected set manifest, validates the recorded `relativeDir` under the output root, then opens that folder.
   - Alternative considered: expose the absolute folder path in the UI and submit it back to the server. This was rejected because it widens the local file-system surface unnecessarily.

9. **Hydrate editable state on explicit record reuse.**
   - Rationale: Reusing a saved set should make the Creation Mode form match the visible set so previews, regeneration, and repair use the same product input, language, scenario, and role selection the user sees.
   - Alternative considered: only show the saved set cards and leave the form untouched. This was rejected because the next generation request would silently use stale or empty form values.

10. **Keep Creation parameters grouped but isolated.**
   - Rationale: Count, scenario, language, format, ratio, and resolution are all generation parameters, so they should read as one compact two-row grid while still using Creation Mode-owned controls.
   - Alternative considered: reuse the prompt-mode ratio chips and size selector. This was rejected because it would visually and behaviorally blur the boundary between prompt mode and Creation Mode.

11. **Make reference-analysis application explicit.**
   - Rationale: Reference-image recognition is model-assisted and can be wrong, so it should first produce visible recommendations. The user applies those recommendations only when they agree with them.
   - Alternative considered: keep auto-applying recognition results. This was rejected because a single misclassification can silently change generation guidance for repair or regeneration.

12. **Use one browser-side reference-role formatter and repair payload fallback.**
   - Rationale: The active Creation workspace, asset record detail, and repair request should describe the same applied reference roles and notes. Repair should use currently uploaded reference files when present, and otherwise keep the saved manifest roles for records that were explicitly reused.
   - Alternative considered: repeat inline formatting and always send only current file-input roles. This was rejected because file inputs cannot be restored from saved records, so repairs could silently lose the user's applied reference guidance.

13. **Represent historical reference images as a reupload checklist.**
   - Rationale: A saved manifest can restore reference names, roles, and notes, but the browser cannot restore the original `File` objects. The active workspace must show those historical references as missing until the user uploads matching files, then apply the saved role and note to the new file object.
   - Alternative considered: keep sending saved reference metadata when no file is uploaded. This was rejected because it makes the UI imply that reference images are available when only text metadata exists.

14. **Treat visual language as a set-level constraint, not a per-image style.**
   - Rationale: A Creation Mode set should look like one ecommerce asset family. The selected visual language anchors lighting, color grading, materials, realism level, and brand tone across every planned item, while item roles still control camera angle, composition, scene density, props, and information layout.
   - Alternative considered: reuse the existing strong style-transfer presets for each image. This was rejected because cyber, comic, watercolor, and similar art styles can break product fidelity and make the set feel like an inconsistent collage.

## Risks / Trade-offs

- **Long-running generation can partially fail** -> Preserve saved items and mark the set `partial_failed`, with failed item errors visible.
- **Filename-keyed gallery index can collide** -> Include set and item suffixes in filenames and store creation metadata in a creation manifest.
- **Target language may not render perfectly in generated image text** -> Keep copy short and include language requirements in each item prompt.
- **Cloud deployment can diverge from local server behavior** -> Implement matching worker routes or explicitly verify build coverage before deploy.
- **Existing Chinese text has console mojibake risk on Windows** -> Verify written files by UTF-8 readback, not by relying on PowerShell display.
- **Opening local folders is platform-specific** -> Keep this action local-server-only, return a clear error when the saved folder is missing, and keep copy-path export available as the low-friction fallback.
- **Historical reference image binaries cannot be restored from manifests** -> Clear browser file inputs on record reuse and tell the user to re-upload originals when they want reference images in the next request.
- **Saved reference role metadata can drift from current file inputs** -> Prefer current uploads for new requests, keep manifest role metadata visible, and mark missing historical files as requiring reupload before they participate in preview, generation, or repair.
- **Visual variation can reduce set consistency** -> Keep the visual language on the set manifest and inject it as shared prompt guidance for every item, with the default `classic-commercial` preserving the previous behavior.
