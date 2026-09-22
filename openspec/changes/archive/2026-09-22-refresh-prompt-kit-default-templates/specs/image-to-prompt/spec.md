## ADDED Requirements

### Requirement: Prompt Kit defaults cover common image workflows

The browser SHALL initialize Prompt Kit with ten built-in templates named `证件照`, `商务个人头像`, `电商白底主图`, `电商生活方式图`, `自然人像写真`, `时尚穿搭图`, `美食摄影`, `室内家居效果图`, `旅行城市纪实`, and `社媒营销海报`. Each built-in template SHALL contain non-empty reusable prompt text within the existing 3000-character template-editor limit. The built-in IDs SHALL use the versioned `default-template-v2-*` prefix. The certificate-photo template SHALL express a professional portrait treatment with a soft gray-to-white gradient background, natural soft lighting, centered medium framing, realistic skin tone, and a relaxed confident expression.

#### Scenario: A first-time user opens Prompt Kit

- **WHEN** the prompt-template storage key is absent
- **THEN** Prompt Kit loads the ten current built-in templates
- **AND** the first built-in template is `证件照`
- **AND** every built-in ID uses the `default-template-v2-*` prefix

#### Scenario: Default templates replace the former daily-life set

- **WHEN** the current source bundle is inspected
- **THEN** it contains the ten common workflow names above
- **AND** it does not retain `清晨通勤`, `家庭早餐`, `居家阅读`, `厨房做饭`, `超市采购`, `午后办公`, `健身运动`, `朋友聚会`, `亲子手作`, or `夜晚学习` as built-in names

### Requirement: Legacy built-in templates migrate without discarding user templates

When the browser reads a valid saved template array containing one or more legacy built-in IDs matching `default-template-数字`, it SHALL remove all legacy built-in entries and duplicate current v2 built-in entries, preserve every other normalized entry and its relative order, append the current ten built-in templates, and persist the migrated array under `image-studio-prompt-templates-v2` when storage permits. User-authored templates and `prompt-agent-*` history templates SHALL retain their IDs and remain available; existing template normalization and Prompt Agent compatibility rules remain in force.

#### Scenario: An existing user upgrades from the former defaults

- **WHEN** saved templates contain legacy built-ins, a custom template, and a `prompt-agent-*` template
- **THEN** the loaded list contains the custom and Prompt Agent entries available with their normalized content
- **AND** no legacy `default-template-数字` entry remains
- **AND** the current `default-template-v2-*` built-ins are present once each

#### Scenario: An explicitly empty list remains empty

- **WHEN** the saved template value is a valid empty array
- **THEN** loading templates returns an empty list
- **AND** the browser does not silently repopulate defaults

#### Scenario: Migration persistence is unavailable

- **WHEN** migration detects legacy built-ins but `localStorage.setItem` throws
- **THEN** the current session still uses the migrated in-memory list
- **AND** user and Prompt Agent entries remain available

#### Scenario: No legacy built-in is present

- **WHEN** the saved array contains only user-authored or current-version templates
- **THEN** loading templates does not rewrite or duplicate those entries
