## Context

The previous source-only prompt said a written feature or benefit required an explicit source label. That correctly blocked claims inferred from appearance, but also blocked a useful approximate middle setting when the infographic showed both endpoint temperatures and runtimes and stated there were three settings.

## Decisions

### 1. Require multiple source facts and one direct relationship

An inference must be supported by at least two readable source facts and one unambiguous relationship between them. Product-category norms, external knowledge, and appearance alone are not evidence.

### 2. Preserve uncertainty in the wording

Derived numeric values use an approximate or estimated marker and conservative rounding. The model must omit the result when source facts conflict, the relationship is unclear, or multiple interpretations remain plausible.

### 3. Keep source isolation

Only the matched source infographic is available to reconstruction. This change does not introduce product descriptions, other references, platform context, or an external knowledge source.

## Risks / Trade-offs

- Models can still mistake a plausible relationship for a direct one. The prompt requires multiple facts, an unambiguous relation, approximation labels, and omission on conflict or ambiguity.
- Conservative rounding can reduce numerical precision, which is preferable to presenting an estimate as measured product data.
