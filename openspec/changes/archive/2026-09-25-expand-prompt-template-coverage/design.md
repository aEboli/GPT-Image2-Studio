# Design

## Canonical records

`YOUMIND_PROFILE_ENTRIES` 继续作为唯一图片与提示词来源。每条记录保持一个 ID、一个本地预览路径、一个完整提示词和原有署名信息。

## Stable category selection

目录构建时先选择与当前维度有明确标签的来源记录，再按二级分类 ID 的稳定哈希轮转剩余来源，截取 20 条不同记录。这样每个二级分类都达到覆盖要求，同时每张图仍对应其原始提示词。

## Reuse rules

同一 canonical ID 可以在多个二级分类中出现。单个分类筛选结果和全量去重结果都按 ID 去重；资源路径只有在对应同一个 ID 和提示词时才允许复用。
