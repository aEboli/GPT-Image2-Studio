import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const fileTransactions = new Map();

export function withFileTransaction(filePath, operation) {
  const key = resolve(filePath);
  const previous = fileTransactions.get(key) || Promise.resolve();
  const result = previous.then(operation);
  const tail = result.catch(() => {});
  fileTransactions.set(key, tail);
  tail.then(() => {
    if (fileTransactions.get(key) === tail) fileTransactions.delete(key);
  });
  return result;
}

export async function writeJsonFileAtomic(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    for (let attempt = 0; ; attempt += 1) {
      try {
        await rename(tempPath, filePath);
        break;
      } catch (error) {
        // Windows readers can briefly prevent replacement of the previous file.
        if (process.platform !== "win32" || attempt >= 6 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
        await delay(10 * 2 ** attempt);
      }
    }
  } finally {
    await rm(tempPath, { force: true });
  }
}
