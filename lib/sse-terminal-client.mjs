export async function consumeSseUntilTerminal({
  stream,
  consumeSse,
  onEvent,
  terminalEvents = ["complete", "error"],
  missingTerminalMessage = "连接已中断，未收到完成事件。",
} = {}) {
  let terminalEventName = "";
  await consumeSse(stream, async (eventName, payload) => {
    if (terminalEvents.includes(eventName)) terminalEventName = eventName;
    await onEvent(eventName, payload);
  });
  if (!terminalEventName) throw new Error(missingTerminalMessage);
  return terminalEventName;
}
