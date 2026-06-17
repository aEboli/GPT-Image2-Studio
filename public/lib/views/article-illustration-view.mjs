import { createViewRendererController } from "./view-renderer.mjs";

export function mountView(options = {}) {
  return createViewRendererController({
    ...options,
    view: options.view || "article-illustration",
    rendererKey: "articleIllustration",
  });
}
