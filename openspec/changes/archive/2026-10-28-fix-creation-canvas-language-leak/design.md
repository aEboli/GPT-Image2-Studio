# Design

Strengthen the shared final target-language boundary used by both analyzed and ordinary carousel prompt assembly. The boundary will distinguish physical source text, which stays unchanged, from newly authored canvas text, which must use the selected language. It will also identify supplied facts, role/task titles, filenames, and reference annotations as evidence or internal metadata that must be translated or omitted before rendering.

The existing platform-native no-text rule remains authoritative. The image-decomposition and infographic-rebuild paths keep their own language controls; this change targets Creation Mode carousel prompt construction where role and content-assignment text is assembled.

Validation will build prompts in English using Chinese content-assignment titles, facts, and reference notes, then assert that the English-only and internal-label boundaries are present in both planner branches. Existing Chinese target-language, physical-text preservation, and platform no-text tests must continue to pass.
