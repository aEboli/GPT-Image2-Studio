/* 全局「禁用控件被点击」反馈：给控件本身加一次横向抖动的样式类。
   关键约束（已在 Chromium 实测）：原生 disabled 控件只会派发 pointerdown，
   click/mousedown 一个都不派发；而带 pointer-events: none 的禁用控件连 pointerdown
   都收不到，事件会改指向祖先，document.elementFromPoint() 也查不到它。
   因此这里在捕获阶段监听 pointerdown，先用 closest() 命中，再退回矩形命中测试。 */

export const DISABLED_SHAKE_CLASS = "is-disabled-shaking";
export const DISABLED_SHAKE_DURATION_MS = 200;

/* 需要抖动的禁用控件：原生 disabled、aria-disabled 与本仓库在用的 disabled 类名。
   只覆盖控件本身，不覆盖 fieldset / 滚动条这类容器（disabled fieldset 里的按钮
   自身就命中 button:disabled，closest() 会先拿到按钮）。 */
export const DISABLED_SHAKE_TARGET_SELECTOR = [
  "button:disabled",
  "input:disabled",
  "select:disabled",
  "textarea:disabled",
  'button[aria-disabled="true"]',
  'a[aria-disabled="true"]',
  '[role="button"][aria-disabled="true"]',
  "button.disabled",
  "a.disabled",
  ".toolbar-button.disabled",
  ".inline-button.disabled",
  ".mini-action.is-disabled",
].join(", ");

/* 这些禁用规则在 public/styles.css 里设了 pointer-events: none，控件收不到任何事件，
   只能靠矩形命中测试找回来；改动那些规则时要同步这里。 */
export const DISABLED_SHAKE_HIT_TEST_SELECTOR = [
  ".toolbar-button:disabled",
  ".toolbar-button.disabled",
  ".product-image-import-zoom-button:disabled",
  ".creation-record-card-actions .mini-action.is-disabled",
].join(", ");

function findByHitTest(root, clientX, clientY, hitTestSelector) {
  if (typeof root?.querySelectorAll !== "function") {
    return null;
  }
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  let hit = null;
  let hitArea = Infinity;
  for (const node of root.querySelectorAll(hitTestSelector)) {
    const rect = node.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
      continue;
    }
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      continue;
    }
    const area = rect.width * rect.height;
    if (area < hitArea) {
      hit = node;
      hitArea = area;
    }
  }
  return hit;
}

export function resolveDisabledShakeTarget(event, {
  targetSelector = DISABLED_SHAKE_TARGET_SELECTOR,
  hitTestSelector = DISABLED_SHAKE_HIT_TEST_SELECTOR,
} = {}) {
  const origin = event?.target;
  if (typeof origin?.closest !== "function") {
    return null;
  }
  return origin.closest(targetSelector)
    || findByHitTest(origin, event?.clientX, event?.clientY, hitTestSelector);
}

export function createDisabledShakeController({
  documentRoot = globalThis.document,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  shakeClass = DISABLED_SHAKE_CLASS,
  shakeDurationMs = DISABLED_SHAKE_DURATION_MS,
  targetSelector = DISABLED_SHAKE_TARGET_SELECTOR,
  hitTestSelector = DISABLED_SHAKE_HIT_TEST_SELECTOR,
} = {}) {
  const pendingByNode = new Map();
  let bound = false;

  function clearShake(node) {
    const timerId = pendingByNode.get(node);
    if (timerId !== undefined) {
      clearTimeoutFn(timerId);
      pendingByNode.delete(node);
    }
    node?.classList?.remove(shakeClass);
  }

  function shake(node) {
    if (!node?.classList) {
      return;
    }
    /* 连点要能重放：先摘类并强制一次样式重算，否则同一帧内重新加类不会重启动画。 */
    clearShake(node);
    void node.offsetWidth;
    node.classList.add(shakeClass);
    pendingByNode.set(node, setTimeoutFn(() => {
      pendingByNode.delete(node);
      node.classList?.remove(shakeClass);
    }, shakeDurationMs));
  }

  function handlePointerDown(event) {
    if (event?.button !== undefined && event.button !== 0) {
      return;
    }
    const target = resolveDisabledShakeTarget(event, { targetSelector, hitTestSelector });
    if (target) {
      shake(target);
    }
  }

  function bind() {
    if (bound || typeof documentRoot?.addEventListener !== "function") {
      return;
    }
    bound = true;
    documentRoot.addEventListener("pointerdown", handlePointerDown, true);
  }

  function destroy() {
    if (bound) {
      documentRoot.removeEventListener("pointerdown", handlePointerDown, true);
    }
    bound = false;
    for (const node of [...pendingByNode.keys()]) {
      clearShake(node);
    }
  }

  return { bind, destroy, shake };
}
