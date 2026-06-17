## Why

Long-form articles need a different workflow from ecommerce sets. A fixed 4/6/8/10/12 image template cannot preserve article rhythm, recurring characters, repeated scenes, or caption accuracy.

## What Changes

- Add an independent Create entry named Article Illustration.
- Parse pasted text, uploaded text files, and supplemental notes into one article bundle.
- Use a text-model planning step to produce content type, suggested illustration count, style bible, characters, scenes, reference cards, storyboard items, prompts, and original/caption text.
- Generate key reference cards first, then use completed reference cards as image references for the final storyboard images.
- Store article illustration manifests separately from gallery, PPT, and ecommerce creation records.

## Impact

- Backend: new `/api/article-illustration/*` routes, planner helpers, store helpers, and dated `article` output folder.
- Frontend: new Article Illustration workspace and Article Illustration Records asset view.
- Storage: `Pictures/YYYY-MM/MM-DD/YYYY-MM-DD-article/<set-folder>/` and `Pictures/json/article-illustration-sets/`.
- Tests: planner, store, API route, and static UI coverage.
