import { createTextModelPreview, fitCreationReadingPanel, formatTextModelTiming } from "./text-model-client.mjs";
import { CREATION_MARKETING_PROGRESS_LABELS as labels, isCreationMarketingProgressActive } from "./creation-marketing-progress.mjs";
import { getCreationPlatformImageType } from "./creation-platform-policies.mjs";

export function createCreationMarketingProgressView({ button, panel, announcement, onItemSelect, onOpen }) {
  if (!button || !panel) return { update() {} };
  const document = panel.ownerDocument;
  if (document.body && panel.parentElement !== document.body) document.body.append(panel);
  panel.tabIndex = -1;
  let current = null;
  let expanded = false;
  let timer = null;
  let lastAnnouncement = "";
  let content = null;
  let live = null;
  let liveDetails = null;
  let signature = "";
  let messageNode = null;
  let infoNode = null;
  let traceNode = null;
  let traceSignature = "";
  const append = (parent, tag, value, className = "") => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    parent.append(node);
    return node;
  };
  const elapsedMs = () => (current?.elapsedMs || 0) + (isCreationMarketingProgressActive(current) ? Math.max(0, Date.now() - current.updatedAt) : 0);
  const updateClock = () => {
    if (!current) { button.textContent = "AI 营销规划"; return; }
    const count = current.total && (current.receivedCount || ["complete", "partial", "reused"].includes(current.stage)) ? ` · ${current.receivedCount || 0}/${current.total}` : "";
    button.textContent = `AI 营销规划 · ${labels[current.stage]}${count} · ${Math.floor(elapsedMs() / 1000)} 秒 ${expanded ? "▴" : "▾"}`;
    if (expanded) live?.update({ ...current, elapsedMs: elapsedMs() });
  };
  const render = () => {
    panel.hidden = !expanded || !current;
    button.setAttribute("aria-expanded", String(expanded && Boolean(current)));
    updateClock();
    if (!current || !expanded) return;
    fitCreationReadingPanel(panel);
    const scrollTop = panel.scrollTop;
    if (!content) {
      panel.replaceChildren();
      const head = append(panel, "div", "", "creation-marketing-panel-head");
      append(head, "h3", "AI 营销规划 · 场景与逐图分工");
      const close = append(head, "button", "收起", "creation-marketing-panel-close");
      close.type = "button"; close.setAttribute("aria-label", "收起 AI 营销规划");
      close.addEventListener("click", () => { expanded = false; render(); button.focus?.(); });
      const details = append(panel, "details", "", "creation-marketing-live"); details.open = true; liveDetails = details;
      append(details, "summary", "实时接收 · 结构化卡片通过完整校验后可用于生图");
      live = createTextModelPreview({ document, panel: details, title: "整套营销规划" });
      traceNode = append(panel, "section", "", "creation-marketing-timing");
      content = append(panel, "div", "", "creation-marketing-content");
    }
    live.update({ ...current, elapsedMs: elapsedMs() });
    const nextTrace = JSON.stringify(current.requestTrace || {});
    if (traceSignature !== nextTrace) {
      traceSignature = nextTrace;
      traceNode.replaceChildren();
      traceNode.hidden = !current.requestTrace?.calls?.length;
      if (!traceNode.hidden) {
        append(traceNode, "h4", "耗时明细");
        const trace = current.requestTrace;
        append(traceNode, "p", formatTextModelTiming({ timing: { prepareMs: trace.prepareMs, validationMs: trace.validationMs, totalMs: trace.totalMs } }), "creation-marketing-caption");
        for (const call of trace.calls) append(traceNode, "p", `${call.repairRound ? `第 ${call.repairRound} 轮修复` : "初稿"} · 第 ${call.attempt} 次请求 · ${call.transport === "buffered" ? "整包返回 · " : ""}${formatTextModelTiming(call) || "等待上游响应"}`, "creation-marketing-caption");
      }
      panel.scrollTop = scrollTop;
    }
    const valid = ["complete", "partial", "reused"].includes(current.stage);
    const info = [];
    if (current.attempt) info.push(`第 ${current.attempt} 次请求`);
    if (current.receivedCharacters) info.push(`已接收 ${current.receivedCharacters.toLocaleString()} 字符`);
    const failed = ["error", "interrupted"].includes(current.stage);
    if (current.total) info.push(`普通营销图 ${current.receivedCount || 0}/${current.total} 条${valid ? " · 已校验" : failed ? " · 未通过校验" : " · 待校验"}`);
    if (valid && current.validation) {
      const { requestedCount, acceptedCount, removedItems = [], missingCount = 0 } = current.validation;
      if (acceptedCount !== requestedCount || removedItems.length) info.push(`可生成 ${acceptedCount} 张 · 已移除 ${removedItems.length} 条${missingCount ? ` · 未返回 ${missingCount} 条` : ""}`);
    }
    const message = current.message || labels[current.stage];
    const caption = info.join(" · ");
    if (messageNode) messageNode.textContent = message;
    if (infoNode) { infoNode.textContent = caption; infoNode.hidden = !caption; }
    const nextSignature = JSON.stringify([current.productName, current.stage, current.attempt, current.summary, current.items, current.validation, current.duplicateRisks, current.suiteStrategy, current.quality]);
    if (signature === nextSignature) return;
    if (valid) liveDetails.open = false;
    signature = nextSignature;
    content.replaceChildren();
    if (current.productName) append(content, "p", `本次商品：${current.productName}`, "creation-marketing-caption");
    messageNode = append(content, "p", message, "creation-marketing-message");
    const history = append(content, "ol", "", "creation-marketing-timeline");
    for (const event of current.history || []) {
      append(history, "li", `${Math.floor(event.elapsedMs / 1000)} 秒 · ${labels[event.stage]}${event.attempt > 1 ? `（第 ${event.attempt} 次请求）` : ""}`);
    }
    infoNode = append(content, "p", caption, "creation-marketing-caption");
    infoNode.hidden = !caption;
    const strategy = current.suiteStrategy || {};
    const buyingReason = strategy.coreBuyingReason || strategy.core_buying_reason;
    if (buyingReason) {
      const section = append(content, "section", "", "creation-marketing-summary-card");
      append(section, "h4", "整套主购买理由");
      append(section, "p", buyingReason);
      for (const proof of strategy.functionalProofs || strategy.functional_proofs || []) {
        append(section, "p", `${proof.buyerBenefit || proof.buyer_benefit}：${proof.visualEvidence || proof.visual_evidence}`, "creation-marketing-caption");
      }
    }
    if (current.quality) {
      const coverage = current.quality.functionalCoverage;
      const status = coverage?.required ? coverage.covered ? "核心功能已有可见表现" : "建议补强核心功能表现" : "按现有外观与用途规划";
      append(content, "p", `${status} · 局部修复 ${current.quality.repairRounds || current.repairRound || 0} 轮`, "creation-marketing-caption");
      if (current.quality.status === "warning" && current.quality.issues?.length) {
        const section = append(content, "section", "", "creation-marketing-summary-card");
        append(section, "h4", "优化建议 · 不影响有效图片生成");
        const rows = append(section, "ul", "");
        for (const issue of current.quality.issues) append(rows, "li", `${issue.sourceIndex ? `第 ${issue.sourceIndex} 张：` : ""}${issue.message}`);
      }
    }
    const summary = current.summary || {};
    const columns = append(content, "div", "", "creation-marketing-summary");
    for (const [key, title] of [["audiences", "目标受众与需求"], ["sellingPoints", "核心卖点"], ["painPoints", "买家痛点"]]) {
      const section = append(columns, "section", "", "creation-marketing-summary-card");
      append(section, "h4", title);
      if (summary[key]?.length) {
        const rows = append(section, "ul", "");
        summary[key].forEach((value) => append(rows, "li", value));
      } else append(section, "p", valid || failed ? "本次结果未提供。" : "等待模型返回完整分析。", "creation-marketing-caption");
    }
    if (current.items?.length) {
      const taskHead = append(content, "div", "", "creation-marketing-items-head");
      append(taskHead, "h4", "逐图营销任务");
      append(taskHead, "span", `${current.items.length} 张${valid ? " · 已校验" : failed ? " · 未通过校验" : " · 待校验"} · 点击定位图片框`, "creation-marketing-caption");
      const rows = append(content, "ol", "", "creation-marketing-items");
      current.items.forEach((item, index) => {
        const row = append(rows, "li", "", "creation-marketing-item-row");
        const task = append(row, "button", "", "creation-marketing-item-button");
        task.type = "button";
        task.setAttribute("aria-label", `定位第 ${item.sourceIndex || index + 1} 张图片框：${item.title}`);
        const type = getCreationPlatformImageType(item.imageType)?.imageTypeLabel || "未识别图型";
        const title = append(task, "span", "", "creation-marketing-item-title");
        append(title, "strong", `${item.sourceIndex || index + 1}. ${item.title}`);
        append(title, "span", type, "creation-marketing-type");
        append(task, "span", item.goal, "creation-marketing-item-goal");
        const brief = item.creativeBrief || {};
        const formLabels = { "product-photograph": "产品摄影", "use-scene": "真实使用场景", "macro-evidence": "微距证据", "functional-render": "功能效果表现", "commercial-cg": "商业 CG 渲染", "information-layout": "信息说明", "contents-layout": "到手清单", "variant-layout": "款式选择" };
        const densityLabels = { none: "无新增文字", minimal: "少量文字", structured: "结构化说明" };
        if (formLabels[brief.visual_form]) append(task, "span", `${formLabels[brief.visual_form]} · ${densityLabels[brief.text_density] || "按任务安排文字"}`, "creation-marketing-caption");
        for (const [key, label] of [["purpose", "用途"], ["scene", "场景"], ["action", "动作"], ["framing", "景别"], ["evidence_focus", "证据"], ["new_information", "新增信息"], ["effect_visual", "可见功能"]]) {
          if (brief[key]) append(task, "span", `${label}：${brief[key]}`, "creation-marketing-caption");
        }
        const risk = current.duplicateRisks?.find((entry) => entry.itemId === item.itemId);
        if (risk) append(task, "span", `与第 ${risk.similarSourceIndex} 张相近：${risk.reason}`, "creation-marketing-duplicate");
        append(task, "span", item.referenceIndexes?.length ? `参考图：${item.referenceIndexes.map((index) => `图 ${index}`).join("、")}` : "依据：本次商品文字资料", "creation-marketing-caption");
        task.addEventListener("click", () => {
          if (onItemSelect?.({ itemId: item.itemId || "", sourceIndex: item.sourceIndex || index + 1, title: item.title || "" }) !== false) {
            expanded = false;
            render();
          }
        });
      });
    }
    if (valid && current.validation) {
      const { requestedCount = 0, returnedCount = 0, removedItems = [] } = current.validation;
      const missingItems = removedItems.filter((item) => Number.isInteger(item?.sourceIndex) && item.sourceIndex >= 1 && item.sourceIndex <= requestedCount);
      const knownIndexes = new Set(missingItems.map((item) => item.sourceIndex));
      for (let sourceIndex = Math.min(requestedCount, returnedCount) + 1; sourceIndex <= requestedCount; sourceIndex += 1) {
        if (!knownIndexes.has(sourceIndex)) missingItems.push({ sourceIndex, title: `第 ${sourceIndex} 张`, reason: "模型未返回本张图片的完整规划。" });
      }
      if (missingItems.length) {
        const missingHead = append(content, "div", "", "creation-marketing-items-head");
        append(missingHead, "h4", "未通过或未返回");
        append(missingHead, "span", `${missingItems.length} 项`, "creation-marketing-caption");
        const missingRows = append(content, "ol", "", "creation-marketing-items");
        missingItems.forEach((item) => {
          const row = append(missingRows, "li", "", "creation-marketing-item-row");
          const task = append(row, "button", "", "creation-marketing-item-button is-marketing-missing");
          task.type = "button";
          task.setAttribute("aria-label", `定位第 ${item.sourceIndex} 张缺失图片框：${item.title || "未通过校验"}`);
          const title = append(task, "span", "", "creation-marketing-item-title");
          append(title, "strong", `${item.sourceIndex}. ${item.title || `第 ${item.sourceIndex} 张`}`);
          append(title, "span", "缺失", "creation-marketing-type");
          append(task, "span", item.reason || "规划校验未通过。", "creation-marketing-item-goal");
          task.addEventListener("click", () => {
            if (onItemSelect?.({ itemId: "", sourceIndex: item.sourceIndex, title: item.title || "缺失项" }) !== false) {
              expanded = false;
              render();
            }
          });
        });
      }
    }
    append(content, "p", valid ? "以上为模型已返回的规划依据摘要。完整提示词可在逐图预览中查看。" : "以上为已接收内容的摘要，完整校验通过后才可用于生图。", "creation-marketing-caption");
    panel.scrollTop = scrollTop;
  };
  button.addEventListener("click", () => {
    if (!current) return;
    expanded = !expanded;
    if (expanded) {
      onOpen?.();
      panel.focus?.({ preventScroll: true });
    }
    render();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    expanded = false;
    render();
    button.focus?.();
  });
  return {
    close() { expanded = false; render(); },
    update(progress) {
      const changed = current !== progress;
      current = progress;
      if (!current) expanded = false;
      button.hidden = false;
      button.disabled = !current;
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (isCreationMarketingProgressActive(current)) timer = setInterval(updateClock, 1000);
      const nextAnnouncement = current ? `${current.stage}:${current.attempt}:${current.message}` : "";
      if (announcement && nextAnnouncement !== lastAnnouncement) {
        announcement.textContent = current ? `AI 营销规划：${labels[current.stage]}。${current.message || ""}` : "";
        lastAnnouncement = nextAnnouncement;
      }
      if (changed || !current) render();
      else updateClock();
    },
  };
}
