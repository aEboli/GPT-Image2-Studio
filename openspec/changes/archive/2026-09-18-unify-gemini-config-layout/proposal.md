# unify-gemini-config-layout

## Why

Gemini currently places the resolved request URL in the endpoint heading while GPT and Grok use a readable title, a protocol suffix area, and a separate base URL input. On compact clients this makes the Gemini title truncate and gives the provider panels different visual geometry.

## What Changes

- Give the Gemini endpoint field the same endpoint heading and address-row structure used by the other providers.
- Show the fixed `images/generations` protocol path as a compact, non-editable suffix label.
- Keep the resolved Gemini request URL available through the suffix label's title and accessible label, while the visible UI stays single-line.

## Non-Goals

- Do not add an editable Gemini endpoint selector.
- Do not change Gemini request construction, saved keys, API history isolation, or configuration field names.
- Do not change the existing responsive breakpoints or introduce text wrapping.

## Impact

- `public/index.html`, `public/app.js`, and `public/styles.css` change only the Gemini endpoint presentation.
- Configuration surface regression coverage gains a contract for the shared structure and inspectable full URL.
