## Context

The rebuild request already sends only the corresponding source infographic and asks to preserve its facts. Its prompt nevertheless frames the task as a professional redesign without defining a closed inventory of allowable information. A model can therefore convert a visible control, material, or silhouette into a new written benefit while preserving the original measurements.

## Decisions

### 1. Make source content a closed inventory

The runtime prompt asks the model to account for visible source text, numeric facts, icons, arrows, badges, callouts, and their relationships. Every output component must map to a source component with the same meaning and scope. Restyling affects presentation only.

### 2. Separate product depiction from written claims

Product appearance may guide faithful depiction and identity. A written property or benefit requires an explicit label or statement in the source. Unreadable text is left out with clean space rather than guessed or completed.

### 3. Preserve existing runtime boundaries

The rebuild continues to use one matched source image and the existing language, ratio, resolution, and format controls. Product fields, analysis notes, other references, and platform context remain outside this prompt.

## Risks / Trade-offs

- The stricter source mapping may omit plausible but unlabeled benefits. This is intentional for a faithful reconstruction; the user can add verified source information before rebuilding.
- Image models may still render text imperfectly. The prompt reduces unsupported content drift but cannot guarantee exact text rendering.
