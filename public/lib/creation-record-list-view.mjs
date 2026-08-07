import {
  getCreationRecordListTimestamp,
  getCreationRecordTemuExportStatus,
} from "./creation-record-list-model.mjs";

function cleanString(value) {
  return String(value ?? "").trim();
}

export function createCreationRecordListRow({
  set,
  selectedSetId = "",
  checked = false,
  checkboxDisabled = false,
  getProgressSummary,
  getListingLabel,
  formatPlatformLabel,
  formatTime,
  documentRef = document,
} = {}) {
  const productName = cleanString(set?.productName) || "未命名商品";
  const setId = cleanString(set?.setId);
  const progress = getProgressSummary?.(set) || { completed: 0, total: 0, failed: 0 };
  const listingLabel = cleanString(getListingLabel?.(set));
  const row = documentRef.createElement("div");
  row.className = "creation-record-list-item";
  row.setAttribute("role", "listitem");
  row.classList.toggle("is-checked", checked);

  const selectLabel = documentRef.createElement("label");
  selectLabel.className = "creation-record-select";
  selectLabel.title = `选择 ${productName}`;
  const checkbox = documentRef.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.disabled = checkboxDisabled;
  checkbox.dataset.creationRecordSelectSetId = setId;
  checkbox.setAttribute("aria-label", `选择套图 ${productName}`);
  selectLabel.appendChild(checkbox);

  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "creation-record";
  button.dataset.creationRecordSetId = setId;
  button.classList.toggle("active", setId === selectedSetId);
  button.setAttribute("aria-label", `查看 ${productName} 的套图内容`);
  if (setId === selectedSetId) button.setAttribute("aria-current", "true");

  const titleRow = documentRef.createElement("span");
  titleRow.className = "creation-record-title-row";
  const title = documentRef.createElement("strong");
  title.className = "creation-record-title";
  title.textContent = productName;
  titleRow.appendChild(title);

  const metaRow = documentRef.createElement("span");
  metaRow.className = "creation-record-meta-row";
  const meta = documentRef.createElement("span");
  meta.className = "creation-record-meta";
  const platformLabel = cleanString(set?.platformLabel) || cleanString(formatPlatformLabel?.(set?.platform));
  const metaParts = [platformLabel, `${Number(progress.completed) || 0}/${Number(progress.total) || 0}`].filter(Boolean);
  const recordTimeText = cleanString(formatTime?.(getCreationRecordListTimestamp(set)));
  meta.textContent = metaParts.join(" · ");
  if (recordTimeText) {
    const recordTime = documentRef.createElement("span");
    recordTime.className = "creation-record-time";
    recordTime.textContent = recordTimeText;
    meta.append(metaParts.length ? " · " : "", recordTime);
  }
  metaRow.appendChild(meta);

  const statusRow = documentRef.createElement("span");
  statusRow.className = "creation-record-status-row";
  const status = documentRef.createElement("span");
  status.className = "asset-record-status";
  status.dataset.state = progress.failed > 0
    ? "failed"
    : progress.completed >= progress.total && progress.total > 0
      ? "completed"
      : "running";
  status.textContent = progress.failed > 0
    ? `${progress.failed} 项失败`
    : progress.completed >= progress.total && progress.total > 0
      ? "已完成"
      : "生成中";
  statusRow.appendChild(status);

  if (listingLabel) {
    const listingBadge = documentRef.createElement("span");
    listingBadge.className = "creation-record-listing-badge";
    listingBadge.textContent = listingLabel;
    statusRow.appendChild(listingBadge);
  }

  const exportStatus = getCreationRecordTemuExportStatus(set);
  const exportBadge = documentRef.createElement("span");
  exportBadge.className = "creation-record-temu-status";
  exportBadge.dataset.tone = exportStatus.tone;
  exportBadge.textContent = exportStatus.label;
  statusRow.appendChild(exportBadge);

  button.append(titleRow, metaRow, statusRow);
  row.append(selectLabel, button);
  return row;
}
