# Why

Creation Mode can generate English-language images while carrying Chinese planning titles, assigned task names, and source-reference annotations in the prompt. The current target-language boundary asks for concise English copy but does not consistently require translating those inputs before rendering or prohibit copying internal labels and reference annotations. This can cause Chinese text to appear in an image even when English is selected.

# What Changes

- Make every Creation Mode carousel prompt explicitly require newly authored off-product text to use the selected target language.
- Require source facts and labels to be translated before appearing as canvas text, and treat planning titles, filenames, and reference annotations as internal evidence rather than copy.
- Keep physical product and packaging text in its original language and preserve stricter platform no-text policies.
- Add regression coverage for English prompts with Chinese role assignments, source facts, and reference notes across analyzed and ordinary planning paths.

# Non-Goals

- Do not translate the Creation Mode interface or saved item titles.
- Do not alter source text physically printed on a product or package.
- Do not change image roles, content assignments, platform policies, or existing generated records.

# Capabilities

### Modified Capabilities

- `creation-mode`: generated canvas text follows the selected target language and internal planning labels do not leak into the image.
