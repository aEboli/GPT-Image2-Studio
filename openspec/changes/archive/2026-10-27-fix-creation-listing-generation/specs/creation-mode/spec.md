## ADDED Requirements

### Requirement: Batch generation fills missing Listing records

The suite records view SHALL provide a batch command that generates Listing only for records without existing Listing drafts. The command SHALL process records sequentially, skip records with existing drafts or an active Listing request, and continue after an individual failure. While the batch runs, record refresh, deletion, Temu export, and separate Listing generation SHALL be unavailable.

#### Scenario: Batch generation skips existing Listing

- **WHEN** the user activates batch Listing generation
- **THEN** records with one or more existing `listingDrafts` are skipped
- **AND** records without Listing are processed in sequence
- **AND** a failed record does not prevent later missing records from being attempted

#### Scenario: Record actions stay stable during batch generation

- **WHEN** a batch Listing operation is running
- **THEN** refreshing or deleting records, starting a Temu export, and starting another Listing generation are disabled
- **AND** completion reports the numbers of successful and failed records
