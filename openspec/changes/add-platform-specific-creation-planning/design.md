## Context

套图模式当前已经有 19 个平台选项，但 `CREATION_PLATFORM_OPTIONS` 只为每个平台保存标签和一段自由文本提示词。规划器仍按同一套角色顺序切片，浏览器仍提交整套共用的比例与分辨率，本地服务和 Cloudflare Worker 也在生成循环外只解析一次这些参数。现有通用 `hero` 还要求营销承诺和场景小圆框，这与 Amazon、TikTok Shop、Walmart 等平台的无文字白底主图要求冲突。

当前工作树包含用户尚未提交的平台选择、参考图分析上下文、manifest 字段和相关测试改动。本设计必须在这些改动上增量实施，不覆盖、清理或重写无关内容。

平台规则来自 2026-07-11 前核验的官方规则和真实页面观察。Amazon、TikTok Shop、Walmart、Etsy、eBay、Shopify、Shopee、淘宝等平台有较强官方依据；京东、小红书和 Temu 有部分官方或真实页面证据；拼多多、抖音、Lazada、AliExpress、Rakuten、Coupang、Mercado Libre 的公开细则不完整，因此只能提供保守默认值，不能伪装成官方硬规则。

## Goals / Non-Goals

**Goals:**

- 让不同平台得到真正不同的默认图片类型、顺序、张数、逐图比例、分辨率、语言、构图、文字密度和场景策略。
- 让平台原生图片类型成为计划项的一等字段，同时保留现有角色 ID 以兼容历史记录、参考图覆盖和现有提示词分配逻辑。
- 让用户可以覆盖所有自动值，并能清楚区分平台自动值、用户覆盖和官方硬规则。
- 让本地服务和 Cloudflare Worker 共享同一策略解析结果，并让每张图使用自己的生成参数。
- 让队列、保存、复用、补图和修复冻结当时的有效计划，不因未来策略更新发生漂移。
- 以来源、核验日期和证据等级管理平台规则；只有有明确官方来源的规则才能成为阻断性约束。

**Non-Goals:**

- 运行时抓取、登录或自动更新第三方平台规则。
- 自动发布图片或 Listing 到第三方平台。
- 扩展非 Amazon Listing 文案生成。
- 使用视觉模型对最终生成图片做自动合规认证；平台约束仍需用户最终审核。
- 建立平台乘以所有四级类目的完整静态笛卡尔矩阵。

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

新 manifest 保存 `strategyVersion`、`platformPolicyId`、`platformEvidenceLevel`、`platformProvenance`、四类计数字段、套图覆盖和每个 item 的图片类型、逐图参数、Logo 策略、约束与警告。新提交的 manifest 使用 `platformProvenance=explicit`。reader 必须在填充 `universal` fallback 前检查原始 manifest 是否真正拥有 platform 字段；缺失时保存内存态 `platformProvenance=legacy-missing`，从而区分“用户明确选择通用电商”和“旧记录没有平台概念”。不得仅依赖已归一化后的 `platform=universal` 判断 Listing 资格。队列在提交时冻结完整 plan，而不是等任务开始时重新读取表单。

旧 manifest 缺少新字段时继续按已保存的 `role`、prompt 和图片记录显示与修复，不自动应用当前 profile。用户只有点击“按当前平台重新规划”才会基于最新 `strategyVersion` 生成新计划。历史复用仍清除无法恢复的浏览器 `File` 对象，并保持现有参考图重新绑定流程。

### 10. Listing 能力保持 Amazon US 边界

当所选平台不是 Amazon 时，创建页和记录页的 Listing Agent 操作均禁用并显示“当前仅支持 Amazon US”。已有 Amazon Listing 草稿仍可查看和导出；切换到非 Amazon 平台不会删除历史草稿，也不会自动把它改写成其他平台文案。

## Risks / Trade-offs

- [平台规则会变化] → 每个 profile 和 source 版本化并保存核验日期；历史记录冻结有效计划，更新策略需独立变更与测试。
- [低证据平台默认值可能不准确] → 明确显示 C 级保守建议，不创建硬约束，并保持所有值可覆盖。
- [逐图参数增加 UI 和数据复杂度] → 默认只显示自动摘要与套图快捷控件，逐图高级设置按需展开。
- [生成模型仍可能不遵守主图规则] → 规划器阻止已知输入冲突并显示合规提示，但明确不把生成结果声明为已通过平台审核。
- [平台与类目组合数量很大] → 使用确定性类目补位而不是维护 19 乘以全部四级类目的静态矩阵。
- [脏工作树发生冲突] → 实施前记录当前 diff，只修改本变更需要的函数和测试，不格式化或清理无关文件。
- [本地与 Worker 产生漂移] → 策略和 resolver 使用同一模块，并增加相同 payload 的计划深度相等测试。

## Migration Plan

1. 先用失败测试固定平台 profile、解析优先级、逐图参数、切换事务、队列快照和历史兼容行为。
2. 增加策略与 resolver 模块，将当前平台标签和提示词迁移到唯一注册表，同时保留 `universal` fallback。
3. 让 planner 输出新字段，但暂时保持旧 `role`、API 字段和旧记录读取兼容。
4. 更新浏览器自动应用与覆盖交互，再更新本地和 Worker 单图生成参数解析。
5. 扩展队列、manifest、复用和 repair；运行迁移与旧 fixture 回归测试。
6. 最后启用非 Amazon Listing 限制并进行真实浏览器验收。

回滚时可恢复旧 UI 和全局参数提交，同时保留新 manifest 的未知可选字段；旧 reader 会忽略这些字段。不得删除或批量重写已有 Creation manifest。

## Open Questions

无。跨地区平台第一版使用表中默认语言；地区/站点选择器作为未来独立变更处理，用户当前可通过目标语言覆盖。
