## Context

The current Platform V1 prompt says that non-title fields may contain objective attributes only, and the runtime rejects any non-title response containing words such as `helps`, `improves`, or `解决`. Even a model response that correctly connects a supplied feature to a modest buyer benefit is therefore replaced by the generic fallback. Five bullets are also forced into five fixed catalog headings, which makes otherwise valid copy read like a specification summary.

Amazon's official seller guide, reviewed on 2026-07-22, says the description should give an overview of the product and its advantages, that up to five bullet points can highlight the most important details and attributes, and that keywords can be used in the title, description, and bullet points. This change adopts that content role while retaining this project's stricter evidence and no-brand rules.

## Goals / Non-Goals

**Goals:**

- Make selling points answer why and where the product is useful.
- Make pain points resolve a real, category-specific shopping or use friction with a supplied product feature.
- Make five bullets scan like strong Amazon detail-page copy while staying platform-aware.
- Keep every product claim traceable and every English/Chinese pair semantically aligned.

**Non-Goals:**

- Claiming that named or unnamed competitors fail without comparative evidence.
- Adding reviews, rankings, test results, certifications, warranties, medical effects, or performance numbers.
- Changing the JSON field contract, title rules, UI section names, or historical stored drafts.

## Decisions

### Use an evidence-backed value boundary instead of a functional-word blacklist

Platform V1 may express a direct, conservative benefit when its product feature is explicitly supplied and the relationship does not require an unstated technical result. Unsupported high-risk claims continue through the existing exact-evidence checks. Search fields stay concise and may use only directly supported buyer-intent phrases.

### Treat category friction as framing, not a competitor fact

`painPoints` will use a complete declarative statement containing a specific category friction, the product's supplied response, and a concrete proof detail. A planning objection may help identify the friction, but it is not product evidence by itself. Copy may not say `other products cannot`, `unlike competitors`, `better than`, or an equivalent comparative claim without exact supplied comparison data.

### Give each field one decision job

Selling points use `feature -> buyer relevance -> proof`. Pain points use `friction -> response -> proof`. Five bullets follow primary value, differentiating feature, use context or fit, specification or construction, and variant or package clarity. Description connects identity, use context, supported value, key details, and contents in natural paragraphs. Cross-field repetition is prohibited.

### Replace fixed bullet labels with product-relevant labels

Every English bullet keeps a short uppercase lead label followed by a colon, but the label must describe the actual decision point. Labels are unique and limited to one to three words. Chinese bullets preserve the same decision order with natural translated labels.

### Keep a conservative fallback path

Malformed, interrogative, branded, or high-risk model output still uses a deterministic completed draft. The fallback will stop narrating source provenance and will use clearer buyer-facing headings, but it will not synthesize an unsupported benefit when inputs do not contain one.

### Ground concrete low-risk attributes at runtime

Prompt instructions alone are not sufficient to prevent plausible additions such as compact, slim, lightweight, a material, or a specific use context. Platform V1 acceptance therefore checks concrete English attributes, construction details, colors, shapes, and use contexts against explicit product, SKU, reference, title-value, or buyer-decision evidence. Direct conservative consequences may still be phrased naturally, but an ungrounded concrete attribute causes the model result to use the deterministic fallback.

### Reject legacy bullet scripts and implicit competitor failure

Five structurally valid bullets are not enough when they reuse the former `PRODUCT TYPE / PACK DETAILS / VISIBLE DETAILS / SPECIFICATIONS / PACKAGE CONTENTS` script. That exact legacy set is rejected so a stale response cannot appear unchanged. Competitor checks also cover implicit subjects such as most alternatives, typical products, standard models, and their Chinese equivalents when followed by failure, lack, only, or struggle wording.

### Make fallback value-aware when decision evidence exists

When bounded buyer-decision evidence is available, the fallback uses its supported value, category friction, buyer context, and proof focus to produce selling points, declarative pain points, and five distinct decision bullets. Generic attribute summaries remain only for sparse legacy inputs that contain no usable decision evidence.

### Keep localized evidence and public language separate

Saved Creation records may target English while carrying a Chinese product name, Chinese reference notes, and Chinese planning evidence. The source builder derives a small allowlist of conservative English evidence aliases only for explicit identity, modes, specifications, controls, and visible components. Runtime evidence tracing accepts those aliases as translations of the same supplied facts. Deterministic English fallback ignores buyer-decision entries that still contain CJK text; a recognized localized product may use its verified aliases, while an unknown category stays generic and never repeats adjacent `Product` title segments.

The recognized thermal-scope fallback treats black-and-white night vision, HD mode, and reticle controls as independent optional facts and emits each only when its alias exists. Search-versus-detail use language additionally requires structured buyer-decision intent, while its fifth bullet and description use the actual pack quantity already present in the normalized source. Sparse generic fallback likewise names only product identity, pack quantity, and concrete variant, specification, or grouped-subject facts that are actually present.

## Risks / Trade-offs

- [The model invents a plausible category benefit] -> The prompt repeatedly binds benefit language to supplied proof, and high-risk patterns still require exact evidence or reject the draft.
- [A real category friction sounds like a competitor accusation] -> Explicitly prohibit comparative failure and superiority language; frame the friction as a shopper or use concern.
- [Dynamic labels become vague] -> Require one-to-three-word product-relevant labels and five distinct decision roles.
- [Sparse evidence cannot support persuasive copy] -> Return fewer selling or pain entries and keep bullets factual instead of padding or guessing.
- [Localized evidence is mistranslated or leaks into the wrong language] -> Translate only explicit allowlisted facts, reject mixed-language fallback decisions, and retain a generic fallback for unknown categories.
