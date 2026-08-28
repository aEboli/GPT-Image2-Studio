## 1. Role Directive Consolidation

- [ ] 1.1 Replace the parallel role tables (brief / shopper question / buyer decision / role intent / rendering constraint) with one merged positive directive per role.
- [ ] 1.2 Compress the per-scenario role focus table to one short positive line per scenario and per scenario role override.
- [ ] 1.3 Keep role IDs, Chinese role labels, filename tokens, and role presets unchanged.

## 2. Shared Guidance Compression

- [ ] 2.1 Compress dimension, unit-mode, and exact-value guidance into short positive lines and drop the enumerated wrong-render lists.
- [ ] 2.2 Compress visual language, platform fit, industry template, and target-language guidance to one or two positive sentences each.
- [ ] 2.3 Compress reference role, reference coverage, primary subject, and logo guidance into positive short form.
- [ ] 2.4 Remove the candidate-pool, suite-split, and platform-disclaimer blocks from item prompts.
- [ ] 2.5 Rewrite conversion intent, hero coverage, and function coverage blocks as short positive requirements.

## 3. SKU And Infographic Templates

- [ ] 3.1 Compress the SKU prompt: subject lock, series consistency, bundle count, generation rule, background, and quality line in positive short form.
- [ ] 3.2 Compress the infographic rebuild base prompt to a positive under-1200-character contract.
- [ ] 3.3 Rewrite the shared subject-content protection prompt and runtime target-language patch as positive short lines.

## 4. Category Templates

- [ ] 4.1 Turn category `avoidHints` into positive `focusHints` phrasing in the generated category prompt instruction.
- [ ] 4.2 Compress the category prompt instruction to the category path, its visual focus, and its compliance-safe positive framing.

## 5. Synchronization And Verification

- [ ] 5.1 Synchronize changed root `lib` modules to `public/lib`.
- [ ] 5.2 Update creation planner, platform planner, category template, repair, and e2e regression tests to the compressed positive prompts.
- [ ] 5.3 Add tests asserting the per-item length ceiling and the absence of prohibition phrasing for carousel, SKU, and infographic items.
- [ ] 5.4 Run the full test suite.
