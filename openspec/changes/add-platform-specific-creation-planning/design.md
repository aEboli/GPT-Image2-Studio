## Context

套图模式当前已经有 19 个平台选项，但 `CREATION_PLATFORM_OPTIONS` 只为每个平台保存标签和一段自由文本提示词。规划器仍按同一套角色顺序切片，浏览器仍提交整套共用的比例与分辨率，本地服务和 Cloudflare Worker 也在生成循环外只解析一次这些参数。现有通用 `hero` 还要求营销承诺和场景小圆框，这与 Amazon、TikTok Shop、Walmart 等平台的无文字白底主图要求冲突。

当前工作树包含用户尚未提交的平台选择、参考图分析上下文、manifest 字段和相关测试改动。本设计必须在这些改动上增量实施，不覆盖、清理或重写无关内容。

平台图片规则来自 2026-07-11 前核验的官方规则和真实页面观察。Amazon、TikTok Shop、Walmart、Etsy、eBay、Shopify、Shopee、淘宝等平台有较强官方依据；京东、小红书和 Temu 有部分官方或真实页面证据；拼多多、抖音、Lazada、AliExpress、Rakuten、Coupang、Mercado Libre 的公开细则不完整，因此只能提供保守默认值，不能伪装成官方硬规则。

Listing 入口现已对所有平台开放，但 `marketplace=amazon-us`、`language=en-US`、数量前置标题、恰好五条要点、后台搜索词和 Amazon/Rufus 指导仍散落在草稿、提示词、校验和视图中。2026-07-15 的官方文档核验表明，各平台的字段、长度、语言和搜索面并不相同；继续只替换提示词会产生伪平台化输出，也会让旧记录、浏览器、本地服务和 Worker 对同一草稿产生不同解释。

## Goals / Non-Goals

**Goals:**

- 让不同平台得到真正不同的默认图片类型、顺序、张数、逐图比例、分辨率、语言、构图、文字密度和场景策略。
- 让平台原生图片类型成为计划项的一等字段，同时保留现有角色 ID 以兼容历史记录、参考图覆盖和现有提示词分配逻辑。
- 让用户可以覆盖所有自动值，并能清楚区分平台自动值、用户覆盖和官方硬规则。
- 让本地服务和 Cloudflare Worker 共享同一策略解析结果，并让每张图使用自己的生成参数。
- 让队列、保存、复用、补图和修复冻结当时的有效计划，不因未来策略更新发生漂移。
- 以来源、核验日期和证据等级管理平台规则；只有有明确官方来源的规则才能成为阻断性约束。
- 让 19 个 canonical 平台使用版本化 Listing policy、平台字段语义和跨类目转化 playbook，同时保持同一生成、校验、持久化和回退管线。
- 让 Listing 草稿冻结平台、locale 与策略版本，兼容旧 Amazon 字段，并让本地服务与 Worker 对相同输入生成相同请求和校验结果。
- 用统一事实门控和 claim 风险控制减少误导、无依据承诺和跨类目违规风险，同时明确输出仍需用户复核。

**Non-Goals:**

- 运行时抓取、登录或自动更新第三方平台规则。
- 自动发布图片或 Listing 到第三方平台。
- 使用视觉模型对最终生成图片做自动合规认证；平台约束仍需用户最终审核。
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

### 3. 版本化平台 profile 与默认矩阵

推荐张数是自动生成方案，不等于平台允许上传的最大数量。第一版 profile 如下：

| 平台 | 默认图片顺序 | 参数 | 证据 |
|---|---|---|---|
| 通用电商 | 首图、卖点、场景、多角度、细节、尺寸、包装、SKU，8 张 | 1:1，1.5K，English | 基线 |
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
| `in-box` | accessory-gift | 到手清单平铺 | factual-only | studio-clean | allow-supplied | 无 |
| `variant-comparison` | series-showcase | 已提供变体对比 | factual-only | studio-clean | allow-supplied | 无 |
| `material-proof` | ingredient-material | 材质、成分或色卡 | factual-short | neutral | allow-supplied | 无 |
| `craft-proof` | craft-process | 工艺或品质证据 | factual-short | process | allow-supplied | 无 |
| `comparison-proof` | effect-comparison | 并列功能证据 | factual-only | controlled-context | allow-supplied | 无 |
| `condition-proof` | product-detail | 成色检查 | factual-only | studio-clean | preserve-existing-only | 无，需输入证据 |
| `defect-disclosure` | product-detail | 瑕疵微距 | factual-only | studio-clean | preserve-existing-only | 无，需输入证据 |
| `gift-packaging` | accessory-gift | 礼赠或开箱 | concise | gift-context | allow-supplied | 无 |
| `long-detail` | brand-story | 纵向堆叠详情模块 | moderate | multi-context | allow-supplied | 无 |
| `brand-trust` | brand-story | 品牌与真实产品证据 | concise | brand-context | allow-supplied | 无，不得伪造 UGC |

平台 profile 使用下列稳定序列；`@` 后为逐槽比例，语言和分辨率继承上表的平台参数。实现测试必须把每行展开为完整 slot 对象并做快照断言，而不是只断言张数。

| 平台 | 规范化 slot sequence |
|---|---|
| 通用电商 | `generic-hero@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > multi-angle@1:1 > detail-macro@1:1 > dimension-fit@1:1 > in-box@1:1 > variant-comparison@1:1` |
| Amazon | `amazon-main@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > multi-angle@1:1 > detail-macro@1:1 > dimension-fit@1:1 > in-box@1:1` |
| 淘宝/天猫 | `taobao-white-main@1:1 > transparent-cutout@1:1 > lifestyle-first@1:1 > info-benefit@1:1 > detail-macro@1:1 > dimension-fit@1:1 > variant-comparison@1:1 > long-detail@2:3` |
| 京东 | `clean-catalog-main@1:1 > spec-table@1:1 > comparison-proof@1:1 > detail-macro@1:1 > lifestyle-first@1:1 > dimension-fit@1:1 > in-box@1:1 > craft-proof@1:1` |
| 拼多多 | `clean-catalog-main@1:1 > value-bundle@1:1 > benefit-proof@1:1 > variant-comparison@1:1 > lifestyle-first@1:1 > dimension-fit@1:1 > detail-macro@1:1 > in-box@1:1` |
| 抖音电商 | `clean-catalog-main@1:1 > content-cover@3:4 > creator-demo@3:4 > lifestyle-first@3:4 > detail-macro@1:1 > variant-comparison@1:1` |
| 小红书电商 | `xhs-feed-cover@3:4 > lifestyle-first@3:4 > usage-demo@3:4 > detail-macro@3:4 > scale-proof@3:4 > clean-product-proof@1:1` |
| Temu | `clean-catalog-main@1:1 > value-bundle@1:1 > variant-comparison@1:1 > benefit-proof@1:1 > dimension-fit@1:1 > usage-demo@1:1 > detail-macro@1:1 > in-box@1:1` |
| TikTok Shop | `tiktok-shop-main@1:1 > creator-demo@1:1 > lifestyle-first@1:1 > benefit-proof@1:1 > detail-macro@1:1 > variant-comparison@1:1` |
| Shopee | `clean-catalog-main@1:1 > benefit-proof@1:1 > multi-angle@1:1 > detail-macro@1:1 > dimension-fit@1:1 > usage-demo@1:1 > variant-comparison@1:1 > in-box@1:1 > material-proof@1:1` |
| Lazada | `clean-catalog-main@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > detail-macro@1:1 > dimension-fit@1:1 > variant-comparison@1:1 > in-box@1:1 > comparison-proof@1:1` |
| Etsy | `lifestyle-first@4:3 > clean-product-proof@4:3 > craft-proof@4:3 > detail-macro@4:3 > scale-proof@4:3 > variant-comparison@4:3 > gift-packaging@4:3 > usage-demo@4:3` |
| eBay | `clean-catalog-main@1:1 > multi-angle@1:1 > label-detail@1:1 > condition-proof@1:1 > scale-proof@1:1 > in-box@1:1 > usage-demo@1:1 > defect-disclosure@1:1` |
| Walmart | `walmart-main@1:1 > multi-angle@1:1 > benefit-proof@1:1 > lifestyle-first@1:1 > dimension-fit@1:1 > in-box@1:1` |
| Shopify/DTC | `brand-hero@1:1 > clean-product-proof@1:1 > lifestyle-first@1:1 > benefit-proof@1:1 > detail-macro@1:1 > usage-demo@1:1 > variant-comparison@1:1 > brand-trust@1:1` |
| AliExpress | `clean-catalog-main@1:1 > variant-comparison@1:1 > value-bundle@1:1 > benefit-proof@1:1 > dimension-fit@1:1 > usage-demo@1:1 > detail-macro@1:1 > in-box@1:1` |
| Rakuten | `clean-catalog-main@1:1 > info-benefit@1:1 > detail-macro@1:1 > spec-table@1:1 > usage-demo@1:1 > gift-packaging@1:1 > variant-comparison@1:1 > in-box@1:1` |
| Coupang | `clean-catalog-main@1:1 > benefit-proof@1:1 > detail-macro@1:1 > dimension-fit@1:1 > usage-demo@1:1 > in-box@1:1 > comparison-proof@1:1 > long-detail@3:4` |
| Mercado Libre | `clean-catalog-main@1:1 > multi-angle@1:1 > label-detail@1:1 > dimension-fit@1:1 > usage-demo@1:1 > variant-comparison@1:1 > in-box@1:1 > condition-proof@1:1` |

自动 resolver 不允许重复 `imageType`，除非 slot 显式声明 `allowDuplicate`；用户手工创建的重复 custom 槽位不受此限制。没有至少两个可售 SKU 时，`variant-comparison` 按 `[clean-product-proof, detail-macro, material-proof, craft-proof]` 顺序选择当前 profile 尚未使用且有证据支持的第一个 fallback；没有安全 fallback 时省略该槽位并减少轮播数。缺少成色或瑕疵证据时，`condition-proof` 和 `defect-disclosure` 使用相同的安全 fallback 规则。

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

套图级覆盖包括目标语言、默认比例、默认分辨率、视觉语言、默认构图模式、默认文字密度、默认场景策略、默认 Logo 策略和启用槽位数量；逐图覆盖包括启停、顺序、图片类型、比例、分辨率、语言、构图模式、文字密度、场景策略、Logo 策略和提示词。逐图值高于套图级值。现有 SKU 组合件数和 SKU 生成规则继续作为可编辑用户输入；平台只决定变体/SKU 图片槽位的自动推荐，不锁定 SKU 输入。

官方硬规则属于图片类型语义而不是普通默认值。例如 `amazon-main` 不能同时要求营销文字、拼贴场景或外部 Logo 叠加。即使用户已上传并启用 Logo，resolver 也必须让严格主图使用 `forbid-overlay`，生成引用组装不得把 Logo 文件附加到该 item；商品参考图中本来存在的品牌印记仍按商品保真规则保留。用户显式把严格主图的 Logo 策略改为叠加时，计划预览返回阻断错误；用户可以把槽位改成 `custom` 后继续，界面必须显示“不保证平台合规”。推荐规则只产生警告，C 级策略不产生阻断性约束。

### 6. 每张图独立解析生成参数

当前 server 和 Worker 在生成循环外解析一次 `ratio` 与 `size`。实施后，规划器把有效 `ratio`、`resolutionTier` 和 `targetLanguage` 放入每个 item；本地与 Worker 在单图任务内部根据当前生图 route 将档位解析为实际尺寸，再追加该图的比例提示并提交上游。

若 route 不支持推荐尺寸，选择同一比例下最接近的可用尺寸并把实际值写回 item 和 manifest。单图失败仍按现有方式隔离，重试使用保存的逐图参数。

### 7. 浏览器保持简单默认并按需展开覆盖

平台控件下方显示自动方案摘要，例如“Amazon 自动方案 · 轮播 7 + SKU 3 + 重构 2 = 总计 12 · 1:1 · English · 2K”。现有张数、语言、比例、分辨率和视觉语言控件继续提供套图级快捷覆盖，修改后显示“已覆盖”。图片类型区域显示有顺序的槽位清单，支持增删、启停和上下移动；每个槽位按需展开图片类型、比例、分辨率、语言、构图模式、文字密度、场景策略、Logo 策略和提示词编辑。严格主图在用户启用 Logo 时显示“此图不叠加外部 Logo”，但不清除 Logo 文件或其他图片的 Logo 设置。

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
- `brand`：Etsy、Shopify/DTC。

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

研究快照中的精确限制，例如 Amazon 标题 75 字符限制自 2026-07-27 起生效、Amazon 要点至少 3 条且每条 10-255 字符、TikTok Shop 标题 25-200 字符、eBay 标题 80 字符、Coupang 商品名不超过 100 字符且搜索标签最多 20 个并各不超过 20 字符，只能在对应 source 仍为当前策略依据时作为版本化规则。Amazon 75 字符限制在 2026-07-27 前只产生 recommendation warning，生效日及之后才成为 blocking error；validator 使用显式 validation date 或当前日期判断，无法解析的显式日期按保守阻断处理。Temu、AliExpress、Mercado Libre 以及其他没有稳定公开 Listing 细则的平台继续使用保守可配置值，不得标成官方硬限制。运行时不访问上述 URL。

### 11. 冻结平台和 locale，并演进为 V2 superset draft

Listing policy 解析顺序为：`effectivePlan.platformPolicyId` 或 `effectivePlan.platform` > manifest `platformPolicyId` > manifest `platform` > `universal`。目标 locale 解析顺序为冻结 `effectivePlan.targetLanguage` > manifest `targetLanguage` > policy `defaultLocale`。未知平台、无法支持的 locale 或 `platformProvenance=legacy-missing` 回退到可说明的基线，并在草稿中记录 warning；不得把 reader 为兼容填充的 `platform=universal` 误当成旧记录曾经显式选择过平台。

新草稿使用 V2 superset：保存 `schemaVersion`、`platformId`、`marketplace`、`platformLabel`、`listingPolicyVersion`、`language`、`title`、`sellingPoints`、`buyerObjections`、`highlights`、`description`、`searchTerms`、`keywordBuckets`、证据、缺失信息、警告、状态、时间戳和中文复核视图。`highlights` 的平台显示标签、条数和引导格式由 policy 决定；`searchTerms` 可表示 Amazon 后台词、Etsy 标签、平台搜索词或仅供参考的关键词建议，UI 必须按 policy 显示用途，不能把所有平台都标为“后台搜索词”。`sellingPoints` 和 `buyerObjections` 是写作与复核依据，只有 profile 明确列入 `publishFields` 时才进入整段发布复制。

reader 与视图继续接受 V1 `fiveBullets`、`backendSearchTerms`、`painPoints`、`marketplace=amazon-us` 和 `zhDisplay` 别名；旧草稿按原字段、原 marketplace 和原内容显示、复制与导出，不批量重写，也不在读取时套用新 profile。用户显式重写或重新生成时才创建 V2 草稿并冻结当前 Listing policy 版本。

### 12. 提示词、schema、校验和回退共用事实门控

请求提示词按“跨平台事实与安全底线 > 平台 policy > locale 与单位 > 跨类目 playbook > Source JSON > 重试错误”分层组装。Amazon US、Rufus、数量前置、英文、固定五点和大写引导词不再是全局指令，只在对应 policy 有依据时启用。strict JSON schema 使用稳定 V2 superset 并由 policy 约束条数；字符数、UTF-8 字节数、语言、字段用途和 claim 校验留在共享 validator，避免不同兼容网关对 JSON Schema 长度关键字支持不一致。

跨类目 playbook 固定为商品身份与搜索意图、事实支持的结果型卖点、真实使用场景、购买疑虑回答、尺寸/适配/变体/包装清晰度和证据不足披露。平台 override 可以重排、删减或改变字段表现，但不得创建平台乘以类目的静态矩阵，也不得加入用户没有提供的类目事实。

统一事实门控只接受用户商品资料、SKU/包装/尺寸输入、参考图角色说明、保存的有效计划与可追溯 manifest 元数据作为公开 claim 的基础。生成图只能支持可直接观察的外观、数量和场景，不足以单独证明材质、认证、医疗/保健效果、安全、兼容性、耐久、性能、销量、排名、评价、价格、折扣、保修或退款承诺。无法证明的事实进入 `missingInfo` 或被删除；高风险绝对化、比较级、社会证明和促销 claim 进入 warning 或阻断。

模型输出先归一化再按 resolved policy 校验，失败时携带结构化错误重试一次。仍失败时只能返回 `needs-review` 或 `failed` 的 input-only 保守占位，不得把 mock 文案或通用模板标成可发布成品。任何成功状态也只表示通过当前机器校验，不表示平台审核、法律合规或高转化得到保证。

### 13. 浏览器、本地服务和 Worker 共享同一 Listing 语义

浏览器从同步的 Listing policy 读取平台标签、字段标签、发布字段和内部字段；记录页按平台显示“要点/亮点/标签/搜索词”等真实用途，整段复制默认只包含 `publishFields`，同时保留证据、警告、缺失信息和结构化 JSON 导出。历史 V1 草稿继续使用兼容标签，不因当前表单平台变化而改写。

本地服务从保存的 manifest 读取 set，Cloudflare Worker 从显式 payload 读取 set，但两者都必须调用相同的 source builder、policy resolver、schema builder、prompt builder、normalizer 和 validator。相同规范化 set 与配置必须产生相同的上游请求体、草稿元数据、校验和回退状态；端点不得复制 19 套策略，也不得在运行时抓取规则来源。

## Risks / Trade-offs

- [平台规则会变化] → 每个 profile 和 source 版本化并保存核验日期；历史记录冻结有效计划，更新策略需独立变更与测试。
- [低证据平台默认值可能不准确] → 明确显示 C 级保守建议，不创建硬约束，并保持所有值可覆盖。
- [逐图参数增加 UI 和数据复杂度] → 默认只显示自动摘要与套图快捷控件，逐图高级设置按需展开。
- [生成模型仍可能不遵守主图规则] → 规划器阻止已知输入冲突并显示合规提示，但明确不把生成结果声明为已通过平台审核。
- [平台与类目组合数量很大] → 使用确定性类目补位而不是维护 19 乘以全部四级类目的静态矩阵。
- [脏工作树发生冲突] → 实施前记录当前 diff，只修改本变更需要的函数和测试，不格式化或清理无关文件。
- [本地与 Worker 产生漂移] → 策略和 resolver 使用同一模块，并增加相同 payload 的计划深度相等测试。
- [Listing 官方字段与限制会随站点、类目和后台版本变化] → Listing policy 单独版本化并保存来源与核验日期；只有当前官方依据形成硬规则，其余保持可配置建议。
- [跨类目生成可能虚构或误导] → 所有平台共用事实门控，高风险 claim 不以生成图单独证明，证据不足进入缺失信息或阻断。
- [高转化目标被误解为结果承诺] → UI 和导出明确标识草稿与复核状态，不宣称保证排名、销量、审核、合规或转化。
- [V2 字段破坏历史草稿] → reader 接受 V1 aliases，旧草稿不自动迁移，重写才使用当前 policy。

## Migration Plan

1. 先用失败测试固定平台 profile、解析优先级、逐图参数、切换事务、队列快照和历史兼容行为。
2. 增加策略与 resolver 模块，将当前平台标签和提示词迁移到唯一注册表，同时保留 `universal` fallback。
3. 让 planner 输出新字段，但暂时保持旧 `role`、API 字段和旧记录读取兼容。
4. 更新浏览器自动应用与覆盖交互，再更新本地和 Worker 单图生成参数解析。
5. 扩展队列、manifest、复用和 repair；运行迁移与旧 fixture 回归测试。
6. 最后移除 Listing 平台资格限制，并对 19 个 canonical 平台、旧记录及真实浏览器控件进行验收。
7. 用官方研究和失败测试固定 Listing source register、5 个 archetype、19 个 override、解析顺序、V2 aliases、事实门控和平台 validator。
8. 更新 Listing source、schema、prompt、校验、回退、记录页、复制、导出与同步模块，并验证本地/Worker 请求和结果一致。

回滚时可恢复旧 UI、全局参数提交和 V1 Listing 生成，同时保留新 manifest 的未知可选字段；V2 reader 必须继续读取已有 V1/V2 草稿。不得删除或批量重写已有 Creation manifest 或 Listing 草稿。

## Open Questions

无。跨地区平台第一版使用表中默认语言；地区/站点选择器作为未来独立变更处理，用户当前可通过目标语言覆盖。
