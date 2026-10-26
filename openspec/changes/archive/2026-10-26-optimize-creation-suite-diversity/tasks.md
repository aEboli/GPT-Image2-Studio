## 1. 槽位去重

- [x] 1.1 `lib/creation-platform-resolver.mjs` 的 `replaceWithRecommendation` 在替换前按目标 imageType 的 `role` 判重，已存在同角色槽位时跳过叠加。
- [x] 1.2 新增回归测试：1578 个类目模板 × 18 槽，断言无重复角色、无逐字节相同提示词（`test/creation-suite-diversity.test.mjs`）。
- [x] 1.3 新增回归测试：服饰类目保留 `multi-angle` 且 `size-capacity-fit` 只出现一次。
- [x] 1.4 更新 `test/creation-platform-resolver.test.mjs` 中锁定"服饰必须用 scale-proof 顶掉 multi-angle"的旧断言，并补上角色唯一性断言。
- [x] 1.5 全量扫描确认重复图从 178 个类目降到 0。

## 2. 画布宣称护栏

- [x] 2.1 新增 `lib/creation-canvas-claim-guard.mjs`：五组宣称规则、品类词后缀放行、`stripCreationCanvasClaims` / `detectCreationCanvasClaims`。
- [x] 2.2 `buildCreationPlan` 入口拆分"可画事实"与"不可画宣称"，计划结果暴露 `canvasClaims` 并追加 `canvas-claim-removed` 警告。
- [x] 2.3 `Hero coverage` 与 `Function coverage` 由"每一项都出现"改为"从这些已提供事实构建"。
- [x] 2.4 有文字槽位追加 `CANVAS CLAIM POLICY`；严格主图（`textPolicy: none`）不追加。
- [x] 2.5 修正 `compactCreationPositiveInstruction` 中反向注入违禁词的四条改写。
- [x] 2.6 修正类目模板中 11 处把"安全/合规"当卖点的措辞。
- [x] 2.7 新增回归测试（`test/creation-canvas-claim-guard.test.mjs`）：剔除/保留对照、品类词不误杀、整套图零命中、商品名保留。

## 3. 画面形式变体

- [x] 3.1 `CREATION_ROLE_VISUAL_DIRECTIONS` 扩展为 `CREATION_ROLE_VISUAL_DIRECTION_VARIANTS`，21 个角色各 3 个变体，v0 与原文本一致。
- [x] 3.2 变体只改镜头/景别/光线/瞬间，保持各角色 cast 不变，避免 5 个真人角色年龄段碰撞。
- [x] 3.3 引入 `hashCreationVariantSeed` 与 `roleOrdinalByIndex`，按商品事实哈希选版，同一商品结果稳定。
- [x] 3.4 回归测试：同一套图内画面形式互不相同；不同商品的画面形式清单不同；同一商品重复构建结果一致。

## 4. 保底图片任务

- [x] 4.1 在 `lib/creation-platform-resolver.mjs` 定义 `CREATION_GUARANTEED_CAROUSEL_ROLES`（首图 / 尺寸 / 信息图 / 细节 / 场景 / 多角度）。
- [x] 4.2 `applySetOverrides` 裁剪张数时优先保留保底角色，再按原顺序补齐；张数少于 6 时退回原顺序。
- [x] 4.3 回归测试：5 种类目配置下 18 槽均包含全部六个保底任务。

## 5. 类目真人角色预算

- [x] 5.1 新增 `CREATION_PERSON_ROLE_BUDGET_BY_PREFIX` / `_BY_TEMPLATE`，默认值 5（不收敛）。
- [x] 5.2 `applyCreationPersonRoleBudget` 按弱到强依次移除 `human-wearable` → `atmosphere` → `human-handheld` → `after-sales` → `benefit`，仅用品类证明类图型替换且目标角色不重复。
- [x] 5.3 仅对通用电商平台生效，命名平台沿用画像自带槽位。
- [x] 5.4 回归测试：服饰/美妆/母婴保持 5，数码/家居/办公为 3，工业为 2，通用电商为 5。

## 6. 平台画像收敛

- [x] 6.1 `lib/creation-platform-policies.mjs` 的 `PROFILE_DEFINITIONS` 从 19 项裁剪到 `universal` + `temu`。
- [x] 6.2 来源注册表按引用关系裁剪到 6 条（2 条在用 + 4 条被历史图型引用的官方来源），悬空引用为 0。
- [x] 6.3 移除 `getMarketingContext` 中已删平台的分支，移除规划器里 `xiaohongshu` 专属 prompt 分支。
- [x] 6.4 保留 `amazon-main` / `taobao-white-main` / `transparent-cutout` / `tiktok-shop-main` / `walmart-main` 五个图型作为历史冻结计划的兼容层。
- [x] 6.5 更新 `README.zh-CN.md` 的平台表与能力描述。
- [x] 6.6 迁移受影响测试：删除 4 个只对已删平台成立的用例，其余改锚点到 `temu` / `universal`，保留断言强度。

## 7. 验证

- [x] 7.1 全量扫描：1578 个类目 × 18 槽无重复角色、无相同提示词。
- [x] 7.2 相似度对照：去样板后平均 0.299 → 0.293，最差配对 0.773 → 0.685。
- [x] 7.3 宣称实测：母婴 8/18 → 0，智能手环 14/18 → 0，儿童保温杯 8/18 → 0；商品名含"美白"的场景保留品名并由画布策略约束。
- [x] 7.4 品类词放行实测：`安全帽`、`安全座椅`、`医用口罩`、`100%棉` 不被误删。
- [x] 7.5 `node scripts/sync-public-lib.mjs` 同步 `public/lib` 镜像并通过 `public-lib-sync` 测试。
- [x] 7.6 串行全量测试：2546 项全部通过。

## 8. 文档与校验

- [x] 8.1 新增 OpenSpec 提案、设计与任务清单，并写 `creation-mode` 增量规范。
- [x] 8.2 `npx openspec validate optimize-creation-suite-diversity --strict --no-interactive` 通过。
- [x] 8.3 确认新增中文文本无乱码，`git diff --check` 无空白错误。
