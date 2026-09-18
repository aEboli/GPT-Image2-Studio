## 1. Specification

- [x] 1.1 Add the runtime configuration delta.
- [x] 1.2 Add the configuration usability delta.

## 2. Shared configuration and routing

- [x] 2.1 Add the Grok default model and route D normalization/selection.
- [x] 2.2 Persist and expose Grok settings with masked public credentials.
- [x] 2.3 Carry Grok fields through browser-private config and request merging.

## 3. Grok workflow

- [x] 3.1 Add documented Grok generation/edit request bodies and response handling.
- [x] 3.2 Dispatch route D before the existing OpenAI edit path and reject local masks and more than five references before upstream requests.
- [x] 3.3 Normalize Grok size, quality, and aspect ratio inputs.
- [x] 3.4 Detect the returned PNG/JPEG format before emitting and saving the final Grok image.

## 4. Browser configuration

- [x] 4.1 Reorder the configuration selector and nest the GPT A/B selector.
- [x] 4.2 Add the Grok panel, model picker target, endpoint history, and route labels.
- [x] 4.3 Synchronize all browser-loaded shared modules.

## 5. Verification

- [x] 5.1 Add focused route/config/workflow/layout tests, including Grok's five-reference server limit and byte-derived output format.
- [x] 5.2 Run synchronization checks, syntax checks, focused tests, full tests, OpenSpec validation, and `git diff --check`.
- [x] 5.3 Archive the validated change and verify the merged main specifications.
