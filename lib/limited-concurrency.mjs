const MAX_CONCURRENT_WORKERS = 15;
const WORKER_START_DELAY_MS = 250;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function runWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  const requestedWorkerCount = Math.max(1, Math.floor(Number(limit) || 1));
  const workerCount = Math.min(list.length, requestedWorkerCount, MAX_CONCURRENT_WORKERS);
  const results = new Array(list.length);
  let nextIndex = 0;
  let nextLaunchAt = 0;
  let launchGate = Promise.resolve();

  async function waitForLaunchTurn() {
    const turn = launchGate.then(async () => {
      const waitMs = Math.max(0, nextLaunchAt - Date.now());
      if (waitMs > 0) {
        await wait(waitMs);
      }
      nextLaunchAt = Date.now() + WORKER_START_DELAY_MS;
    });
    launchGate = turn.catch(() => {});
    await turn;
  }

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < list.length) {
        const index = nextIndex;
        nextIndex += 1;
        await waitForLaunchTurn();
        results[index] = await worker(list[index], index);
      }
    }),
  );

  return results;
}
