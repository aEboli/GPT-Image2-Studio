## 1. Local service security and release checks

- [x] 1.1 Add failing DNS Rebinding and remote-bind policy tests.
- [x] 1.2 Require a trusted loopback Host for tokenless requests and gate plain HTTP non-loopback binding behind explicit unsafe opt-in.
- [x] 1.3 Update remote-access configuration and security documentation.
- [x] 1.4 Add mixed old/new release-fact tests and validate anchored current-version facts.

## 2. Filtered record deletion

- [x] 2.1 Add controller tests proving hidden checked Article, Portrait, and PPT records are not deletion targets or visible counts.
- [x] 2.2 Resolve selected deletion targets and counts from the complete filtered collection while preserving hidden checked state.

## 3. Listing dimensions and review details

- [x] 3.1 Add failing tests for negated package evidence, fabricated axes, weight-as-length, overlong Platform V1 dimensions, and shared trailing units.
- [x] 3.2 Implement label-scoped dimension evidence and complete normalized tuple provenance validation.
- [x] 3.3 Restrict unit-mode checks to length units and enforce the 500-character ceiling on all dimension paths.
- [x] 3.4 Preserve every grouped dimension axis in historical read hydration.
- [x] 3.5 Render non-empty Listing warnings and missing information and update view tests.

## 4. Creation inference and Prompt template compatibility

- [x] 4.1 Add failing tests for ambiguous color substrings, conjunction leakage, multi-color target localization, and broad category suffixes.
- [x] 4.2 Make color recognition context-safe, canonical, and per-color target-localized.
- [x] 4.3 Remove unreliable product-name-only leaf suffix category matching while preserving reliable matches.
- [x] 4.4 Add failing unrelated Prompt Agent JSON preservation coverage and require recognizable legacy structure before extraction.

## 5. Synchronization and verification

- [x] 5.1 Synchronize canonical browser modules to `public/lib` and confirm no generated drift.
- [x] 5.2 Run focused security, deletion, Listing, Creation, Prompt and maintenance tests.
- [x] 5.3 Run the full serial test suite, Cloudflare Pages build, dependency audit, release consistency check and `git diff --check`.
- [x] 5.4 Run strict OpenSpec validation, merge delta specs into main specs, archive this completed change, and revalidate the archive.
