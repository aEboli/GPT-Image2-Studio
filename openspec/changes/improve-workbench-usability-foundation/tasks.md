## 1. Specification And Planning

- [x] 1.1 Create scoped OpenSpec proposal, design, and task list for the first usability foundation batch.
- [x] 1.2 Keep Creation Mode restructuring, Brand Kit, quality checks, and export packages out of this first change.

## 2. Accessibility Fixes

- [x] 2.1 Add failing layout tests for interactive controls not being hidden by `aria-hidden`.
- [x] 2.2 Remove inappropriate `aria-hidden` from interactive containers.
- [x] 2.3 Add failing tests for global error announcement semantics.
- [x] 2.4 Add `role="alert"` and `aria-live="assertive"` to the global error banner.

## 3. Focus Management

- [x] 3.1 Add failing tests for focus capture and restore helper usage around drawer, Prompt Agent, and Lightbox.
- [x] 3.2 Implement minimal focus capture, initial focus, and restore behavior.

## 4. Sync And Contract Guardrails

- [x] 4.1 Add failing test proving public-lib sync coverage uses the full script target list.
- [x] 4.2 Confirm the existing sync target export keeps CLI behavior unchanged.

## 5. Verification

- [x] 5.1 Run targeted Node tests for layout and public-lib sync.
- [x] 5.2 Run `cmd /c npm run sync:public-lib -- --check`.
- [x] 5.3 Run `git diff --check`.
- [x] 5.4 Run full `cmd /c npm test`.

## Review Follow-Up

- [x] Prevent Prompt Agent's mapped-to-Studio flow from restoring focus back to the previous overlay trigger.
- [x] Make the error live region visible before updating its message text.
- [x] Sync the implementation plan checkbox state with this OpenSpec task list.

## Verification Notes

- `cmd /c node --test test\studio-preview-layout.test.mjs`: 106 passed.
- `cmd /c node --test test\public-lib-sync.test.mjs`: 2 passed.
- `cmd /c npm run sync:public-lib -- --check`: checked 44 public/lib modules.
- `git diff --check`: no whitespace errors; Git reported existing Windows LF-to-CRLF warnings.
- `cmd /c npm test`: 581 passed.
