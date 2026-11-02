// 从首个事件开始计时，持续收到事件也不会无限推迟显示。
export function createDeferredUpdate(callback, {
  delayMs = 120,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  let timer = null;
  const cancel = () => {
    if (timer === null) return;
    clearTimeoutFn(timer);
    timer = null;
  };
  const flush = () => {
    if (timer === null) return false;
    cancel();
    callback();
    return true;
  };
  return {
    schedule() {
      if (timer === null) timer = setTimeoutFn(flush, delayMs);
    },
    flush,
    cancel,
  };
}
