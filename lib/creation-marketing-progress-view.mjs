import { CREATION_MARKETING_PROGRESS_LABELS as labels, isCreationMarketingProgressActive } from "./creation-marketing-progress.mjs";
import { getCreationPlatformImageType } from "./creation-platform-policies.mjs";

export function createCreationMarketingProgressView({ button, panel, announcement }) {
  if (!button || !panel) return { update() {} };
  const document = panel.ownerDocument;
  let current = null;
  let expanded = false;
  let timer = null;
  let lastAnnouncement = "";
  const append = (parent, tag, value, className = "") => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    parent.append(node);
    return node;
  };
  const seconds = () => Math.floor(((current?.elapsedMs || 0) + (isCreationMarketingProgressActive(current) ? Math.max(0, Date.now() - current.updatedAt) : 0)) / 1000);
  const updateClock = () => {
    if (!current) return;
    const count = current.total && (current.receivedCount || ["complete", "reused"].includes(current.stage)) ? ` · ${current.receivedCount || 0}/${current.total}` : "";
    button.textContent = `AI 营销规划 · ${labels[current.stage]}${count} · ${seconds()} 秒 ${expanded ? "▴" : "▾"}`;
  };
  const render = () => {
    panel.hidden = !expanded || !current;
    button.setAttribute("aria-expanded", String(expanded && Boolean(current)));
    updateClock();
    if (!current || !expanded) return;
    const scrollTop = panel.scrollTop;
    panel.replaceChildren();
    append(panel, "h3", "AI 营销规划过程");
    if (current.productName) append(panel, "p", `本次商品：${current.productName}`, "creation-marketing-caption");
    append(panel, "p", current.message || labels[current.stage], "creation-marketing-message");
    const history = append(panel, "ol", "", "creation-marketing-timeline");
    for (const event of current.history || []) {
      append(history, "li", `${Math.floor(event.elapsedMs / 1000)} 秒 · ${labels[event.stage]}${event.attempt > 1 ? `（第 ${event.attempt} 次请求）` : ""}`);
    }
    const valid = ["complete", "reused"].includes(current.stage);
    const info = [];
    if (current.attempt) info.push(`第 ${current.attempt} 次请求`);
    if (current.receivedCharacters) info.push(`已接收 ${current.receivedCharacters.toLocaleString()} 字符`);
    const failed = ["error", "interrupted"].includes(current.stage);
    if (current.total) info.push(`普通营销图 ${current.receivedCount || 0}/${current.total} 条${valid ? " · 已校验" : failed ? " · 未通过校验" : " · 待校验"}`);
    if (info.length) append(panel, "p", info.join(" · "), "creation-marketing-caption");
    const summary = current.summary || {};
    const columns = append(panel, "div", "", "creation-marketing-summary");
    for (const [key, title] of [["audiences", "目标受众与需求"], ["sellingPoints", "核心卖点"], ["painPoints", "买家痛点"]]) {
      const section = append(columns, "section", "");
      append(section, "h4", title);
      if (summary[key]?.length) {
        const rows = append(section, "ul", "");
        summary[key].forEach((value) => append(rows, "li", value));
      } else append(section, "p", valid || failed ? "本次结果未提供。" : "等待模型返回完整分析。", "creation-marketing-caption");
    }
    if (current.items?.length) {
      append(panel, "h4", `逐图营销任务${valid ? "" : failed ? "（未通过校验）" : "（已接收，待校验）"}`);
      const rows = append(panel, "ol", "", "creation-marketing-items");
      current.items.forEach((item) => {
        const row = append(rows, "li", "");
        const type = getCreationPlatformImageType(item.imageType)?.imageTypeLabel;
        append(row, "strong", `${item.title}${type ? ` · ${type}` : ""}`);
        append(row, "p", item.goal);
        append(row, "span", item.referenceIndexes?.length ? `参考图：${item.referenceIndexes.map((index) => `图 ${index}`).join("、")}` : "依据：本次商品文字资料", "creation-marketing-caption");
      });
    }
    append(panel, "p", valid ? "以上为模型已返回的规划依据摘要。完整提示词可在逐图预览中查看。" : "以上为已接收内容的摘要，完整校验通过后才可用于生图。", "creation-marketing-caption");
    panel.scrollTop = scrollTop;
  };
  button.addEventListener("click", () => { expanded = !expanded; render(); });
  return {
    update(progress) {
      const changed = current !== progress;
      current = progress;
      button.hidden = !current;
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (isCreationMarketingProgressActive(current)) timer = setInterval(updateClock, 1000);
      const nextAnnouncement = current ? `${current.stage}:${current.attempt}:${current.message}` : "";
      if (announcement && nextAnnouncement !== lastAnnouncement) {
        announcement.textContent = current ? `AI 营销规划：${labels[current.stage]}。${current.message || ""}` : "";
        lastAnnouncement = nextAnnouncement;
      }
      if (changed) render();
      else updateClock();
    },
  };
}
