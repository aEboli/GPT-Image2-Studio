## MODIFIED Requirements

### Requirement: Creation Mode supports optional Amazon listing generation
The system SHALL allow users to run the Listing Agent only for Creation Mode sets whose explicit platform is Amazon or whose legacy manifest predates platform metadata and therefore used the original implicit Amazon US target. The first version SHALL target Amazon US English listing drafts and SHALL NOT publish directly to Amazon. Non-Amazon platform selection SHALL NOT delete previously saved Amazon listing drafts.

#### Scenario: User enables Listing Agent for Amazon before generation
- **WHEN** the user selects Amazon and enables the Listing Agent switch before generating a Creation Mode set
- **THEN** the system attempts to generate Amazon US listing drafts after the Creation set finishes
- **AND** listing generation does not block or fail the image-generation workflow

#### Scenario: User selects a non-Amazon platform
- **WHEN** the current Creation platform is universal, Taobao/Tmall, JD, Pinduoduo, Douyin, Xiaohongshu, Temu, TikTok Shop, Shopee, Lazada, Etsy, eBay, Walmart, Shopify/DTC, AliExpress, Rakuten, Coupang, or Mercado Libre
- **THEN** the Listing Agent switch and new generate or rewrite actions are disabled
- **AND** the UI explains that Listing Agent currently supports Amazon US only
- **AND** any previously saved Amazon listing drafts remain viewable, copyable, and exportable

#### Scenario: User runs Listing Agent from an Amazon saved record
- **WHEN** the user opens a saved Amazon Creation set record and starts listing generation
- **THEN** the system generates or rewrites Amazon US listing drafts for that selected set
- **AND** the generated drafts are saved with the Creation set manifest

#### Scenario: User opens a legacy record without platform metadata
- **WHEN** a saved Creation set predates the platform field
- **THEN** the system determines eligibility from `platformProvenance=legacy-missing` captured before fallback normalization
- **AND** it treats the Listing target as the legacy implicit Amazon US target
- **AND** the user can continue to generate, rewrite, review, copy, and export its Amazon listing drafts
- **AND** a record with explicit `platform=universal` and `platformProvenance=explicit` does not receive this legacy eligibility
