## 1. Shared Loader

- [x] 1.1 Add the shared generation loading module with banded ticks (800ms up to 20%, +1500ms per further 10%), 99% cap, stable keys, and cleanup APIs.
- [x] 1.2 Add accessible progress attributes and reduced-motion-compatible component styling.
- [x] 1.3 Render the liquid water surface: drifting wave crest plus ripple, rising bubbles, and a level that rises continuously across each tick.
- [x] 1.4 Add a waiting mode that holds queued tasks at no percentage and no timer, and switches to generating from 0% when the task starts.

## 2. Generation Entry Migration

- [x] 2.1 Replace the main prompt/style-transfer preview animation with the shared loader.
- [x] 2.2 Migrate creation suite and portrait card loading to the shared loader.
- [x] 2.3 Migrate article illustration, PPT, image decomposition, reference analysis, image edit, and quick blend generation previews/filmstrips.
- [x] 2.4 Add stable loading keys and stop old timers when preview/list containers are replaced.
- [x] 2.5 Route queued creation cards, prompt previews, and filmstrip thumbnails to the waiting mode until generation starts.
- [x] 2.6 Separate adjacent same-footprint entries in the creation queue strip and thumbnail strips.

## 3. Animation Cleanup

- [x] 3.1 Remove legacy orb, ring, liquid, scan, sketch, step, and standalone generation spinner CSS/DOM.
- [x] 3.2 Keep non-generation analysis and button busy indicators unchanged.
- [x] 3.3 Synchronize all root `lib` modules to `public/lib`.

## 4. Verification

- [x] 4.1 Update focused loader tests for one drop, progress timing, cap, reuse, and cleanup.
- [x] 4.2 Update remaining layout/static tests and run the full `npm test` suite.
- [x] 4.3 Validate this OpenSpec change and perform a browser smoke check for prompt and creation loading states.
