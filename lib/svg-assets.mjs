import { SaxesParser } from "saxes";
import { Resvg } from "@resvg/resvg-js";

const SVG_NS = "http://www.w3.org/2000/svg";
const ELEMENTS = new Set("svg g defs symbol use path rect circle ellipse line polyline polygon text tspan textPath title desc metadata style clipPath mask pattern marker linearGradient radialGradient stop filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence image".split(" "));

// 解析后检查真实节点与解码后的属性，不能用正则冒充 XML 校验。
export function inspectSvg(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  if (!/^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(text)) return null;
  try {
    if (buffer.length > 16 * 1024 * 1024) throw new Error("SVG 过大");
    const parser = new SaxesParser({ xmlns: true });
    let depth = 0;
    let root = false;
    let styleDepth = 0;
    const checkStyle = (value) => {
      if (/[\\@]/.test(value) || /(?:javascript|https?|file|data):/i.test(value) || /url\(\s*['"]?\s*(?!#)[^\s'"]/i.test(value)) throw new Error("SVG 外部样式不可用");
    };
    parser.on("doctype", () => { throw new Error("SVG 不允许 DTD"); });
    parser.on("processinginstruction", () => { throw new Error("SVG 不允许外部处理指令"); });
    parser.on("error", (error) => { throw error; });
    parser.on("opentag", (node) => {
      if ((!node.uri && depth === 0) || node.uri === SVG_NS) {
        if (!ELEMENTS.has(node.local)) throw new Error("SVG 含活动或不支持的元素");
      } else throw new Error("SVG 命名空间无效");
      if (depth++ === 0) {
        if (node.local !== "svg") throw new Error("SVG 根节点无效");
        root = true;
      }
      if (node.local === "style") styleDepth = depth;
      for (const attribute of Object.values(node.attributes)) {
        const name = attribute.local.toLowerCase();
        const value = attribute.value.trim();
        if (name.startsWith("on") || name === "base") throw new Error("SVG 不允许事件或基址");
        if (name === "href" && !value.startsWith("#") && !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) throw new Error("SVG 不允许外部资源");
        if (name === "style" || /url\(/i.test(value)) checkStyle(value);
      }
    });
    parser.on("text", (value) => { if (styleDepth) checkStyle(value); });
    parser.on("cdata", (value) => { if (styleDepth) checkStyle(value); });
    parser.on("closetag", () => { if (styleDepth === depth) styleDepth = 0; depth--; });
    parser.write(text).close();
    if (!root) throw new Error("SVG 缺少根节点");
    const renderer = new Resvg(text, { font: { loadSystemFonts: false } });
    const width = Math.round(renderer.width);
    const height = Math.round(renderer.height);
    if (!(width > 0 && height > 0 && width <= 16384 && height <= 16384)) throw new Error("SVG 尺寸无效");
    return { valid: true, format: "svg", width, height, actualSize: `${width}x${height}`, reason: "" };
  } catch {
    return { valid: false, format: "svg", width: 0, height: 0, actualSize: "", reason: "unsafe-or-malformed-svg" };
  }
}

export function renderSvgPreview(buffer, maxEdge = 512) {
  const inspection = inspectSvg(buffer);
  if (!inspection?.valid) throw new Error("SVG 内容不安全或损坏。");
  return Buffer.from(new Resvg(buffer, {
    fitTo: { mode: inspection.width >= inspection.height ? "width" : "height", value: maxEdge },
  }).render().asPng());
}
