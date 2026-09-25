# Design

## Official snapshot

导入脚本读取 `https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/README_zh.md`。每个 `No.` 条目解析为一条 canonical 记录：标题、代码块中的完整提示词、第一张 CMS 图片、YouMind 详情页 ID、官网场景前缀和 CC BY 4.0 归属都写入同一对象。首图通过 `images.weserv.nl` 下载为 640px 本地 JPEG，浏览器继续使用本地路径。

## Taxonomy selection

使用场景优先采用 README 中由官方分类前缀生成的 7 个场景；其余场景、风格和主体按条目的标题与完整提示词关键词评分。每个二级分类按分数和官方 README 顺序稳定选择 20 个不同的 canonical ID。分类之间允许复用同一 canonical 记录，但不会复制或改写它的图片和提示词。

## Runtime boundary

模板库只读取已经打包的 `YOUMIND_PROFILE_ENTRIES` 和本地图片；网站、CMS 和图片代理只在维护者重新运行导入脚本时访问。任何来源不完整的条目都会使导入失败，而不是填入占位内容。
