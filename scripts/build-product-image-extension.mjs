import { writeProductImageCollectorArtifacts } from "../lib/product-image-extension-package.mjs";

const result = await writeProductImageCollectorArtifacts();
console.log(`商品图采集插件 ZIP：${result.archivePath}`);
console.log(`可加载的解压目录：${result.unpackedDir}`);
