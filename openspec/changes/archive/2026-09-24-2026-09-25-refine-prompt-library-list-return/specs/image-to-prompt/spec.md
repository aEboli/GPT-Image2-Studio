# image-to-prompt Specification

## MODIFIED Requirements

### Requirement: Prompt library list view follows preview image geometry

In list view, each template card SHALL use the preview image's intrinsic aspect ratio and rendered media width to determine its height. The text content area SHALL occupy the same vertical height as the image, wrap within its column, and truncate excess prompt text with a visible multiline ellipsis. Image view SHALL continue to preserve each image's intrinsic ratio independently.

#### Scenario: A list prompt is longer than its paired image

- **WHEN** a template prompt exceeds the available height beside its preview image
- **THEN** the card height remains determined by the image ratio
- **AND** the prompt remains inside the text column with a multiline ellipsis

### Requirement: Returning from a template preview restores the template library

When a Prompt Kit preview is open, the left “返回模板库” action SHALL close only the preview lightbox and SHALL keep the template library open with the active category, subcategory, search, view and scroll position. The separate top-right “关闭” action MAY close the template library as its existing behavior.

#### Scenario: User returns from a template preview

- **WHEN** the user activates “返回模板库”
- **THEN** the preview lightbox closes
- **AND** the Prompt Kit list returns at the previous scroll position
- **AND** the active category and subcategory remain selected

#### Scenario: User explicitly closes the template library

- **WHEN** the user activates the top-right “关闭” action in the preview surface
- **THEN** both the preview and Prompt Kit library close
