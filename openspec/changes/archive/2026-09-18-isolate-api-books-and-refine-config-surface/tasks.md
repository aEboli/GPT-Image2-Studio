## 1. Isolate saved API histories

- [x] 1.1 Add versioned channel-scoped storage with safe legacy migration.
- [x] 1.2 Update picker state and all save/select/delete paths to pass an explicit channel.
- [x] 1.3 Seed each channel from its own saved configuration without cross-channel copies.

## 2. Refine configuration and log presentation

- [x] 2.1 Normalize compact configuration labels and preserve full accessible descriptions.
- [x] 2.2 Balance the wide configuration/log columns and tighten responsive field grids.
- [x] 2.3 Make log tabs and long log values single-line, ellipsized, and inspectable.

## 3. Verification

- [x] 3.1 Add regression tests for isolation, migration, labels, layout, and no-wrap behavior.
- [x] 3.2 Run focused and full tests, synchronization/release checks, and strict OpenSpec validation.
