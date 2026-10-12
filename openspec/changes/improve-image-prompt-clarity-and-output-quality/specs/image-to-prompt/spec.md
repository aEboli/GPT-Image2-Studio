## MODIFIED Requirements

### Requirement: Reverse prompt preserves explicit style-lock vocabulary

普通图片反推 SHALL keep the existing five top-level groups and SHALL make `visual` a reusable style-lock segment beginning with `风格锁定：` (or an equivalent target-language marker when the mode supports another language). It SHALL prioritize the source image's most distinctive, image-grounded aesthetic or genre, medium/rendering, palette/contrast, lighting, material/surface finish, and applicable lens/depth and post-processing cues. It SHALL retain specific reusable style vocabulary rather than reducing a distinctive source to generic labels. The segment SHALL include the concise phrase `4K/8K级超高清成像质感` once as a visual-quality intention, not as source metadata or a claim about actual output pixel dimensions. When the primary subject is visibly in focus, `visual` SHALL require clear subject focus, naturally resolved source-visible textures, clean edges, and an orderly visual hierarchy without invented micro-detail or uniform over-sharpening. `avoid` SHALL identify plausible unwanted style drift, subject blur, motion smearing, texture smudging, compression/noise artifacts, duplicate/deformed details, or unrelated clutter only when those differ from the source. The prompt SHALL preserve intentional background bokeh, shallow depth of field, soft focus, film grain, and motion effects visible in the source.

#### Scenario: Source image has a distinct visual identity

- **WHEN** the uploaded image has a recognizable and distinctive visual identity
- **THEN** `visual` prioritizes its source-grounded medium, aesthetic, palette, lighting, and material anchors instead of replacing them with a generic style label
- **AND** it includes `4K/8K级超高清成像质感` once as a visual-quality intention
- **AND** it does not claim this wording controls actual output pixel dimensions

#### Scenario: Source subject is clear and background is soft

- **WHEN** the uploaded image has a sharply focused subject and a blurred or bokeh background
- **THEN** `visual` describes a crisp primary focal plane, source-visible texture, natural edges, clean hierarchy, and `4K/8K级超高清成像质感`
- **AND** it preserves the source background blur and depth-of-field transition
- **AND** `avoid` rejects unintended blur on the primary subject without removing the intentional background bokeh

#### Scenario: Source shows intentional softness or motion

- **WHEN** soft focus, motion blur, film grain, or another softened effect is visibly intentional in the source
- **THEN** the prompt preserves that effect in its observed region
- **AND** it does not require uniform sharpening or invent sharp detail that the source does not contain

#### Scenario: Source is clean but generation could introduce visual noise

- **WHEN** the source contains no unrelated clutter, duplicate objects, or visible generation artifacts
- **THEN** `avoid` may prevent added clutter, accidental duplicates, malformed details, muddy texture, or compression-like artifacts
- **AND** it does not remove real source elements or add unsupported micro-details

#### Scenario: Second generation should preserve a distinctive style

- **WHEN** the user reuses the reverse-prompt JSON for a second generation
- **THEN** the style-lock terms keep the source image's recognizable medium, aesthetic, palette, lighting, and material treatment explicit
- **AND** `avoid` names plausible source-inconsistent style drift without introducing unrelated presets

#### Scenario: User maps the prompt to Studio

- **WHEN** the user copies or maps the reverse-prompt result into Studio
- **THEN** the JSON describes a high-definition visual target using words only
- **AND** it does not claim that `4K/8K` changes the selected route's actual output size or image parameters
