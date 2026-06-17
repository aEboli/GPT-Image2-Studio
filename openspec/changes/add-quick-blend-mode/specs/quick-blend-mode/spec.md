## ADDED Requirements

### Requirement: Quick Blend Mode is an independent Create view
The system SHALL expose Quick Blend Mode through the Create menu at `#quick-blend` and SHALL keep its A uploads, B uploads, optional C uploads, optional D uploads, layout options, pair list, generated preview state, and feedback independent from prompt mode, style transfer, reference analysis, image decomposition, Creation Mode, Portrait Mode, Article Illustration, and PPT generation.

#### Scenario: User opens Quick Blend
- **WHEN** the user opens `#quick-blend`
- **THEN** the system displays four multi-image upload groups labeled product/A, B, C, and D
- **AND** it displays an ordered pair preview area
- **AND** it displays controls for vertical or horizontal ordering and square or rectangular sorting shape
- **AND** it does not prefill A or B uploads from any other Create mode

### Requirement: Quick Blend pairs A and B images by order
The system SHALL pair files strictly by upload order across A, B, and any enabled optional C/D groups, and SHALL create one generation job per indexed pair.

#### Scenario: User uploads matching A and B counts
- **WHEN** the user uploads product images `A1,A2` into product/A group
- **AND** uploads `B1,B2` into group B
- **THEN** the pair preview shows `A1+B1` and `A2+B2`
- **AND** starting generation queues two jobs

#### Scenario: User uploads optional C and D groups
- **WHEN** the user uploads `A1,A2`, `B1,B2`, `C1,C2`, and `D1,D2`
- **THEN** the pair preview shows `A1+B1+C1+D1` and `A2+B2+C2+D2`
- **AND** starting generation queues two jobs
- **AND** each job submits only the images for its indexed A/B/C/D pair

#### Scenario: User uploads more than two pairs
- **WHEN** the user uploads `A1,A2,A3,A4,A5,A6` and `B1,B2,B3,B4,B5,B6`
- **THEN** the system queues six jobs in the same order
- **AND** each job submits only the matched A/B pair as references

### Requirement: Quick Blend validates pair completeness
The system SHALL require A and B to contain at least one image and SHALL require B, enabled C, and enabled D counts to match the A count before generation starts.

#### Scenario: A group is missing
- **WHEN** the user uploads one or more B images but no A images
- **THEN** the generation action is disabled or rejected with visible feedback
- **AND** no generation job starts

#### Scenario: B group is missing
- **WHEN** the user uploads one or more A images but no B images
- **THEN** the generation action is disabled or rejected with visible feedback
- **AND** no generation job starts

#### Scenario: Counts do not match
- **WHEN** the user uploads two A images and one B image
- **THEN** the pair preview marks the missing pair
- **AND** generation is disabled or rejected with visible feedback
- **AND** no generation job starts

#### Scenario: Optional group count does not match
- **WHEN** the user uploads two A images, two B images, and one C image
- **THEN** the pair preview marks the missing optional group image
- **AND** generation is disabled or rejected with visible feedback
- **AND** no generation job starts

### Requirement: Quick Blend layout options affect generation
The system SHALL let the user choose vertical or horizontal ordering and square or rectangular sorting shape for Quick Blend output. The selected options SHALL be included in queued job data and backend prompt construction.

#### Scenario: User selects horizontal square sorting shape
- **WHEN** the user selects horizontal ordering and square sorting shape
- **AND** starts Quick Blend generation
- **THEN** the generated prompt tells the model to sort enabled groups left to right in A/B/C/D order
- **AND** when four groups are enabled, the generated prompt tells the model to use a balanced 2 by 2 matrix instead of a single row or single column
- **AND** the generated prompt tells the model to place each subject in its assigned sorting position using contain-style proportional scaling
- **AND** the generated prompt tells the model not to stretch, squash, warp, elongate, compress, crop, or force subjects to fill their positions
- **AND** saved metadata includes `quickBlendLayoutOrder: horizontal` and `quickBlendPlacementShape: square`

### Requirement: Quick Blend generation uses a dedicated two-reference prompt
The system SHALL build a dedicated Quick Blend prompt when `/api/generate` receives `mode=quick-blend`. The backend SHALL require at least two and at most four reference images for each Quick Blend request.

#### Scenario: Backend receives one valid pair
- **WHEN** `/api/generate` receives `mode=quick-blend` with exactly two image references
- **THEN** it generates one image from that pair
- **AND** the prompt tells the model to extract visible subjects from A and B, remove or neutralize backgrounds, and arrange A above B
- **AND** the prompt tells the model to preserve subject shape, colors, materials, markings, proportions, and identity cues
- **AND** the prompt tells the model to use proportional scaling and leave neutral padding instead of deforming the subjects
- **AND** the prompt tells the model not to add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements

#### Scenario: Backend receives one valid four-group pair
- **WHEN** `/api/generate` receives `mode=quick-blend` with A, B, C, and D image references
- **THEN** it generates one image from that indexed pair
- **AND** the prompt tells the model to extract visible subjects from A, B, C, and D
- **AND** the prompt follows the selected order and placement options

#### Scenario: Backend receives malformed Quick Blend references
- **WHEN** `/api/generate` receives `mode=quick-blend` with fewer than two or more than four reference images
- **THEN** the backend rejects the request
- **AND** no image generation call is made

### Requirement: Quick Blend results are saved as gallery assets
The system SHALL save completed Quick Blend outputs into the normal gallery with quick-blend metadata.

#### Scenario: Quick Blend generation completes
- **WHEN** a Quick Blend job saves successfully
- **THEN** the result appears in the normal gallery
- **AND** saved metadata includes `generationMode: quick-blend`, `assetKind: quick-blend`, `quickBlendPairIndex`, enabled group image names, `quickBlendLayoutOrder`, and `quickBlendPlacementShape`
- **AND** the output path uses the dated `quick-blend` image folder

#### Scenario: Gallery item is deleted or history is cleared
- **WHEN** the user deletes a Quick Blend gallery item or clears history
- **THEN** Quick Blend preview state no longer points to the removed saved asset
- **AND** other Create modes remain unaffected
