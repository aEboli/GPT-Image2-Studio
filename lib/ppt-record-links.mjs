export function createPptDownloadLink({ url, filename, label, className = "toolbar-button" }) {
  const link = document.createElement("a");
  Object.assign(link, {
    className,
    href: url || "#",
    download: filename || "",
    textContent: label,
  });
  if (!url) {
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
  return link;
}

export function appendPptDeckDownloadLinks(actions, deck) {
  actions.appendChild(createPptDownloadLink({
    url: deck.pptxUrl,
    filename: deck.pptxFilename,
    label: "下载 PPTX",
  }));
  if (deck.editablePptxUrl) {
    actions.appendChild(createPptDownloadLink({
      url: deck.editablePptxUrl,
      filename: deck.editablePptxFilename,
      label: "可编辑 PPTX",
      className: "toolbar-button ppt-editable-download-link",
    }));
  }
}
