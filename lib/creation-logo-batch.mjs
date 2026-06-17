import { normalizeCreationLogoOptions } from "./creation-planner.mjs";

export const CREATION_LOGO_BATCH_REFERENCE_LABELS = Object.freeze([
  "Reference image 1: SOURCE image. Preserve this image's content, composition, aspect ratio, colors, product details, people, background, and existing readable text as much as possible.",
  "Reference image 2: LOGO image. Use this exact supplied logo as the only new brand mark to place on the source image.",
]);

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeSourceImages(sourceImages = []) {
  return (Array.isArray(sourceImages) ? sourceImages : [])
    .map((image, index) => ({
      ...image,
      filename: cleanString(image?.filename || image?.name || `source-image-${index + 1}`),
    }))
    .filter((image) => image.filename);
}

function buildCreationLogoBatchPrompt({ sourceFilename, logoOptions }) {
  const logo = normalizeCreationLogoOptions(logoOptions);
  return [
    "Edit the uploaded source image by adding the supplied logo.",
    `Source image: ${sourceFilename}. Reference image 1 is the source image.`,
    `Logo reference image: ${logo.filename}. Reference image 2 is the logo.`,
    "Preserve the source image content, composition, crop, perspective, lighting, colors, background, product details, people, and existing readable text as much as possible.",
    `Place this supplied logo at the ${logo.promptPosition} (${logo.placement}) with clean safe margins.`,
    logo.backgroundInstruction,
    "Keep the logo legible and proportional; do not invent extra brand logos, watermarks, slogans, products, UI, badges, or unrelated text.",
    "Return one finished image that looks like the original uploaded image with only the requested logo placement added.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildCreationLogoBatchPlan({ title = "", sourceImages = [], logoOptions = {} } = {}) {
  const images = normalizeSourceImages(sourceImages);
  if (images.length === 0) {
    throw new Error("Logo batch requires at least one uploaded source image.");
  }

  const logo = normalizeCreationLogoOptions(logoOptions);
  if (!logo.enabled) {
    throw new Error("Logo batch requires one logo image.");
  }

  const productName = cleanString(title) || "Uploaded images logo batch";
  return {
    productName,
    productDescription: "Add the supplied logo to uploaded source images.",
    sellingPoints: [],
    dimensionSpecs: "",
    dimensionUnitMode: "both",
    dimensionUnitModeLabel: "公制和英制",
    targetLanguage: "en",
    targetLanguageLabel: "English",
    imageCount: images.length,
    scenario: "logo-batch",
    scenarioLabel: "上传图加 Logo",
    industryTemplate: "general",
    industryTemplateLabel: "通用电商",
    industryTemplatePath: "",
    selectedRoles: ["logo-batch"],
    referenceImageNames: images.map((image) => image.filename),
    referenceImageRoles: images.map((image) => ({
      filename: image.filename,
      role: "product",
      roleLabel: "商品主体",
      note: "Logo batch source image",
    })),
    logo,
    items: images.map((image, index) => ({
      itemId: `${index + 1}-logo-batch`,
      slotIndex: index + 1,
      role: "logo-batch",
      title: `加 Logo ${index + 1}`,
      filenameToken: `加Logo-${index + 1}`,
      sourceImageIndex: index,
      sourceImageName: image.filename,
      marketingCopyLanguage: "en",
      marketingCopy: "",
      prompt: buildCreationLogoBatchPrompt({
        sourceFilename: image.filename,
        logoOptions: logo,
      }),
    })),
  };
}
