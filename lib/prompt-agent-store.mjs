import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HISTORY_FILENAME = "prompt-agent-history.json";

function normalizeHistoryEntry(entry = {}) {
  const createdAt = String(entry.createdAt || new Date().toISOString());
  const json = entry.json && typeof entry.json === "object" ? entry.json : {};

  return {
    id: String(entry.id || `prompt-json-${Date.now()}`),
    createdAt,
    filename: String(entry.filename || ""),
    imageMimeType: String(entry.imageMimeType || ""),
    imageSize: Number(entry.imageSize || 0),
    responsesModel: String(entry.responsesModel || ""),
    reasoningEffort: String(entry.reasoningEffort || ""),
    json,
  };
}

function sortHistory(entries) {
  return [...entries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createPromptAgentStore({ rootDir }) {
  const localDir = join(rootDir, ".local");
  const historyPath = join(localDir, HISTORY_FILENAME);

  async function list() {
    try {
      const raw = await readFile(historyPath, "utf8");
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      return sortHistory((Array.isArray(entries) ? entries : []).map(normalizeHistoryEntry));
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  async function save(entries) {
    await mkdir(localDir, { recursive: true });
    await writeFile(
      historyPath,
      `${JSON.stringify(
        {
          version: 1,
          entries: sortHistory(entries.map(normalizeHistoryEntry)),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  async function append(entry) {
    const entries = await list();
    const normalized = normalizeHistoryEntry(entry);
    await save([normalized, ...entries]);
    return normalized;
  }

  return {
    historyPath,
    list,
    append,
  };
}
