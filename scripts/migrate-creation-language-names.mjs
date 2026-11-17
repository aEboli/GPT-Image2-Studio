import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getCreationSetLanguageLabel } from "../lib/creation-set-language.mjs";
import { writeJsonFileAtomic } from "../lib/atomic-json-file.mjs";

async function exists(path) {
  try { await lstat(path); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function replacePaths(value, moves) {
  if (typeof value === "string") {
    for (const { from, to } of moves) {
      for (const [source, target, separator] of [[from, to, "/"], [encodeURI(from), encodeURI(to), "/"], [encodeURIComponent(from), encodeURIComponent(to), "%2F"], [from.replaceAll("/", "\\"), to.replaceAll("/", "\\"), "\\"]]) {
        value = value.split(`${source}${separator}`).join(`${target}${separator}`);
        if (value === source || value.endsWith(`${separator}${source}`)) value = value.slice(0, -source.length) + target;
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => replacePaths(entry, moves));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [replacePaths(key, moves), replacePaths(entry, moves)]));
  return value;
}

async function filesBelow(directory) {
  if (!await exists(directory)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`不迁移符号链接：${path}`);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function migrateCreationLanguageNames({ outputDir, date, backupDir, apply = false, indexPath } = {}) {
  if (!outputDir || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || date < "2026-11-17" || !Number.isFinite(Date.parse(`${date}T00:00:00+08:00`)) || new Date(`${date}T12:00:00+08:00`).toISOString().slice(0, 10) !== date) {
    throw new Error("必须指定输出目录及 2026-11-17 起的有效日期");
  }
  const root = await realpath(resolve(outputDir));
  const base = `${date.slice(0, 7)}/${date.slice(5)}/${date}-creation/`;
  const manifestsDir = join(root, "json", "creation-sets");
  const records = [];
  for (const filename of await readdir(manifestsDir)) {
    if (!filename.endsWith(".json")) continue;
    const path = join(manifestsDir, filename);
    const raw = await readFile(path, "utf8");
    const manifest = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const timestamp = new Date(manifest.createdAt).getTime();
    if (!Number.isFinite(timestamp) || new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10) !== date) continue;
    const language = getCreationSetLanguageLabel(manifest).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, "").slice(0, 40);
    if (!language) throw new Error(`缺少可用语言：${manifest.setId}`);
    const from = String(manifest.relativeDir || "").replaceAll("\\", "/");
    if (!from.startsWith(base) || !from.slice(base.length) || /[/\\]|^\.{1,2}$/.test(from.slice(base.length))) throw new Error(`目录超出指定日期：${from}`);
    if (from.endsWith(`-${language}`)) continue;
    records.push({ path, raw, manifest, from, to: `${from}-${language}`, language });
  }
  const busy = records.filter(({ manifest }) => ["planning", "queued", "generating", "saving"].includes(manifest.status)).map(({ manifest }) => manifest.setId);
  const summary = { date, apply, count: records.length, busy, renamed: records.map(({ manifest, from, to, language }) => ({ setId: manifest.setId, from, to, language })) };
  if (!apply || !records.length) return summary;
  if (busy.length) throw new Error(`请等待执行中套图结束：${busy.join(", ")}`);
  if (!backupDir) throw new Error("写入迁移必须指定备份目录");

  const directoryMoves = [];
  const documents = new Map(records.map(({ path, raw, manifest }) => [path, { raw, value: manifest }]));
  const hashes = [];
  for (const record of records) {
    for (const prefix of ["", "json/", "json/thumbnails/"]) {
      const from = join(root, prefix, record.from);
      const to = join(root, prefix, record.to);
      if (await exists(to)) throw new Error(`目标目录已存在：${to}`);
      if (!await exists(from)) continue;
      const realFrom = await realpath(from);
      const offset = relative(root, realFrom);
      if (realFrom !== resolve(from) || offset.startsWith("..") || isAbsolute(offset) || (await lstat(from)).isSymbolicLink()) throw new Error(`目录不安全：${from}`);
      directoryMoves.push({ from, to });
      for (const path of await filesBelow(from)) {
        const bytes = await readFile(path);
        if (prefix === "json/" && path.endsWith(".json")) {
          const raw = bytes.toString("utf8");
          documents.set(path, { raw, value: JSON.parse(raw.replace(/^\uFEFF/, "")) });
        } else {
          hashes.push({ path: join(to, relative(from, path)), sha256: createHash("sha256").update(bytes).digest("hex") });
        }
      }
    }
    for (const item of record.manifest.items || []) {
      if (item.status === "completed" && item.relativePath && !await exists(join(root, item.relativePath))) throw new Error(`图片缺失，停止迁移：${item.relativePath}`);
    }
  }
  const galleryIndex = indexPath || join(dirname(root), ".local", "gallery-index.json");
  if (await exists(galleryIndex)) {
    const raw = await readFile(galleryIndex, "utf8");
    const value = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (JSON.stringify(replacePaths(value, records)) !== JSON.stringify(value)) documents.set(galleryIndex, { raw, value });
  }
  const backup = resolve(backupDir);
  await mkdir(backup, { recursive: false });
  const entries = [];
  for (const [path, document] of documents) {
    const backupFile = join(backup, `${entries.length}.json`);
    await writeFile(backupFile, document.raw, { encoding: "utf8", flag: "wx" });
    const moved = directoryMoves.find(({ from }) => path.startsWith(`${from}\\`) || path.startsWith(`${from}/`));
    entries.push({ original: path, current: moved ? join(moved.to, relative(moved.from, path)) : path, backupFile });
  }
  await writeJsonFileAtomic(join(backup, "migration.json"), { ...summary, directoryMoves, entries, hashes });
  for (const [path, document] of documents) {
    if (await readFile(path, "utf8") !== document.raw) throw new Error(`记录发生变化，停止迁移：${path}`);
  }
  const moved = [];
  try {
    for (const move of directoryMoves) { await rename(move.from, move.to); moved.push(move); }
    for (const entry of entries) await writeJsonFileAtomic(entry.current, replacePaths(documents.get(entry.original).value, records));
    for (const { path, sha256 } of hashes) {
      if (createHash("sha256").update(await readFile(path)).digest("hex") !== sha256) throw new Error(`文件校验失败：${path}`);
    }
  } catch (error) {
    const recoveryErrors = [];
    for (const entry of entries) {
      try { if (await exists(entry.current)) await writeFile(entry.current, await readFile(entry.backupFile)); } catch (recoveryError) { recoveryErrors.push(recoveryError); }
    }
    for (const move of moved.reverse()) {
      try { await rename(move.to, move.from); } catch (recoveryError) { recoveryErrors.push(recoveryError); }
    }
    if (recoveryErrors.length) throw new AggregateError([error, ...recoveryErrors], `迁移失败且回滚不完整；备份：${backup}`);
    throw error;
  }
  return { ...summary, backupDir: backup, verifiedFiles: hashes.length, updatedJsonFiles: entries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  console.log(JSON.stringify(await migrateCreationLanguageNames({ outputDir: option("output"), date: option("date"), backupDir: option("backup"), indexPath: option("index"), apply: args.includes("--apply") }), null, 2));
}
