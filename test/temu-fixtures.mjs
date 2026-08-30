import { createDefaultDraft, generateSkuMatrix } from "../lib/temu/domain.mjs";

export function createValidDraft() {
  const draft = createDefaultDraft();
  Object.assign(draft.product, {
    title: "便携收纳盒",
    englishTitle: "Portable Storage Box",
    description: "桌面小物分类收纳盒。",
    productCode: "BOX-001",
    declaredPrice: "12.50",
    length: "20",
    width: "15",
    height: "8",
    weight: "380",
    suggestedPrice: "19.99",
    inventory: "50",
    leadTime: "2",
    origin: "中国-浙江省",
    sourceUrls: ["https://detail.1688.com/offer/123456.html"],
  });
  draft.variants = {
    name1: "颜色",
    values1: ["白色", "绿色"],
    name2: "被套尺码",
    values2: ["小号", "大号"],
  };
  draft.assets.carousel = [
    {
      id: "carousel-1",
      name: "carousel-1.jpg",
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      width: 1200,
      height: 1200,
      status: "verified",
    },
  ];
  draft.skus = generateSkuMatrix(draft).map((sku, index) => ({
    ...sku,
    skuCode: `BOX-001-${index + 1}`,
    image: {
      id: `sku-image-${index}`,
      name: `sku-image-${index}.jpg`,
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      width: 1200,
      height: 1200,
      status: "verified",
    },
  }));
  return draft;
}
