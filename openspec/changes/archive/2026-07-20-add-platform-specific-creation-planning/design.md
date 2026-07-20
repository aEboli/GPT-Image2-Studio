## Context

套图模式当前已经有 19 个平台选项，但 `CREATION_PLATFORM_OPTIONS` 只为每个平台保存标签和一段自由文本提示词。规划器仍按同一套角色顺序切片，浏览器仍提交整套共用的比例与分辨率，本地服务和 Cloudflare Worker 也在生成循环外只解析一次这些参数。现有通用 `hero` 还要求营销承诺和场景小圆框，这与 Amazon、TikTok Shop、Walmart 等平台的无文字白底主图要求冲突。

当前工作树包含用户尚未提交的平台选择、参考图分析上下文、manifest 字段和相关测试改动。本设计必须在这些改动上增量实施，不覆盖、清理或重写无关内容。

平台图片规则来自 2026-07-11 前核验的官方规则和真实页面观察。Amazon、TikTok Shop、Walmart、Etsy、eBay、Shopify、Shopee、淘宝等平台有较强官方依据；京东、小红书和 Temu 有部分官方或真实页面证据；拼多多、抖音、Lazada、AliExpress、Rakuten、Coupang、Mercado Libre 的公开细则不完整，因此只能提供保守默认值，不能伪装成官方硬规则。

Listing 入口现已对所有平台开放，但 `marketplace=amazon-us`、`language=en-US`、数量前置标题、恰好五条要点、后台搜索词和 Amazon/Rufus 指导仍散落在草稿、提示词、校验和视图中。2026-07-15 的官方文档核验表明，各平台的字段、长度、语言和搜索面并不相同；继续只替换提示词会产生伪平台化输出，也会让旧记录、浏览器、本地服务和 Worker 对同一草稿产生不同解释。

## Goals / Non-Goals

**Goals:**

- 让不同平台得到真正不同的默认图片类型、顺序、张数、逐图比例、分辨率、语言、构图、文字密度和场景策略。
- 让所有平台自动方案都包含至少一个尺寸或真实尺度槽位，并在没有精确尺寸依据时保留该图片用途而不编造数值。
- 让平台 profile 的图库策略进入每个轮播项的最终提示词，避免平台差异只停留在类型名称和顺序上。
- 让平台原生图片类型成为计划项的一等字段，同时保留现有角色 ID 以兼容历史记录、参考图覆盖和现有提示词分配逻辑。
- 让用户通过套图级快捷控件和兼容图片类型启停调整计划，并能清楚区分平台自动值、用户覆盖和官方硬规则；不向用户开放逐图高级参数或提示词编辑。
- 让本地服务和 Cloudflare Worker 共享同一策略解析结果，并让每张图使用自己的生成参数。
- 让队列、保存、复用、补图和修复冻结当时的有效计划，不因未来策略更新发生漂移。
- 以来源、核验日期和证据等级管理平台规则；只有有明确官方来源的规则才能成为阻断性约束。
- 让 19 个 canonical 平台使用版本化 Listing policy 和跨类目转化 playbook，同时对外统一生成旧版字段合同。
- 让 Listing 草稿冻结平台、locale 与策略版本，并让本地服务与 Worker 对相同输入生成相同请求和直接完成结果。
- 生成前后确定性移除品牌、商标、店铺、卖家和平台名称；不引入 validator 重试、人工审核态或复制/导出门控。

**Non-Goals:**

- 运行时抓取、登录或自动更新第三方平台规则。
- 自动发布图片或 Listing 到第三方平台。
- 使用视觉模型对最终生成图片做自动合规认证。
- 建立平台乘以所有四级类目的完整静态笛卡尔矩阵。
- 保证平台审核通过、法律合规、搜索排名、销量或转化率；系统只提供基于当前来源和输入事实的可复核草稿。

## Decisions

### 1. 共享执行管线，使用结构化平台策略驱动不同规划

采用“共享生成执行管线 + 不同结构化规划策略”，而不是复制 18 套 server/Worker 生成流程。新增：

- `lib/creation-platform-policies.mjs`：图片类型定义、19 个平台 profile、规则来源、证据等级和版本。
- `lib/creation-platform-resolver.mjs`：规范化输入、合并类目与参考图需求、应用用户覆盖、验证约束并输出最终逐图计划参数。

`lib/creation-planner.mjs` 继续负责内容事实分配、参考图选择、SKU、Logo 和提示词组装，但不再自行保存一套独立的平台标签表。浏览器按现有类目模块的方式动态导入同一个策略模块，避免 `public/app.js` 与 planner 再次维护两份平台定义。

仓库现有 `scripts/sync-public-lib.mjs` 会把浏览器可用模块从 `lib` 精确镜像到 `public/lib`。平台策略与浏览器使用到的 resolver 必须加入 `PUBLIC_LIB_SYNC_TARGETS`，`lib` 保持唯一人工编辑源，`public/lib` 只由同步脚本生成；测试和完成前验证必须运行 `npm run sync:public-lib -- --check`，确保本地静态服务和 Pages 资产不会使用不同版本。

选择该方案是因为平台差异发生在“规划什么图、每张图如何生成”，而不是 HTTP、存储、SSE 和上游调用本身。仅扩展提示词或整套默认值无法支持混合比例；每个平台独立规划器则会造成规则、修复和 Worker 行为漂移。

### 2. 平台图片类型与旧角色分离

平台策略槽位至少包含：

- `slotKey`：策略内稳定槽位标识。
- `imageType` 与 `imageTypeLabel`：如 Amazon 白底主图、淘宝透明图、小红书信息流封面。
- `role`：映射到现有 hero、benefit、scene、multi-angle 等内容意图，保持参考图覆盖和历史 API 兼容。
- `ratio`、`resolutionTier`、`targetLanguage`：该图的默认生成参数。
- `composition`、`textPolicy`、`scenePolicy`：构图、文字密度和场景指导。
- `logoPolicy`：允许用户 Logo 叠加、只保留商品原有标识，或禁止外部 Logo 叠加。
- `required`、`constraints`：必选槽位和与图片类型绑定的规则。
- `sourceIds`：规则来源引用。

最终 plan item 保存上述有效字段，并继续保存 `role`、`prompt`、`itemId` 和 `slotIndex`。`carouselImageCount` 表示启用的平台轮播槽位数，兼容字段 `imageCount` 继续等于该值；`skuImageCount` 表示按稳定 SKU subject ID 去重后追加的一图一 SKU 数量；`infographicRebuildCount` 表示重构附加项数量；`totalPlannedItemCount` 必须等于三者之和。平台矩阵中的“SKU”或“变体”槽位表示一张对比多个已提供变体的轮播图；现有追加 SKU item 表示每个可售主体各生成一张独立图片。两者使用不同 item kind 和去重键，互不替代。少于两个可售 SKU 时，自动计划必须替换或省略变体对比槽位，避免与单 SKU 附加图重复；禁用对比槽位不影响追加 SKU items。

每个 profile 的自动槽位必须至少包含一个 `dimension-fit` 或 `scale-proof`。这两个尺寸用途不因缺少精确数值而被 evidence fallback 删除；当用户没有提供尺寸值或尺寸参考时，规划器必须禁止数字标注和推测测量值，只允许不带数值的结构、适配或尺度表达。用户一旦提供尺寸输入或已应用的尺寸参考，同一槽位再承载精确可见标签。

### 3. 版本化平台 profile 与默认矩阵

推荐张数是自动生成方案，不等于第三方平台允许上传的外部最大数量。通用电商 profile 保留原有 18 个角色对应的原生轮播槽位；每个命名平台的规范化槽位数则是本系统当前实际支持的该平台轮播图数量上限。数量控件不得提供超过当前 profile 上限的值，resolver 也不得用跨平台或通用 `custom` 槽位把命名平台扩展到固定 18 张。第一版 profile 如下：

| 平台 | 默认图片顺序 | 参数 | 证据 |
|---|---|---|---|
| 通用电商 | 首图、核心信息、场景、多角度、氛围、细节、品牌质感、尺寸、效果、参数、工艺、包装、SKU、材质、痛点、卖点、真人手持、真人穿戴，18 张 | 1:1，1.5K，English | 基线 |
| Amazon | 白底主图、功能证据、生活场景、多角度、细节、尺寸、包装清单，7 张 | 1:1，2K，English | A |
| 淘宝/天猫 | 白底图、透明图、场景图、卖点文案图、细节、尺寸、SKU、2:3 长图，8 张 | 1:1 与 2:3，2K，简中 | A |
| 京东 | 白底主图、参数、功能证明、细节、场景、尺寸、包装、品质证明，8 张 | 1:1，2K，简中 | B |
| 拼多多 | 清爽主图、套装数量、核心卖点、SKU、场景、尺寸、细节、到手清单，8 张 | 1:1，1.5K，简中 | C |
| 抖音电商 | 商城主图、3:4 内容封面、功能演示、使用场景、细节、SKU，6 张 | 1:1 与 3:4，1.5K，简中 | C |
| 小红书电商 | 3:4 原生封面、生活体验、步骤或测评、细节、尺度、干净商品图，6 张 | 3:4 为主，1.5K，简中 | B |
| Temu | 干净主图、套装价值、变体、卖点、尺寸、使用、细节、清单，8 张 | 1:1，1.5K，English | B |
| TikTok Shop | 白底主图、吸引点或演示、创作者场景、卖点、细节、变体，6 张 | 1:1，1.5K，English | A |
| Shopee | 封面、卖点、多角度、细节、尺寸、用法、变体、包装、材质，9 张 | 1:1，1.5K，English | A |
| Lazada | 封面、卖点、场景、细节、尺寸、变体、包装、对比，8 张 | 1:1，1.5K，English | C |
| Etsy | 生活方式首图、商品展示、工艺材质、微距、尺度、变体、礼赠包装、使用场景，8 张 | 全组 4:3，2K，English | A |
| eBay | 搜索首图、多角度、标签细节、成色、尺度、包含物、使用、瑕疵或纹理，8 张 | 1:1，2K，English | A |
| Walmart | 白底主图、替代角度、卖点、生活场景、尺寸、包含物，6 张 | 1:1，最大档，English | A |
| Shopify/DTC | 品牌首图、目录商品图、生活方式、卖点、细节、使用、变体、品牌信任，8 张 | 全组 1:1，2K，English | A |
| AliExpress | 主图、变体、套装、卖点、尺寸、使用、细节、包含物，8 张 | 1:1，1.5K，English | C |
| Rakuten | 目录主图、信息型卖点、细节、参数、使用、礼赠、变体、包含物，8 张 | 1:1，2K，日语 | C |
| Coupang | 干净主图、卖点、细节、尺寸、使用、包含物、对比、纵向详情，8 张 | 1:1 与 3:4，2K，韩语 | C |
| Mercado Libre | 白底主图、多角度、细节、尺寸、使用、变体、包含物、成色或标签，8 张 | 1:1，1.5K，西语 | C |

为使实现和测试不依赖中文描述推断，以下为规范化图片类型目录。`logoPolicy=forbid-overlay` 表示保留商品本身已有的品牌印记，但不得附加用户上传的外部 Logo 图层；`preserve-existing-only` 是默认建议，允许用户在非硬规则类型上覆盖；`allow-supplied` 允许使用用户提供的 Logo。

| imageType | 旧 role | 构图 | 文字 | 场景 | logoPolicy | 官方硬约束来源 |
|---|---|---|---|---|---|---|
| `generic-hero` | hero | 商品主导 | concise | optional-context | allow-supplied | 无 |
| `amazon-main` | hero | 居中白底、商品约占 85% | none | studio-white | forbid-overlay | amazon-g1881 |
| `taobao-white-main` | hero | 居中白底 | none | studio-white | forbid-overlay | taobao-uploadspecs |
| `transparent-cutout` | product-detail | 独立透明主体 | none | transparent | forbid-overlay | taobao-uploadspecs |
| `tiktok-shop-main` | hero | 居中干净商品 | none | studio-clean | forbid-overlay | tiktok-shop-481891871868714 |
| `walmart-main` | hero | 居中白底 | none | studio-white | forbid-overlay | walmart-image-guide |
| `clean-catalog-main` | hero | 居中干净商品 | none | studio-clean | preserve-existing-only | 无，建议值 |
| `brand-hero` | hero | 品牌主视觉 | concise | brand-context | allow-supplied | 无 |
| `content-cover` | hero | 动态竖版封面 | concise | demo-context | allow-supplied | 无 |
| `xhs-feed-cover` | hero | 3:4 编辑式封面 | concise | authentic-lifestyle | allow-supplied | 无，B 级建议 |
| `lifestyle-first` | atmosphere | 环境型首图 | none-or-short | authentic-lifestyle | allow-supplied | 无 |
| `scene-application` | scene | 多场景应用 | concise | authentic-use | allow-supplied | 无 |
| `ownership-atmosphere` | atmosphere | 拥有感氛围 | concise | authentic-lifestyle | allow-supplied | 无 |
| `use-style-story` | brand-story | 多场景使用与风格叙事 | moderate | multi-context | allow-supplied | 无 |
| `benefit-proof` | benefit | 商品与证据融合 | concise | optional-context | allow-supplied | 无 |
| `info-benefit` | benefit | 模块化信息层级 | moderate | neutral | allow-supplied | 无 |
| `value-bundle` | accessory-gift | 套装与数量分组 | factual-short | studio-clean | allow-supplied | 无 |
| `multi-angle` | multi-angle | 3–4 个角度 | none | studio-clean | preserve-existing-only | 无 |
| `clean-product-proof` | multi-angle | 单品或替代角度 | none | studio-clean | preserve-existing-only | 无 |
| `detail-macro` | product-detail | 微距与局部窗格 | factual-short | studio-clean | allow-supplied | 无 |
| `label-detail` | product-detail | 标签或标识特写 | factual-only | studio-clean | preserve-existing-only | 无 |
| `dimension-fit` | size-capacity-fit | 标线与适配参照 | factual-only | neutral | allow-supplied | 无 |
| `scale-proof` | size-capacity-fit | 真实尺度参照 | factual-short | authentic-lifestyle | allow-supplied | 无 |
| `spec-table` | spec-table | 参数表格 | factual-only | neutral | allow-supplied | 无 |
| `usage-demo` | usage-suggestion | 使用或步骤演示 | concise | authentic-use | allow-supplied | 无 |
| `creator-demo` | human-handheld | 真人手持或演示 | concise | authentic-use | allow-supplied | 无 |
| `wearable-demo` | human-wearable | 真人穿戴或携带 | concise | authentic-use | allow-supplied | 无 |
| `in-box` | accessory-gift | 到手清单平铺 | factual-only | studio-clean | allow-supplied | 无 |
| `variant-comparison` | series-showcase | 已提供变体对比 | factual-only | studio-clean | allow-supplied | 无 |
| `material-proof` | ingredient-material | 材质、成分或色卡 | factual-short | neutral | allow-supplied | 无 |
| `craft-proof` | craft-process | 工艺或品质证据 | factual-short | process | allow-supplied | 无 |
| `comparison-proof` | effect-comparison | 并列功能证据 | factual-only | controlled-context | allow-supplied | 无 |
| `pain-solution` | after-sales | 痛点、解决路径与结果 | concise | authentic-use | allow-supplied | 无 |
| `selling-point-stack` | usage-suggestion | 卖点与商品证据组合 | concise | optional-context | allow-supplied | 无 |
| `condition-proof` | product-detail | 成色检查 | factual-only | studio-clean | preserve-existing-only | 无，需输入证据 |
| `defect-disclosure` | product-detail | 瑕疵微距 | factual-only | studio-clean | preserve-existing-only | 无，需输入证据 |
| `gift-packaging` | accessory-gift | 礼赠或开箱 | concise | gift-context | allow-supplied | 无 |
| `long-detail` | brand-story | 纵向堆叠详情模块 | moderate | multi-context | allow-supplied | 无 |
| `brand-trust` | brand-story | 品牌与真实产品证据 | concise | brand-context | allow-supplied | 无，不得伪造 UGC |

平台 profile 使用下列稳定序列；`@` 后为逐槽比例，语言和分辨率继承上表的平台参数。实现测试必须把每行展开为完整 slot 对象并做快照断言，而不是只断言张数。

| 平台 | 规范化 slot sequence |
|---|---|
| 通用电商 | `generic-hero@1:1 > benefit-proof@1:1 > scene-application@1:1 > multi-angle@1:1 > ownership-atmosphere@1:1 > detail-macro@1:1 > use-style-story@1:1 > dimension-fit@1:1 > comparison-proof@1:1 > spec-table@1:1 > craft-proof@1:1 > in-box@1:1 > variant-comparison@1:1 > material-proof@1:1 > pain-solution@1:1 > selling-point-stack@1:1 > creator-demo@1:1 > wearable-demo@1:1` |
| Amazon | `amazon-main@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > multi-angle@1:1 > detail-macro@1:1 > dimension-fit@1:1 > in-box@1:1` |
| 淘宝/天猫 | `taobao-white-main@1:1 > transparent-cutout@1:1 > lifestyle-first@1:1 > info-benefit@1:1 > detail-macro@1:1 > dimension-fit@1:1 > variant-comparison@1:1 > long-detail@2:3` |
| 京东 | `clean-catalog-main@1:1 > spec-table@1:1 > comparison-proof@1:1 > detail-macro@1:1 > lifestyle-first@1:1 > dimension-fit@1:1 > in-box@1:1 > craft-proof@1:1` |
| 拼多多 | `clean-catalog-main@1:1 > value-bundle@1:1 > benefit-proof@1:1 > variant-comparison@1:1 > lifestyle-first@1:1 > dimension-fit@1:1 > detail-macro@1:1 > in-box@1:1` |
| 抖音电商 | `clean-catalog-main@1:1 > content-cover@3:4 > creator-demo@3:4 > lifestyle-first@3:4 > detail-macro@1:1 > dimension-fit@1:1` |
| 小红书电商 | `xhs-feed-cover@3:4 > lifestyle-first@3:4 > usage-demo@3:4 > detail-macro@3:4 > scale-proof@3:4 > clean-product-proof@1:1` |
| Temu | `clean-catalog-main@1:1 > value-bundle@1:1 > variant-comparison@1:1 > benefit-proof@1:1 > dimension-fit@1:1 > usage-demo@1:1 > detail-macro@1:1 > in-box@1:1` |
| TikTok Shop | `tiktok-shop-main@1:1 > creator-demo@1:1 > lifestyle-first@1:1 > benefit-proof@1:1 > detail-macro@1:1 > dimension-fit@1:1` |
| Shopee | `clean-catalog-main@1:1 > benefit-proof@1:1 > multi-angle@1:1 > detail-macro@1:1 > dimension-fit@1:1 > usage-demo@1:1 > variant-comparison@1:1 > in-box@1:1 > material-proof@1:1` |
| Lazada | `clean-catalog-main@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > detail-macro@1:1 > dimension-fit@1:1 > variant-comparison@1:1 > in-box@1:1 > comparison-proof@1:1` |
| Etsy | `lifestyle-first@4:3 > clean-product-proof@4:3 > craft-proof@4:3 > detail-macro@4:3 > scale-proof@4:3 > variant-comparison@4:3 > gift-packaging@4:3 > usage-demo@4:3` |
| eBay | `clean-catalog-main@1:1 > multi-angle@1:1 > label-detail@1:1 > condition-proof@1:1 > scale-proof@1:1 > in-box@1:1 > usage-demo@1:1 > defect-disclosure@1:1` |
| Walmart | `walmart-main@1:1 > multi-angle@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > dimension-fit@1:1 > in-box@1:1` |
| Shopify/DTC | `brand-hero@1:1 > clean-product-proof@1:1 > lifestyle-first@1:1 > benefit-proof@1:1 > detail-macro@1:1 > usage-demo@1:1 > dimension-fit@1:1 > brand-trust@1:1` |
| AliExpress | `clean-catalog-main@1:1 > variant-comparison@1:1 > value-bundle@1:1 > benefit-proof@1:1 > dimension-fit@1:1 > usage-demo@1:1 > detail-macro@1:1 > in-box@1:1` |
| Rakuten | `clean-catalog-main@1:1 > info-benefit@1:1 > detail-macro@1:1 > spec-table@1:1 > usage-demo@1:1 > gift-packaging@1:1 > dimension-fit@1:1 > in-box@1:1` |
| Coupang | `clean-catalog-main@1:1 > benefit-proof@1:1 > detail-macro@1:1 > dimension-fit@1:1 > usage-demo@1:1 > in-box@1:1 > comparison-proof@1:1 > long-detail@3:4` |
| Mercado Libre | `clean-catalog-main@1:1 > multi-angle@1:1 > label-detail@1:1 > dimension-fit@1:1 > usage-demo@1:1 > variant-comparison@1:1 > in-box@1:1 > condition-proof@1:1` |

自动 resolver 不允许重复 `imageType`，除非 slot 显式声明 `allowDuplicate`。当前 UI 不创建超出 profile 的 `custom` 槽位；显式数量只能截取当前平台已有槽位，不能扩展 profile。没有至少两个可售 SKU 时，`variant-comparison` 按 `[clean-product-proof, detail-macro, material-proof, craft-proof]` 顺序选择当前 profile 尚未使用且有证据支持的第一个 fallback；没有安全 fallback 时省略该槽位并减少轮播数。缺少成色或瑕疵证据时，`condition-proof` 和 `defect-disclosure` 使用相同的安全 fallback 规则。

证据等级 A 表示已核验明确官方资料，B 表示官方资料不完整但有平台页面或真实前后台观察，C 表示只能使用保守推断。等级属于 profile 总体提示；具体 `required` 约束必须逐条引用官方 source，不能仅凭 profile 等级升级为硬规则。

第一版 source register 至少保存以下已核验地址及核验日期 2026-07-11：

- `amazon-g1881` — Amazon Seller Central G1881：<https://sellercentral.amazon.com/gp/help/external/G1881>
- `tiktok-shop-481891871868714` — TikTok Shop Academy 481891871868714：<https://seller-us.tiktok.com/university/essay?knowledge_id=481891871868714>
- `walmart-image-guide` — Walmart Marketplace Learn 图片指南：<https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-detail-page:-Image-guidelines-&-requirements>
- Etsy 图片要求：<https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop>
- eBay Seller Center Photo Tips：<https://www.ebay.com/sellercenter/listings/photo-tips>
- Shopify Product Media：<https://help.shopify.com/en/manual/products/product-media/product-media-types>
- Shopee Seller Education 2989：<https://seller.shopee.ph/edu/article/2989>
- `taobao-uploadspecs` — 淘宝图片空间上传规范：<https://www.taobao.com/markets/imgrule/uploadspecs>
- 京东主图规则：<https://mtt.m.jd.com/article/articleView/38caf73d-746f-4607-b15f-5495c32d1b41> 与 <https://pro.jd.com/mall/active/SLULn5voab5iB92t9ZLCDUCTBks/index.html>
- 小红书真实内容流观察：<https://www.xiaohongshu.com/explore>

Temu 的 B 级结论来自用户登录态卖家后台的只读观察，没有稳定公开规则 URL；source metadata 必须明确标记为 `authenticated-observation`，不得升级为官方硬规则。其他缺乏可靠公开细则的平台保持 C 级。运行时不访问上述 URL。

### 4. 类目覆盖采用确定性补位，不复制全部平台矩阵

解析器复用当前四级 `industryTemplate`、现有角色 preset 和参考图覆盖信号：服饰优先穿戴与尺码，电子产品优先接口与参数，食品优先成分与食用场景，具有多个 SKU 时优先变体图。eBay 成色或瑕疵槽位只有存在相应用户输入或参考图证据时才保留，否则替换为产品细节。

类目覆盖只能替换、补位或调整平台推荐槽位，不能取消图片类型绑定的官方硬规则，也不能创造用户未提供的成色、认证、价格、销量、排名、保修、材质或性能事实。

### 5. 自动值、用户覆盖和硬规则采用明确优先级

有效值解析顺序为：

1. 通用基线。
2. 平台 profile。
3. 平台与类目覆盖。
4. 参考图覆盖需求。
5. 用户套图级和逐图覆盖。
6. 对最终图片类型执行约束验证。

套图级覆盖包括目标语言、默认比例、默认分辨率、视觉语言和启用槽位数量。用户修改目标语言、比例或分辨率时，浏览器必须立即把当前值写入 `platformSetOverrides`、清除旧预览并以该覆盖请求新计划；已有冻结计划或平台默认值不得覆盖当前表单的显式选择。兼容图片类型区域只允许启停当前计划槽位。界面不再提供逐图顺序、图片类型、比例、分辨率、语言、构图模式、文字密度、场景策略、Logo 策略或提示词编辑。历史记录中已冻结的逐图参数继续用于展示、重试和修复，但不能从当前 UI 自定义。现有 SKU 组合件数和 SKU 生成规则继续作为可编辑用户输入；平台只决定变体/SKU 图片槽位的自动推荐，不锁定 SKU 输入。

SKU 图启停属于追加项开关，不是平台重规划来源。浏览器切换该开关时可以请求新的计数和追加项，但必须继续显示并提交当前平台、平台轮播槽位与覆盖快照；新预览返回前保留原平台轮播视图，不得清空 `effectivePlan` 后显示通用角色 fallback。关闭 SKU 图后 `skuImageCount=0`，`carouselImageCount`、轮播槽位顺序和图片类型保持不变。

官方硬规则属于图片类型语义而不是普通默认值。例如 `amazon-main` 不能同时要求营销文字、拼贴场景或外部 Logo 叠加。即使用户已上传并启用 Logo，resolver 也必须让严格主图使用 `forbid-overlay`，生成引用组装不得把 Logo 文件附加到该 item；商品参考图中本来存在的品牌印记仍按商品保真规则保留。任何来源的冻结计划若违反硬规则，计划预览必须返回阻断错误；当前 UI 不提供把严格主图改成自定义类型以绕过校验的入口。推荐规则只产生警告，C 级策略不产生阻断性约束。

### 6. 每张图独立解析生成参数

当前 server 和 Worker 在生成循环外解析一次 `ratio` 与 `size`。实施后，规划器把有效 `ratio`、`resolutionTier` 和 `targetLanguage` 放入每个 item；本地与 Worker 在单图任务内部根据当前生图 route 将档位解析为实际尺寸，再追加该图的比例提示并提交上游。

若 route 不支持推荐尺寸，选择同一比例下最接近的可用尺寸并把实际值写回 item 和 manifest。单图失败仍按现有方式隔离，重试使用保存的逐图参数。

### 7. 浏览器保持简单默认且不开放逐图高级编辑

平台控件下方显示当前可编辑表单的自动方案摘要，例如“Amazon 自动方案 · 轮播 7 + SKU 3 + 重构 2 = 总计 12 · 1:1 · English · 2K”。“套图数量”只覆盖轮播图数量，并必须始终与摘要中的 `carouselImageCount` 一一对应；SKU 和信息图重构继续作为独立追加项计入总计。数量选项按当前 profile 的规范化槽位数动态过滤，平台切换后立即重建选项；旧值超过新上限时收紧为新平台推荐值并重新规划。现有语言、比例、分辨率和视觉语言控件继续提供套图级快捷覆盖，修改后显示“已覆盖”，且预览、冻结计划、队列与实际逐图请求必须显示并使用相同值。兼容图片类型区域仅显示和启停当前有效轮播槽位；不显示逐图高级编辑、添加/删除/排序控件或任何提示词输入。严格主图在用户启用 Logo 时继续按冻结 `logoPolicy` 自动排除外部 Logo，但不清除 Logo 文件或其他图片的 Logo 设置。

“套图数量”变化时，浏览器保存显式数量与对齐后的角色并立即发起新计划预览。生成提交若发生在该预览完成前，必须等待最新预览 Promise；只有最新 `effectivePlan` 已冻结且数量与当前选择一致时才允许入队。因此用户修改数量后的第一次生成即使用新数量，不依赖第二次点击。

resolver 仍可记录完整 warning 供调试和 manifest 留痕，但 UI 不展示 `missing-evidence-slot-omitted`、`missing-evidence-slot-replaced` 和 `image-count-extension-custom` 这三类无需用户操作的例行内部调整。其余可见 warning 按代码与消息去重；未知平台、无法满足请求数量和阻断错误继续显示。

每个轮播项的系统提示词必须包含当前 profile 的 `promptInstruction`，并把它作为整套图库的策划上下文，再叠加该槽位的 `imageType`、构图、文字、场景与 Logo 策略。通用角色 brief 只能补充内容意图，不能覆盖平台原生主图、内容封面、生活方式、尺度、详情和信息密度决策。

活动生成和队列任务继续持有各自冻结的 `effectivePlan`，但队列快照只在队列或记录上下文中展示。用户编辑下一套表单时，当前计划摘要和高级槽位必须读取该表单的草稿计划，不得因为后台任务正在生成或某个队列任务被选中而切换到旧任务计数。若生成期间允许编辑但暂时不能重新预览，界面必须清楚标记计划待刷新，不能把旧计数显示成当前表单的有效计划。

提供“恢复当前平台推荐”操作，只清除平台相关覆盖，不清除商品输入。官方硬规则显示来源和锁形提示，低证据 profile 显示“保守建议”。界面不需要在主表单展示完整来源列表，但计划摘要或说明入口必须能显示证据等级。

### 8. 平台切换是可取消的状态事务

用户改变平台时先保存旧平台和所有表单状态，再显示确认弹窗。确认后清除平台相关套图与逐图覆盖，应用新 profile，并保留商品名称、描述、卖点、类目、尺寸、参考图、风格图、Logo、SKU、输出格式和模型/API 配置。取消时恢复旧选项且不改变任何字段。

参考图分析请求携带递增请求 ID 及平台、类目快照。平台或类目变化时中止可中止的旧请求；即使请求无法真正取消，响应 ID 或快照不匹配时也不得写回状态。

### 9. 持久化冻结有效计划并兼容旧记录

新 manifest 保存 `strategyVersion`、`platformPolicyId`、`platformEvidenceLevel`、`platformProvenance`、四类计数字段、套图覆盖和每个 item 的图片类型、逐图参数、Logo 策略、约束与警告。新提交的 manifest 使用 `platformProvenance=explicit`。reader 必须在填充 `universal` fallback 前检查原始 manifest 是否真正拥有 platform 字段；缺失时保存内存态 `platformProvenance=legacy-missing`，从而区分“用户明确选择通用电商”和“旧记录没有平台概念”。这些来源字段继续服务计划和历史兼容，但不参与 Listing 入口资格判断。队列在提交时冻结完整 plan，而不是等任务开始时重新读取表单。

旧 manifest 缺少新字段时继续按已保存的 `role`、prompt 和图片记录显示与修复，不自动应用当前 profile。用户只有点击“按当前平台重新规划”才会基于最新 `strategyVersion` 生成新计划。历史复用仍清除无法恢复的浏览器 `File` 对象，并保持现有参考图重新绑定流程。

### 10. Listing 使用独立版本化策略注册表

新增 `lib/creation-listing-policies.mjs` 作为 Listing 文案规则的唯一人工编辑源，不把图片策略的来源或证据等级自动升级为文案规则。注册表以 5 个跨类目 archetype 保存共享基线，并要求 19 个 canonical ID 都有显式 override：

- `universal`：通用事实型基线。
- `search`：Amazon、京东、eBay、Walmart、Rakuten、Coupang、Mercado Libre。
- `value`：淘宝/天猫、拼多多、Temu、Shopee、Lazada、AliExpress。
- `content`：抖音电商、小红书电商、TikTok Shop。
- `editorial`：Etsy、Shopify/DTC；只复用商品故事、工艺与使用语境的写作顺序，不携带品牌、商标、店铺或卖家语义。

archetype 只复用跨类目写作顺序，不代表平台规则相同。每个平台 override 至少声明 `id`、`label`、`marketplaceId`、`defaultLocale`、`policyVersion`、`verifiedAt`、`evidenceLevel`、`sourceIds`、标题规则、高亮规则、描述规则、搜索面规则、转化顺序、变体策略、claim 风险组、发布字段与内部字段、fallback。标题和搜索限制同时支持字符与 UTF-8 字节语义；未被官方资料明确覆盖的长度、条数、语气和关键词建议必须标记为可配置的保守建议。

Listing 规则采用与图片规则相同的来源纪律：只有当前可核验的官方文档才能形成阻断性硬规则，官方文档未说明的内容、登录态观察、经验型转化建议和 C 级 profile 只能产生提示或警告。第一版 Listing source register 保存核验日期 2026-07-15，并至少包含：

- 跨平台真实、合法和不得误导底线：《中华人民共和国广告法》：<https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2023/art_5474cf75173c45d6a0379730fb4e8d97.html>。
- Amazon 标题与要点：<https://sellercentral.amazon.com/help/hub/reference/external/GYTR6SYGFA5E3EQC>、75 字符限制于 2026-07-27 生效的官方公告 <https://sellercentral.amazon.com/seller-forums/discussions/t/145b6d0f-999c-4555-896c-c694bda2e470>，以及 <https://sellercentral.amazon.com/help/hub/reference/external/GX5L8BF8GLMML6CX>。
- TikTok Shop 商品标题与商品信息：<https://seller-us.tiktok.com/university/essay?knowledge_id=7073362639816491> 与 <https://seller-us.tiktok.com/university/essay?knowledge_id=3196690250417921>。
- Etsy 标题、标签与描述：<https://www.etsy.com/seller-handbook/article/382774281517>、<https://www.etsy.com/seller-handbook/article/1399426136697> 与 <https://www.etsy.com/seller-handbook/article/1347574487014>。
- eBay listing best practices：<https://www.ebay.com/sellercenter/listings/create-listings/best-practices>。
- Walmart Product Detail Page 与 Keyword optimization：<https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-Detail-Page:-overview> 与 <https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Keyword-optimization>。
- Shopify 商品描述与 SEO 关键词：<https://help.shopify.com/en/manual/products/details/product-descriptions/write> 与 <https://help.shopify.com/en/manual/promoting-marketing/seo/adding-keywords>。
- 淘宝、京东、拼多多、抖音、小红书、Shopee、Lazada、Rakuten 与 Coupang 官方开放平台或卖家教育文档：<https://open.taobao.com/doc.htm?docId=119447&docType=1>、<https://jos.jd.com/apilist?apiGroupId=48&apiId=13420&apiName=jingdong.ware.write.add>、<https://open.pinduoduo.com/application/document/api?id=pdd.goods.add>、<https://op.jinritemai.com/docs/api-docs/14/249>、<https://op.jinritemai.com/docs/api-docs/14/1373>、<https://open.xiaohongshu.com/document/api?apiNavigationId=65&id=12&gatewayId=103&gatewayVersionId=1661&apiId=6487&apiParentNavigationId=14>、<https://seller.shopee.com.my/edu/article/2222>、<https://seller.shopee.sg/edu/article/87/product-descriptions-best-practices>、<https://open.lazada.com/apps/doc/doc?nodeId=30715&docId=120946>、<https://navi-manual.faq.rakuten.net/> 与 <https://developers.coupangcorp.com/hc/en-us/articles/360033877853-Product-Creation>。

研究快照中的精确限制只能在对应可靠官方 source 仍为当前策略依据时作为版本化规则。当前基线包括 Etsy 标题最多 140 个字符、最多 13 个标签且每个标签最多 20 个字符；Amazon 标题 75 字符限制自 2026-07-27 起生效、要点至少 3 条且每条 10-255 字符，并且只有可靠官方 source 明确支持时才写入具体 backend search UTF-8 字节上限；TikTok Shop 标题 25-200 字符；eBay 标题 80 字符；Coupang 商品名不超过 100 字符，搜索标签数量和单标签上限按官方定义的 UTF-8 bytes 而不是 characters 计量。Amazon 75 字符限制在 2026-07-27 前只产生 recommendation warning，生效日及之后才成为 blocking error；validator 使用显式 validation date 或当前日期判断，无法解析的显式日期按保守阻断处理。Temu、AliExpress、Mercado Libre 以及其他没有稳定公开 Listing 细则的平台继续使用保守可配置值，不得标成官方硬限制。运行时不访问上述 URL。

### 11. 冻结平台和 locale，并统一恢复旧版 Listing 字段

Listing policy 解析顺序为：`effectivePlan.platformPolicyId` 或 `effectivePlan.platform` > manifest `platformPolicyId` > manifest `platform` > `universal`。目标 locale 解析顺序为冻结 `effectivePlan.targetLanguage` > manifest `targetLanguage` > policy `defaultLocale`。未知平台、无法支持的 locale 或 `platformProvenance=legacy-missing` 使用通用基线；不得把 reader 为兼容填充的 `platform=universal` 误当成旧记录曾经显式选择过平台。

新草稿直接使用旧版合同：`title`、`sellingPoints`、`painPoints`、`fiveBullets`、`description`、`backendSearchTerms`、`keywordBuckets`，并保存结构同构的简体中文 `zhDisplay`。所有平台都使用同一组字段名和“标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组”显示顺序；policy 只决定每个字段的内容侧重点、语言指导、关键词意图和写作顺序。

reader 与视图继续接受历史 V1 和 V2 草稿。历史 V1 按原内容读取；历史 V2 只在视图层映射到旧版显示、复制与导出字段，不批量改写存储。用户显式重写或重新生成时才创建新的旧版字段草稿并冻结当前 Listing policy 版本。

### 12. 单次提示词请求和直接回退

请求提示词按“统一无品牌要求 > 平台 policy > locale 与单位 > 跨类目 playbook > Source JSON”分层组装。Amazon US、Rufus、数量前置和搜索密度等内容只在对应 policy 中启用；无论平台如何，模型都必须返回稳定的旧版 JSON 字段和英中对照。

跨类目 playbook 固定为商品身份与搜索意图、事实支持的结果型卖点、真实使用场景、购买疑虑回答、尺寸/适配/变体/包装清晰度和证据不足披露。平台 override 可以重排、删减或改变字段表现，但不得创建平台乘以类目的静态矩阵，也不得加入用户没有提供的类目事实。

source builder 只把用户商品资料、SKU/包装/尺寸输入、参考图角色说明、保存的有效计划与可追溯 manifest 元数据中的可用商品事实交给模型，并在请求前移除已识别的品牌、商标、店铺、卖家和平台名称。

模型只请求一次。解析成功时归一化为旧版字段并执行确定性的无品牌清洗后直接返回 `completed`；请求失败、上游限流、服务错误或 JSON 解析失败时，直接基于可用商品事实构造同字段的确定性 fallback，并返回 `completed`。流程不运行 validator 驱动的重试、不生成 `needs-review`、不要求人工审核，也不阻止复制或导出。缺少 API 配置时仍返回明确配置错误。

### 13. 浏览器、本地服务和 Worker 共享同一 Listing 语义

浏览器始终按旧版顺序展示“标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组”，每个英文值下方紧邻对应的简体中文参考。单字段复制、整段复制和结构化导出直接可用且保留英中映射，不读取审核状态或访问门控。平台与 policy 信息只作为非内容 metadata 展示。

本地服务从保存的 manifest 读取 set，Cloudflare Worker 从显式 payload 读取 set，但两者都调用相同的 source builder、policy resolver、旧版 schema、prompt builder、normalizer、无品牌 sanitizer 和 fallback。相同规范化 set 与配置应产生等价的上游请求体、草稿元数据和完成结果；端点不得复制 19 套策略，也不得在运行时抓取规则来源。

### 14. 旧版字段使用英中逐项对照和统一无品牌清洗

新生成或用户显式重写的草稿将顶层 `title`、`sellingPoints`、`painPoints`、`fiveBullets`、`description`、`backendSearchTerms`、`keywordBuckets` 作为英文内容字段，并在 `zhDisplay` 中保存同名、同类型、同顺序的简体中文逐项对照。平台 policy 仍决定内容侧重点，但 UI、单字段复制、整段复制和结构化导出不得丢失或错配英中对应关系。平台、policy、locale、来源和证据等级只作为非内容 metadata 保存，不得混入内容字段。

所有上述英文和中文内容字段递归禁止任何品牌名、商标名、店铺名、卖家名和平台名。该 `no-brand` 约束是 GPT-Image2-Studio 的统一产品硬规则，不得写成第三方平台的官方规则，也不因源数据或平台 policy 放宽。

source builder 在进入模型提示词前，从商品名称、描述、卖点、SKU、包装/尺寸、参考图说明和可追溯 manifest 文本中提取禁止词集合并从事实输入剥离。prompt 明确禁止输出这些词；sanitizer 对 model、mock 和确定性 fallback 的全部英中内容叶子执行确定性移除或中性替换，normalizer 保持英中结构同构。该清洗是输出转换的一部分，不产生审核状态、重试或访问门控。

浏览器、本地服务与 Worker、model、mock 和确定性 fallback 必须复用同一提取、净化与归一化实现，并在产生草稿后直接标记 `completed`、开放复制和导出。历史草稿读取时不自动改写存储；新生成或显式重写后才使用本节合同。

## Risks / Trade-offs

- [平台规则会变化] → 每个 profile 和 source 版本化并保存核验日期；历史记录冻结有效计划，更新策略需独立变更与测试。
- [低证据平台默认值可能不准确] → 明确显示 C 级保守建议，不创建硬约束，并保持所有值可覆盖。
- [逐图参数增加数据复杂度] → UI 只显示自动摘要、套图快捷控件和兼容图片类型启停；逐图参数由规划器生成并冻结，不开放高级编辑。
- [生成模型仍可能不遵守主图规则] → 规划器阻止已知输入冲突并显示合规提示，但明确不把生成结果声明为已通过平台审核。
- [平台与类目组合数量很大] → 使用确定性类目补位而不是维护 19 乘以全部四级类目的静态矩阵。
- [脏工作树发生冲突] → 实施前记录当前 diff，只修改本变更需要的函数和测试，不格式化或清理无关文件。
- [本地与 Worker 产生漂移] → 策略和 resolver 使用同一模块，并增加相同 payload 的计划深度相等测试。
- [Listing 官方字段与限制会随站点、类目和后台版本变化] → Listing policy 单独版本化并保存来源与核验日期；只有当前官方依据形成硬规则，其余保持可配置建议。
- [关闭审核与 validator 重试可能降低格式容错] → 使用严格旧版 JSON schema、归一化和确定性 fallback 保证字段完整，但不引入审核状态或复制门控。
- [历史 V2 字段与当前旧版合同不同] → reader 在视图层映射 V2 aliases，旧草稿不自动迁移，重写才使用当前旧版合同。

## Migration Plan

1. 先用失败测试固定平台 profile、解析优先级、逐图参数、切换事务、队列快照和历史兼容行为。
2. 增加策略与 resolver 模块，将当前平台标签和提示词迁移到唯一注册表，同时保留 `universal` fallback。
3. 让 planner 输出新字段，但暂时保持旧 `role`、API 字段和旧记录读取兼容。
4. 更新浏览器自动应用与覆盖交互，再更新本地和 Worker 单图生成参数解析。
5. 扩展队列、manifest、复用和 repair；运行迁移与旧 fixture 回归测试。
6. 最后移除 Listing 平台资格限制，并对 19 个 canonical 平台、旧记录及真实浏览器控件进行验收。
7. 用研究和测试固定 Listing source register、5 个 archetype、19 个 override、解析顺序、旧版字段和平台内容差异。
8. 更新 Listing source、旧版 schema、prompt、单次请求、直接 fallback、记录页、复制、导出与同步模块，并验证本地/Worker 请求和结果一致。

回滚时可恢复旧 UI 和全局参数提交，同时保留新 manifest 的未知可选字段；reader 必须继续读取已有 V1/V2 草稿。不得删除或批量重写已有 Creation manifest 或 Listing 草稿。

## Open Questions

无。跨地区平台第一版使用表中默认语言；地区/站点选择器作为未来独立变更处理，用户当前可通过目标语言覆盖。
