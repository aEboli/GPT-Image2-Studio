## 1. Data and taxonomy

- [x] 1.1 Replace the old categories with the three screenshot dimensions and all 41 exact second-level labels.
- [x] 1.2 Preserve the 40 local source-backed records and add the supplied kitchen image/prompt record.
- [x] 1.3 Map each record once to a scenario, style and subject category; deduplicate all-items results by stable ID.
- [x] 1.4 Remove the unpaired generated preview resources.

## 2. UI and browser bundle

- [x] 2.1 Set the initial filter and static library labels/counts to the new taxonomy.
- [x] 2.2 Synchronize the updated library modules into `public/lib`.

## 3. Verification and archive

- [x] 3.1 Update template-library checks for exact labels, mapping coverage, prompt/image pairing and local asset presence.
- [x] 3.2 Run the focused Prompt Kit test file and verify the public module copies match.
- [x] 3.3 Validate the OpenSpec delta, archive the change and update the main capability spec.
