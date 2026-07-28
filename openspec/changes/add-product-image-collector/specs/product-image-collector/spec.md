## ADDED Requirements

### Requirement: Extension collects only supported platform product-image regions
The system SHALL provide a Manifest V3 browser extension that collects images only after an explicit user action on a supported consumer product-detail page from 1688, Amazon, Temu, TikTok Shop, SHEIN, or GigaCloud GigaB2B. The collector SHALL choose exactly one platform adapter from the complete page URL. Each adapter SHALL define the platform's product-detail URL rule, product identity, trusted image hosts, title source, declared product-image sources, and known main, detail, and SKU DOM regions. The collector SHALL group accepted images as `main`, `detail`, or `sku`, SHALL preserve first-occurrence source order inside each group, and SHALL prefer platform-declared product data before known-region DOM fallbacks. High-resolution declared, lazy-load, or source-set URLs SHALL be preferred when available. Platform-specific normalization SHALL remove only known non-semantic transforms before de-duplicating a group. Main and detail de-duplication SHALL use the normalized URL. A SKU entry with a bounded stable source-variant identity SHALL use its normalized URL together with that `variantKey`; a SKU entry without trustworthy source identity SHALL fall back to its normalized URL together with its normalized variant labels. Different source variants MAY therefore retain separate entries backed by the same URL and labels, while repeated DOM representations of the same source variant SHALL keep only the first occurrence. De-duplication SHALL apply independently inside each group so that one normalized URL MAY remain in more than one group when the page declares distinct main, detail, or SKU roles. Existing 1688 behavior SHALL continue to prefer `mainImage`, SKU-property images, and the allowed public detail description.

The collector MUST NOT use a whole-page image fallback. Images located in navigation, shop identity, avatars, reviews, recommendations, advertising, service widgets, logos, icons, placeholders, or video surfaces MUST be excluded from the default result. If no supported product region is found, the collector SHALL report that state without returning unrelated page images.

The collector SHALL prefer an adapter-specific product-name node over a broader title container. For the current 1688 page it SHALL read `#productTitle .title-content` without concatenating sibling sales-ranking, inventory, refund, fulfillment, repurchase, or cart statistics. Every successful product title SHALL end with exactly one unquoted platform label formatted as `——<platform label>`; an existing quoted or unquoted suffix for the same platform SHALL normalize to that format.

For the current Temu consumer product page, the collector SHALL scope main images to the semantic gallery listbox under `#leftContent`, named SKU images to radio options under `#rightContent`, and detail images to lazy product-detail media under `#goodsDetail`. After the user explicitly requests collection, the collector MAY activate an exact `See more` control inside `#goodsDetail` and SHALL wait for the bounded detail-image set to stabilize before collecting. It MUST NOT activate similarly named recommendation controls outside `#goodsDetail`. A trusted lazy-load URL in `data-src` MUST NOT be rejected solely because the current placeholder `src` reports a 1 by 1 natural size when the same known-region element has usable rendered or declared dimensions.

For TikTok Shop, the adapter SHALL retain the legacy `www.tiktok.com/shop/pdp/...` route and SHALL accept the current `shop.tiktok.com/<locale>/pdp/<id>` and `shop.tiktok.com/<locale>/pdp/<slug>/<id>` consumer routes. On the current route it SHALL parse only bounded `__MODERN_ROUTER_DATA__` JSON and SHALL accept only a `product_model` whose `product_id` equals the URL identity. Declared `images` SHALL be main images, image entries in the declared `description` SHALL be detail images, and each image-bearing sale-property value SHALL be one SKU image with a stable `tiktok:<property_value_id>` key. It MUST NOT expand repeated size combinations from `skus` into duplicate SKU cards. When a complete matching declared model exists, the adapter SHALL NOT append DOM candidates to any category. The final item SHALL preserve the trusted declared URL and declared dimensions; TikTok query parameters and `~tplv-...` transforms MAY be ignored for same-resource identity only. If declared data is unavailable, main and detail DOM fallback candidates SHALL be limited to the current known product regions and SHALL match both `alt` and `title` to `og:title`.

For Amazon, the adapter SHALL derive the current 10-character ASIN from the supported product URL and SHALL inspect only bounded inline scripts explicitly registered as `ImageBlockATF` or `ImageBlockBTF`. A matching ATF `colorImages.initial` array SHALL become the complete ordered main group and SHALL prevent DOM thumbnails or hidden images for another ASIN from being appended. A matching BTF payload SHALL be decoded as a bounded JavaScript string and parsed as JSON without executing page code; its `landingAsinColor` SHALL resolve to the URL ASIN before image-backed `colorToAsin` entries may become SKU items with stable `amazon:<ASIN>` keys. A+ product-description images MAY remain detail items through the existing known-region selector. Non-matching declarations, 40 by 40 thumbnails, reviews, placeholders, and video media MUST NOT enter the declared result. Declared Amazon images without trustworthy original dimensions SHALL report zero dimensions until the panel loads the normalized original URL and observes its natural dimensions.

For the current GigaB2B consumer product page, platform normalization SHALL remove the known non-semantic `x-oss-process` resize parameter from trusted main-gallery and SKU-option image URLs before grouping, copying, viewing, or downloading them. Each `.options-item` SHALL derive its stable source-variant identity from the bounded `data-gmd-attr-product_id` value or, when that value is absent, from the bounded `product_id` in its own product link. The named `.options-item-active` SKU SHALL use the final image from the ordered `#image-show` gallery when both contracts are present, while every other named SKU SHALL retain the original image object identified by its option thumbnail. Main candidates SHALL be fixed before SKU mapping. The collector MUST NOT click a SKU option, navigate to its linked product, or require background collection to recover these original URLs.

#### Scenario: Supported product page contains product and unrelated images
- **WHEN** the user runs collection on a supported platform product page containing gallery, detail, and SKU images plus navigation, avatar, review, recommendation, advertising, Logo, and placeholder images
- **THEN** the result contains the product gallery, detail, and SKU images in their respective groups
- **AND** none of the unrelated images are selected or returned as product candidates

#### Scenario: Declared gallery contains SKU duplicates after the main image list
- **WHEN** a supported page declares five `mainImage` entries and appends repeated SKU images to its broader gallery list
- **THEN** only the five declared main images appear in the main group
- **AND** the SKU images are classified from the declared SKU properties instead of being promoted to main images

#### Scenario: Public detail description is not mounted in the page DOM
- **WHEN** a supported page declares an allowed public detail-description URL whose `offer_details.content` contains ordered product images
- **THEN** the collector fetches that URL without credentials and returns those images in the detail group
- **AND** a timeout, oversized response, invalid payload, or disallowed URL does not discard already confirmed main or SKU images

#### Scenario: Public detail description succeeds while fallback DOM images also exist
- **WHEN** the allowed public detail description returns ten ordered images and the mounted detail DOM exposes four additional fallback candidates
- **THEN** the detail group contains exactly the ten declared description images
- **AND** the fallback DOM candidates are not appended to inflate the collected total

#### Scenario: Public detail description repeats a sequence with a cache parameter
- **WHEN** a public detail description lists an ordered image sequence and later repeats the same URLs with only a `__r__` cache parameter
- **THEN** the detail group contains one copy of each normalized image in the order of its first occurrence
- **AND** detail IDs, group order, and localized filenames remain continuous from 1

#### Scenario: One SKU image is also a declared main image
- **WHEN** a page declares one SKU variant whose normalized image URL is also present in `mainImage`
- **THEN** the main group keeps its declared main-image card and the SKU group contains one card for that variant
- **AND** the shared source URL does not erase the SKU role or disable SKU-only selection

#### Scenario: Page structure is unsupported
- **WHEN** the current 1688 page does not expose any known product-image region
- **THEN** the extension reports that no supported product images were found
- **AND** it does not scan every image on the page as a fallback

#### Scenario: Current tab is not a supported detail page
- **WHEN** the user opens the extension on another website, a supported marketplace listing page, or a seller-center page
- **THEN** the extension displays a bounded unsupported-page state
- **AND** it does not inject a collector or request broader page access

#### Scenario: Platform-specific fixtures preserve product roles
- **WHEN** representative Amazon, Temu, TikTok Shop, SHEIN, and GigaB2B fixtures expose their declared or known-region main, detail, and SKU images together with recommendation and review images
- **THEN** each fixture returns only its product images in source order and with the correct platform identifier
- **AND** the shared collector does not apply selectors or image hosts from another platform adapter

#### Scenario: Current Amazon ASIN declares a complete gallery and image variants
- **WHEN** an Amazon product URL for one ASIN contains a matching ATF declaration with five ordered high-resolution main images, a BTF declaration with four image-backed ASIN variants, another ASIN declaration, DOM thumbnails, hidden variant images, four A+ detail images, reviews, and placeholders
- **THEN** the collector returns exactly five `main`, four `detail`, and four `sku` items in their declaration or known-region order
- **AND** every SKU uses its declared label and stable `amazon:<ASIN>` key while the product identity remains the URL ASIN
- **AND** declared main and SKU URLs normalize to the original Amazon object with unknown initial dimensions, while the other ASIN, thumbnails, hidden variants, reviews, placeholders, and video media are excluded

#### Scenario: Current TikTok route exposes complete declared product media
- **WHEN** `shop.tiktok.com/us/pdp/<id>` contains one bounded `__MODERN_ROUTER_DATA__` script with a complete matching product model declaring nine main images, eight description images, no image-bearing sale property, and unrelated page media
- **THEN** the collector returns exactly nine `main`, eight `detail`, and zero `sku` items in declaration order
- **AND** every item keeps the declared high-resolution URL, width, and height while recommendations, Logo, avatars, reviews, shop media, and DOM thumbnail variants are excluded

#### Scenario: TikTok image sale property is shared by many size SKUs
- **WHEN** a matching TikTok product model declares three image-bearing values for one sale property and a second non-image size property whose combinations reuse those three images
- **THEN** the collector returns exactly three SKU items, one per image-bearing property value, with three stable `tiktok:<property_value_id>` keys
- **AND** the SKU URLs and declared dimensions remain high-resolution and are not repeated once per size combination

#### Scenario: TikTok declared and DOM URLs are transforms of one resource
- **WHEN** a declared TikTok image and one DOM thumbnail differ only by query parameters or a `~tplv-...` transform suffix
- **THEN** same-category identity treats them as one resource while retaining the declared URL as the final item URL
- **AND** signed query parameters required by the declared high-resolution resource are not removed before viewing, importing, proxying, or downloading

#### Scenario: Current SHEIN page keeps gallery, detail, and SKU roles separate
- **WHEN** a supported SHEIN product page declares ordered `900x` main images in a JSON-LD `ProductGroup`, declares same-resource `900x` color images in `allColorDetailImages`, renders `220×293` gallery thumbnails inside `main-picture`, renders genuine detail media inside `details-pic`, and renders matching color SKU thumbnails in its color selector
- **THEN** the collector returns the declared high-resolution gallery images as `main`, genuine `details-pic` media as `detail`, and the declared same-resource high-resolution color images as `sku`
- **AND** gallery thumbnails, social icons, attribute icons, store media, reviews, recommendations, and other images merely contained by the page-level `goods-detail` root are excluded from `detail`
- **AND** the final resolution label is derived from each selected high-resolution URL instead of presenting a lower-resolution gallery or color thumbnail as the final main or SKU image

#### Scenario: 1688 title container includes operational statistics
- **WHEN** `#productTitle` contains one `.title-content` product name followed by a `.sell-point-wrapper` with sales, inventory, refund, fulfillment, or cart statistics
- **THEN** the manifest title contains only the product name followed by `——1688`, without quotation marks
- **AND** repeated collection or an already-suffixed source title does not duplicate the platform suffix

#### Scenario: Current GigaB2B page has no detail-image region
- **WHEN** a GigaB2B product page exposes an ordered `#image-show` gallery and named `.options-wrap .options-item` SKU images but no supported detail-image region
- **THEN** the collector returns every main image and every named SKU in source order while the detail group remains empty
- **AND** the active SKU uses the final ordered gallery image while every inactive SKU keeps the original object behind its named option thumbnail
- **AND** main and SKU item URLs do not retain the known `x-oss-process` resize parameter
- **AND** it does not promote a SKU hover preview, recommendation, or similar-product image into the main or detail group

#### Scenario: GigaB2B current SKU also remains a main image
- **WHEN** the current named GigaB2B SKU resolves to the normalized URL of the final ordered main-gallery image
- **THEN** the main group keeps that final gallery card and the SKU group keeps a separate card with the current variant name
- **AND** the shared normalized URL does not remove either role or alter the order of the other SKU variants

#### Scenario: GigaB2B linked SKUs share one image and one label
- **WHEN** nine named GigaB2B option links expose nine distinct bounded product IDs while their normalized thumbnails form five URLs and every visible label is identical
- **THEN** the SKU group keeps all nine source variants in option order with nine stable `variantKey` values
- **AND** the manifest normalizer preserves all nine entries instead of reducing them to the five image URLs

#### Scenario: One source variant has duplicate DOM representations
- **WHEN** two accepted SKU nodes have the same normalized URL, labels, and stable source `variantKey`
- **THEN** the collector and manifest normalizer keep only the first node with continuous group ordering
- **AND** a sequential DOM position or generated item ID does not create a second SKU

#### Scenario: Platform does not expose a trustworthy variant identity
- **WHEN** an accepted 1688, Temu, TikTok Shop, or SHEIN SKU candidate has no adapter-confirmed stable source identifier
- **THEN** SKU de-duplication falls back to the normalized URL and bounded variant labels
- **AND** the collector does not invent a `variantKey` from DOM order, transient framework attributes, or guessed fields

#### Scenario: Current Temu page uses semantic regions and lazy placeholders
- **WHEN** a Temu product page exposes an ordered gallery listbox, named SKU radio images, and `#goodsDetail` images whose trusted `data-src` values coexist with 1 by 1 placeholder `src` values
- **THEN** the collector returns the gallery, SKU, and detail images in their respective source order
- **AND** the placeholder dimensions do not remove the trusted lazy images or add loading indicators, recommendation images, reviews, avatars, or shop media

#### Scenario: Temu details are collapsed behind See more
- **WHEN** the user starts collection while an exact `See more` control inside `#goodsDetail` hides the remaining detail images and a recommendation `View more` or `See more items` control also exists elsewhere
- **THEN** the collector activates only the product-detail control and waits for the bounded detail image count to stabilize before returning the result
- **AND** it never activates or collects from the recommendation control

#### Scenario: Source and image platform do not match
- **WHEN** a manifest claims a supported Amazon product source while one item or redirect points to a Temu, SHEIN, TikTok, Alibaba, or GigaB2B image host
- **THEN** normalization or proxy fetching rejects that item before network content is accepted
- **AND** an image host trusted for one platform does not become globally trusted for all product sources

### Requirement: Extension exposes reviewable grouped selection
The extension SHALL display collected main, detail, and SKU images in an in-page floating panel that initially fills the right side of the webpage viewport from top to bottom at approximately 31 percent of the desktop viewport width, bounded between 520 and 540 CSS pixels, with an internally scrolling list and a visible bottom action bar. The complete product title SHALL occupy the left side of one compact draggable header and MAY wrap within that title area without ellipsis, while the `GPT-Image2-Studio / 商品图采集` title block SHALL remain on the right immediately before the Refresh and Close actions; selected count, total image count, and SKU variant count MUST NOT appear below the title and SHALL instead appear completely in the status row below the six selection controls. On desktop, each image row SHALL contain four equal-width cards whose square thumbnail media areas are approximately 115 to 120 CSS pixels. Each group SHALL keep 8 CSS pixels of horizontal padding, and the four-column image grid SHALL use a consistent 6 CSS pixel gap. Card action strips SHALL be approximately 24 CSS pixels high, group headers approximately 36 CSS pixels high, and the existing compact button and text scale SHALL remain unchanged. In a 1707 by 876 CSS-pixel viewport with five main images followed by at least seven detail images, the initial scroll position SHALL expose at least four visually distinct image rows while the persistent bottom action bar remains visible. Cards SHALL use a restrained neutral border when unselected and a clearly visible blue border when selected, with compact rounded corners and one light translucent metadata strip over the lower image edge. Every square thumbnail media area SHALL use a white background and contain the complete source aspect ratio without cropping; this presentation MUST NOT replace or transform the original URL used by View, Copy, Save, Studio import, or Download. The metadata strip SHALL show a complete compact category-order label on the left and the complete resolution on the right without overlap or separate black pills. A named SKU card SHALL show one separate compact row between the image and its actions containing only its complete variant-label text, without a SKU/category/order prefix or ellipsis; main and detail cards SHALL omit that row. Every named SKU card in one rendered visual row SHALL use the same dynamically calculated font size, chosen as the smallest size required by any label in that row to fit completely on one line. The row grouping and font calculation SHALL rerun after rendering and responsive width or column changes. Main, detail, and SKU group backgrounds SHALL use the same hue and saturation with successively different lightness values so the groups form a visible continuous hierarchy. The panel SHALL be draggable from the non-control area of its combined header, SHALL continue tracking the pointer after it leaves the header, and SHALL retain stable floating dimensions after being dragged away from an edge. Releasing within the docking threshold SHALL dock the panel at the nearest viewport edge without hiding it. It SHALL provide selection controls, selected and total counts, icon-only per-card View and Download actions with accessible Chinese names and tooltips, and empty/error states. Each group SHALL expose one white header bar whose left side combines the group title and item count and whose right side shows the group-selected count, a group-only Select All checkbox with checked and indeterminate states, and an icon-only group Download action. Group Select All SHALL change only that category without clearing other categories. Group Download SHALL submit only selected items in that category and SHALL be disabled when that group has no selection. Select All, Invert, Enable Fold or Disable Fold, Select Main, Select Detail, and Select SKU SHALL appear as six small controls in one non-wrapping row; Select Main, Select Detail, and Select SKU SHALL add every item in that category to the existing selection without clearing items already selected in other categories. When the viewport is too narrow, that row SHALL scroll horizontally instead of wrapping or clipping its labels. Enabling fold SHALL dock the panel to the nearest edge and collapse it to a visible narrow rail; pointer entry SHALL expand it and pointer exit SHALL collapse it again while the mode remains enabled. Disabling fold SHALL leave the complete panel expanded. Folding SHALL preserve the panel DOM, collection, selection, and current dock edge and MUST NOT hide the entire panel or substitute the separate launcher. View SHALL open an overlay contained entirely within the collector panel, dim only the collector content, leave the rest of the product page unobscured, start contained within the panel stage, support bounded mouse-wheel zoom without scrolling the underlying page, and support bounded left-button panning at every zoom level beginning with the initial contained state. The viewer SHALL omit the upper-left Back command and image-description title, expose one compact translucent Close command at the upper right, and retain outside-image and Escape closing. Quickly double-clicking the image SHALL restore its initial contained view and keep the overlay open. It SHALL provide a translucent six-control bottom toolbar for covering the plugin stage as Fullscreen, rotating left, rotating right, zooming in, zooming out, and restoring the initial contained view, with Chinese tooltips and accessible names. Fullscreen SHALL use a cover scale that fills both stage axes without invoking browser fullscreen; Fullscreen and Restore Initial View SHALL execute once for every click, remain repeatable, and MUST NOT retain a selected or latched appearance. Bottom navigation SHALL omit the filename and position description and SHALL expose only translucent Previous and Next icon controls. Switching images SHALL reset rotation, scale, and offset without changing the image selection. A persistent floating launcher SHALL appear on supported 1688 product-detail pages without reading or collecting product data and SHALL open the panel on its first click without requiring any prior browser-toolbar action. The launcher SHALL hide while the panel exists and SHALL return only after the panel closes. Clicking the extension action while the folded panel exists SHALL expand it with preserved state; clicking the extension action while the panel is already expanded SHALL keep it visible. Duplicate normalized source URLs SHALL appear once per main or detail group in first-occurrence order; the same normalized URL MUST remain in every group where it has a distinct declared role, including after manifest normalization. Named SKU variants with a stable source identity SHALL appear once per distinct normalized URL and `variantKey`; SKU variants without that identity SHALL appear once per distinct normalized URL and variant-label set. Multiple real variants sharing one image URL and label therefore remain separate selectable SKU cards when the adapter can prove different source identities, with their own labels, order, IDs, and filenames. Recollection SHALL replace the previous page result instead of merging stale candidates.

The persistent-launcher behavior above SHALL apply to every supported platform product-detail page. The launcher SHALL validate the complete page URL before creating DOM; where Chrome match patterns cannot express query parameters, such as GigaB2B's `route=product/product`, a non-product page SHALL return before rendering the launcher.

Viewer geometry SHALL use the image's natural pixel dimensions rather than a CSS-constrained rendered box. The image element MUST NOT be pre-fitted by maximum width or height constraints. Initial display SHALL contain the complete image in the available stage and MAY use a scale below the ordinary 50-percent manual zoom floor when required by a long or wide image. Fullscreen SHALL independently calculate cover scale from the same natural dimensions. Restore Initial View SHALL end any active drag, clear rotation and both pan offsets, and recalculate the same contain scale from the current stage using the unrotated natural dimensions. Initial contain, further zoom-out, Fullscreen, and every other scale SHALL all keep grab panning enabled. On each stage axis, the bounded offset SHALL equal at most half the absolute difference between the rendered image size and the available stage size, so a contained image stays completely visible and an overflowing image can reach but not pass either image edge.

Changing an individual, group, global, inverted, or category selection SHALL update the existing card and header controls in place. It MUST NOT replace the grouped image-list DOM, change the list scroll position, discard loaded thumbnails, or move focus as a side effect of selection.

For a normalized GigaB2B original image, the panel MAY derive a trusted `x-oss-process` preview bounded to approximately 300 by 300 pixels for the image card only. The viewer, clipboard manifest, and every download action SHALL continue using the normalized original URL, and the derived preview URL MUST NOT be serialized into the Studio manifest.

The collector MAY request the same trusted GigaB2B image object with `x-oss-process=image/info` to read bounded JSON metadata instead of downloading the original binary solely for dimensions. A successful response SHALL replace the page thumbnail dimensions with the original width and height; a missing, invalid, cross-host, oversized, or failed response SHALL produce unknown dimensions rather than reporting the 500 by 500 or 74 by 74 thumbnail size as the original resolution.

#### Scenario: GigaB2B card uses a lightweight preview
- **WHEN** the grouped panel renders a normalized GigaB2B original image in a compact card
- **THEN** the card may load a bounded CDN preview while the viewer opens the normalized original image
- **AND** copying or downloading the item submits the normalized original URL without the card-only resize parameter

#### Scenario: User reviews a collected product
- **WHEN** collection returns images from more than one product group
- **THEN** each group shows its own count and ordered thumbnails
- **AND** the user can select all, invert the current selection, add all main, detail, or SKU items without clearing existing cross-category selections, or change individual image selections before copying or downloading

#### Scenario: User opens the collector without the extension toolbar
- **WHEN** a supported platform product-detail page reaches `document_idle`
- **THEN** a bounded floating launcher becomes available without scanning product images
- **AND** its first click opens the current collector panel without any prior extension-action click
- **AND** the panel occupies approximately 31 percent of a desktop viewport within its 520px to 540px bounds, fills the right side from top to bottom, hides the launcher while it exists, and restores the launcher after it closes

#### Scenario: Manifest normalization receives shared image roles
- **WHEN** five main images, seven ordered detail images, and two SKU images reuse normalized URLs across categories
- **THEN** manifest normalization returns all five main, seven detail, and two SKU entries in their declared group order
- **AND** duplicate normalized URLs inside an individual category still keep only their first occurrence

#### Scenario: User scans the responsive grouped grid
- **WHEN** the bounded 31-percent desktop panel renders main, detail, and SKU image groups
- **THEN** each complete row contains four equal-width cards whose square thumbnail media areas are approximately 115 to 120 CSS pixels
- **AND** each group keeps 8 CSS pixels of horizontal padding while the image grid uses a consistent 6 CSS pixel gap
- **AND** selected cards have a visible blue border, unselected cards retain a neutral border, and complete compact names plus resolutions share one light translucent metadata strip
- **AND** the three group backgrounds keep the same hue and saturation while lightness changes in a visible ordered progression

#### Scenario: User repeats fullscreen and initial-view commands
- **WHEN** the viewer is open and the user invokes Fullscreen or Restore Initial View more than once
- **THEN** every click recalculates and applies the requested scale without leaving either control selected or locked
- **AND** Fullscreen covers the complete plugin stage while Restore Initial View clears rotation and pan offsets and restores the current contain scale

#### Scenario: User opens a very long image
- **WHEN** an 800 by 3700 source image opens in a stage that is wider relative to its height
- **THEN** the initial contain scale is allowed below 50 percent so the complete image is visible
- **AND** Fullscreen uses the larger natural-dimension ratio to cover the stage while Restore Initial View returns to the complete initial contain result
- **AND** Fullscreen and every user-selected zoom result can be panned on every overflowing axis

#### Scenario: User changes selection while scrolled in the list
- **WHEN** the grouped image list is scrolled and the user changes one image, one group, all images, the inverted set, or one category
- **THEN** the visible cards, group counts, half-selected states, and available actions update without rebuilding the grouped list
- **AND** the list retains the exact scroll position and the initiating control retains focus

#### Scenario: Viewer exposes only lightweight navigation
- **WHEN** the user opens any collected image
- **THEN** the overlay has no upper-left Back command, image-description title, filename, or position counter
- **AND** a translucent Close button remains at the upper right while translucent Previous and Next buttons remain available without explanatory text

#### Scenario: Long product title and counts remain complete
- **WHEN** a product title requires more than one line in the compact header
- **THEN** the title wraps without ellipsis inside its header area
- **AND** selected image count, total image count, and SKU variant count appear completely in the status row below the selection controls instead of under the title

#### Scenario: Card exposes the collected image resolution
- **WHEN** a card has positive manifest dimensions or its non-GigaB2B original preview finishes loading with positive natural dimensions
- **THEN** the light lower metadata strip shows a complete compact category-order label on the left and `<width>×<height>` on the right
- **AND** GigaB2B uses bounded `image/info` metadata instead of the 300px card preview dimensions

#### Scenario: Non-square thumbnail is reviewed in a square card
- **WHEN** a collected image is taller or wider than 1:1
- **THEN** the complete image is contained inside the square card media area over a pure white background without cropping
- **AND** View, Copy, Save, Studio import, and Download continue using the original image URL and original image bytes

#### Scenario: Named SKU card exposes its variant
- **WHEN** a SKU item contains one or more bounded variant labels
- **THEN** the card row above View and Download displays every character of those variant names in source order without ellipsis
- **AND** the visible text does not add `SKU`, category, order, or explanatory prefixes, while main and detail cards have no variant row
- **AND** all SKU labels sharing one visual row use the same font size selected from the longest or otherwise most width-constrained label in that row

#### Scenario: Compact header and cards expose four image rows
- **WHEN** the right-docked collector renders five main images followed by at least seven detail images in a 1707 by 876 CSS-pixel viewport
- **THEN** the brand title appears in the product-summary header immediately before Refresh and Close instead of occupying its own row
- **AND** four visually distinct image rows are present in the initial scroll viewport
- **AND** the Copy to Studio and Download Selected actions remain visible at the bottom

#### Scenario: User manages one group from its header
- **WHEN** a group contains both selected and unselected image cards
- **THEN** its header shows the item count, selected count, an indeterminate group-only Select All checkbox, and an icon-only Download action
- **AND** checking or clearing that checkbox changes only the current group without clearing selections in other groups
- **AND** the Download action submits only currently selected images in that group and is disabled when none are selected

#### Scenario: User accesses all selection commands in one row
- **WHEN** the panel renders Select All, Invert, Fold, Select Main, Select Detail, and Select SKU
- **THEN** all six small commands appear in one non-wrapping row and the three category commands do not include wording equivalent to Only
- **AND** invoking a category command adds every item in that category while preserving every existing selection outside that category
- **AND** a narrow viewport exposes horizontal scrolling for that row instead of wrapping or clipping button text

#### Scenario: Same image repeats inside one page region
- **WHEN** normalized URLs identify repeated copies of the same product image inside one group
- **THEN** the group contains only the first occurrence with continuous numbering
- **AND** selected and total counts use that group-local de-duplicated collection

#### Scenario: Several SKU variants share one source image
- **WHEN** seven declared SKU variants resolve to two distinct trusted image URLs
- **THEN** the SKU group shows seven image cards and reports seven variants
- **AND** every card retains exactly its own bounded variant name even when another card uses the same image URL
- **AND** copying or downloading the group keeps seven stable IDs, consecutive SKU orders, and variant-specific filenames

#### Scenario: User drags and docks the floating collector
- **WHEN** the user starts dragging from a non-control area of the header and moves the pointer beyond the header
- **THEN** the panel continues following the pointer and remains at the released floating position
- **AND** releasing within the left or right docking threshold docks the full-height panel at that edge without hiding it

#### Scenario: User enables and disables edge folding
- **WHEN** the user clicks Enable Fold in the same row as Select All and Invert
- **THEN** the panel docks to the nearest edge, the command becomes Disable Fold, and the panel collapses to a visible narrow rail instead of disappearing
- **AND** entering the rail expands the same panel while leaving it collapsible on pointer exit
- **AND** clicking Disable Fold leaves the complete panel expanded with the same collected images and selection state

#### Scenario: User clicks the extension action while the collector exists
- **WHEN** the floating collector already exists in either folded or expanded state and the user clicks the browser extension action
- **THEN** the collector is expanded after the action with its existing collection and selection state
- **AND** an already visible collector is not hidden or repositioned as a toggle side effect

#### Scenario: User views and zooms one collected image
- **WHEN** the user clicks View below an image card and turns the mouse wheel over the viewer
- **THEN** that image opens in an overlay contained entirely within the collector panel, dims only the collector content, leaves the rest of the product page unobscured, and scales between the bounded minimum and maximum
- **AND** the viewer exposes only translucent Previous and Next icon controls without the current image name or overall-position description
- **AND** the user can switch adjacent images without closing the viewer, with boundary controls disabled at the first and last image
- **AND** the viewer omits Back and the image-description title while exposing one translucent close-X command at the upper right
- **AND** the image can be panned with the left mouse button at every zoom level, including immediately after opening, without a drag ending as an outside click
- **AND** clicking outside the image within the panel closes the overlay, while quickly double-clicking the image restores its initial view and keeps the overlay open
- **AND** the underlying product page does not scroll and the list selection remains unchanged after closing the viewer

#### Scenario: User operates the reference-style viewer toolbar
- **WHEN** one image is open in the collector viewer
- **THEN** a six-control toolbar offers Fullscreen, Rotate Left, Rotate Right, Zoom In, Zoom Out, and Restore Initial View with Chinese tooltips
- **AND** Fullscreen covers the available plugin stage, rotations remain clipped by the panel, and Restore Initial View uses the same contain scale as the image's completed initial load
- **AND** Fullscreen and Restore Initial View execute independently on every click without retaining a selected or latched appearance
- **AND** no toolbar action enters browser fullscreen or expands the overlay outside the collector panel

#### Scenario: User restores the initial viewer state
- **WHEN** the user has rotated, zoomed, or panned an image and then clicks Restore Initial View or quickly double-clicks the image
- **THEN** any active drag ends, rotation becomes zero, both pan offsets become zero, and scale is recalculated from the current stage using the unrotated image's contain ratio
- **AND** the same image remains open and completely visible in the collector viewer

#### Scenario: User pans a contained or reduced image
- **WHEN** an image opens contained within the viewer or the user zooms it out until one or both rendered axes are smaller than the stage
- **THEN** the image immediately exposes grab interaction and a left-button drag updates its bounded offset without requiring prior enlargement
- **AND** every contained axis remains fully visible inside the stage while every overflowing axis can be moved to, but not beyond, either image edge
- **AND** releasing the drag keeps the viewer open

#### Scenario: User scans image-card actions
- **WHEN** grouped image cards are rendered in the collector
- **THEN** View and Download are represented by compact familiar icons rather than visible text labels
- **AND** each icon button exposes a Chinese tooltip and accessible name

### Requirement: Extension copies a versioned Studio import manifest
The extension SHALL copy selected images as a bounded UTF-8 text payload beginning with `GPT_IMAGE2_STUDIO_PRODUCT_IMAGES_V1`. The JSON portion SHALL include version, supported source page, product identity, capture time, and ordered normalized image items with stable IDs, group, source URL, suggested filename, dimensions, confidence, optional bounded SKU variant labels, and an optional bounded source `variantKey`. It MUST NOT include cookies, authorization headers, passwords, account data, or image Base64 payloads.

#### Scenario: User copies selected product images
- **WHEN** the user chooses Copy to Studio after selecting one or more collected images
- **THEN** the clipboard receives one valid versioned manifest containing exactly those selected items in display order
- **AND** no authenticated browser state or image binary is copied into the manifest

#### Scenario: Nothing is selected
- **WHEN** the user invokes copy with zero selected images
- **THEN** the extension keeps the clipboard unchanged
- **AND** displays a visible selection error

### Requirement: Extension downloads selected images into one product folder
The extension SHALL download every selected image to a sanitized relative folder under the browser's default Downloads directory. The relative path SHALL contain a local-date `YYMMDD` parent followed by one product folder. Main images SHALL be named `主图-<group-order>`, detail images SHALL be named `详情图-<group-order>`, and SKU images SHALL be named `SKU-<group-order>-<sanitized-variant-labels>` when variant labels are available. Filenames SHALL preserve a supported extension when known, remain bounded and Windows-safe, and use uniquifying conflict behavior. The download operation MUST NOT submit a JSON file, data URL, or other non-image helper download.

#### Scenario: User downloads a collected product batch
- **WHEN** the user selects images across main, detail, and SKU groups and invokes Download
- **THEN** each selected image is submitted to the browser downloads API under `GPT-Image2-Studio/<YYMMDD>/<product-folder>/`
- **AND** no `manifest.json`, JSON data URL, or other non-image download is submitted

#### Scenario: User downloads one image from its card
- **WHEN** the user clicks Download below one collected image card
- **THEN** the downloads API receives exactly that image using the same dated product folder and localized deterministic filename
- **AND** the card does not need to become selected first

#### Scenario: Product title contains Windows-invalid characters
- **WHEN** the source product title or identifier contains reserved characters, path traversal, a reserved device name, or excessive length
- **THEN** the generated folder and filenames remain relative, bounded, and valid on Windows
- **AND** no download can escape the `GPT-Image2-Studio` root folder

### Requirement: Extension uses minimum browser privileges
The extension SHALL use Manifest V3 and SHALL declare HTTPS host permissions only for the supported 1688, Amazon, Temu, TikTok Shop, SHEIN, and GigaB2B storefront domains. Automatic launcher content scripts SHALL use the narrowest path patterns Chrome can express for supported consumer product pages and SHALL perform complete runtime URL validation before creating DOM. Runtime validation SHALL reject category, search, homepage, seller-center, account, and unsupported regional pages. The action handler SHALL use the clicked tab directly, and launcher/panel requests SHALL use `sender.tab.id` plus the current `location.href` instead of querying for an active tab or depending on `Tab.url` visibility. It MUST NOT request `<all_urls>`, `tabs`, or `sidePanel`, read browsing history, capture authentication data, bypass login, CAPTCHA, risk checks or platform protections, or collect in the background without a user action.

#### Scenario: Extension is installed but collection is not invoked
- **WHEN** the user browses ordinary pages or only sees the launcher on a supported detail page
- **THEN** the extension does not scan page images or retain page content
- **AND** no launcher DOM appears unless complete runtime validation identifies a supported consumer product-detail URL

### Requirement: Local application distributes a reviewable extension package
The Local application SHALL generate a ZIP from version-controlled extension sources and the synchronized import-protocol module when the user requests the product-image collector package. The package SHALL include a valid manifest and Chinese installation instructions. Generated ZIP artifacts SHALL remain outside source control and desktop private-data directories.

#### Scenario: User requests the extension from the tools menu
- **WHEN** the local user invokes the product-image collector menu action
- **THEN** the application downloads the current extension ZIP with an attachment filename
- **AND** the UI reports package download rather than claiming that Chrome installed the extension

#### Scenario: User reviews the extension before downloading it
- **WHEN** the user moves a mouse over the Product Image Collector name or focuses it with the keyboard in the Creation tools menu
- **THEN** a complete associated tooltip describes the supported platforms, main/detail/SKU collection, Studio copy and product-folder download, active-user collection boundary, credential boundary, and browser installation confirmation
- **AND** the description remains fully visible beside the desktop menu or below the entry in single-column layouts without changing the download command

#### Scenario: Cloud user requests the local extension package
- **WHEN** a cloud-hosted workbench invokes the package action
- **THEN** the system reports that local extension packaging is unavailable in that runtime
- **AND** it does not expose server filesystem paths or a broken archive
