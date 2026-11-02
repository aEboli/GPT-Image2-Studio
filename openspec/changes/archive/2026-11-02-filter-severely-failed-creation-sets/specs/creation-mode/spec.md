## ADDED Requirements

### Requirement: Creation set records can be filtered by severe generation failures

The Creation records view SHALL provide a quick filter for ended sets that planned at least 10 eligible items, have at least one failed item, and have fewer than 10 completed items. A set SHALL be considered ended for this filter only when every eligible item is completed or failed. The filter SHALL combine with the existing keyword and time conditions using AND semantics, and the complete combined collection SHALL drive counts, empty state, detail selection, visible records, checked selection, and filtered deletion targets.

#### Scenario: User keeps a set with enough successful images

- **WHEN** a set planned 20 eligible images, generation has ended, and 17 or 18 images completed while the remainder failed
- **THEN** the severe-failure filter does not include that set

#### Scenario: User finds a set with too few successful images

- **WHEN** a set planned at least 10 eligible images, generation has ended, at least one item failed, and fewer than 10 items completed
- **THEN** the severe-failure filter includes that set

#### Scenario: Exactly 10 images completed

- **WHEN** a set planned at least 10 eligible images, generation has ended, and exactly 10 items completed
- **THEN** the severe-failure filter does not include that set

#### Scenario: A set is still generating

- **WHEN** a set has a failed item but at least one eligible item is neither completed nor failed
- **THEN** the severe-failure filter does not include that set

#### Scenario: User combines severe failures with other filters

- **WHEN** the user activates the severe-failure filter while a keyword or time condition is active
- **THEN** only sets matching the severe-failure condition and every other active condition are included
- **AND** the count, list, current detail fallback, and filtered deletion target use that same combined collection

#### Scenario: User deletes the severe-failure results

- **WHEN** the user activates Delete filtered while the severe-failure condition has matches and confirms the displayed count
- **THEN** the request contains every set in the complete combined filtered collection, including sets beyond the currently rendered list
- **AND** records outside that collection remain untouched
- **AND** each deleted set loses only its manifest, dedicated generated-image directory, and corresponding JSON metadata directory

#### Scenario: User clears all Creation record filters

- **WHEN** the user activates Clear filters
- **THEN** the severe-failure condition, keyword, quick time, and exact date return to their defaults
- **AND** the complete Creation record collection becomes available again
