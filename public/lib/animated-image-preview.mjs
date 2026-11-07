export function createAnimatedImagePreview({ image, controls }) {
  if (!image || !controls) return { render() {} };
  const button = document.createElement("button");
  button.type = "button";
  button.className = "toolbar-button";
  button.hidden = true;
  button.textContent = "暂停动画";
  controls.append(button);
  let source = "";
  let still = "";
  button.addEventListener("click", () => {
    if (still) {
      still = "";
      image.src = source;
      button.textContent = "暂停动画";
      button.setAttribute("aria-pressed", "false");
    } else if (image.complete && image.naturalWidth && image.naturalHeight) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        still = canvas.toDataURL("image/png");
        image.src = still;
        button.textContent = "播放动画";
        button.setAttribute("aria-pressed", "true");
      } catch { button.title = "暂时无法暂停此图片，仍可下载原始 GIF。"; }
    }
  });
  return {
    render(item, url) {
      const gif = item?.format === "gif" || /^data:image\/gif[;,]/i.test(url || "") || /\.gif(?:[?#]|$)/i.test(url || "");
      button.hidden = !gif;
      if (source !== url || !gif) {
        source = url;
        still = "";
        button.textContent = "暂停动画";
        button.setAttribute("aria-pressed", "false");
      }
      if (still && image.src !== still) image.src = still;
    },
  };
}
