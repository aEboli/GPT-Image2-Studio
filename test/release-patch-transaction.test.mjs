import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rename as renameFile, rm, unlink as unlinkFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const maintainedTargets = [
  "package.json",
  "package-lock.json",
  "public/index.html",
  "README.md",
  "README.zh-CN.md",
  "docs/windows-desktop.md",
  "docs/windows-installer.md",
];

async function createFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-release-transaction-"));
  await mkdir(join(rootDir, "public"), { recursive: true });
  await mkdir(join(rootDir, "docs", "releases"), { recursive: true });
  await writeFile(join(rootDir, "package.json"), '{"name":"fixture","version":"1.2.3"}\n', "utf8");
  await writeFile(
    join(rootDir, "package-lock.json"),
    '{"name":"fixture","version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n',
    "utf8",
  );
  await writeFile(
    join(rootDir, "public", "index.html"),
    '<small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small>\n',
    "utf8",
  );
  await writeFile(join(rootDir, "README.md"), "Current version: `v1.2.3`\n", "utf8");
  await writeFile(join(rootDir, "README.zh-CN.md"), "当前版本：`v1.2.3`\n", "utf8");
  await writeFile(
    join(rootDir, "docs", "windows-desktop.md"),
    "`GPT-Image2-Studio-Desktop-Setup-v1.2.3-x64.exe` 是桌面安装包。\n",
    "utf8",
  );
  await writeFile(
    join(rootDir, "docs", "windows-installer.md"),
    "`GPT-Image2-Studio-Setup-v1.2.3.exe` 是兼容安装包。\n",
    "utf8",
  );
  return rootDir;
}

async function transactionFiles(rootDir) {
  const files = await readdir(rootDir, { recursive: true });
  return files
    .map(String)
    .filter((relativePath) => /\.(?:tmp|bak)$/u.test(relativePath))
    .map((relativePath) => join(rootDir, relativePath));
}

async function readMaintainedTargets(rootDir) {
  return Promise.all(maintainedTargets.map((relativePath) => readFile(join(rootDir, relativePath), "utf8")));
}

async function runRelease(rootDir, fileOperations) {
  const { bumpPatchRelease } = await import("../scripts/release-patch.mjs");
  return bumpPatchRelease({ rootDir, summary: "事务清理错误注入测试。", fileOperations });
}

test("staging cleanup failures are reported together with the original staging error", async () => {
  const rootDir = await createFixture();
  try {
    const before = await readMaintainedTargets(rootDir);
    let temporaryWriteCount = 0;
    let injectedCleanupFailure = false;
    let caught;
    try {
      await runRelease(rootDir, {
        writeFile: async (path, ...args) => {
          if (/\.tmp$/u.test(String(path)) && ++temporaryWriteCount === 2) {
            throw new Error("injected staging failure");
          }
          return writeFile(path, ...args);
        },
        unlink: async (path) => {
          if (!injectedCleanupFailure && /\.package\.json\..+\.tmp$/u.test(String(path))) {
            injectedCleanupFailure = true;
            throw new Error("injected tmp cleanup failure");
          }
          return unlinkFile(path);
        },
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof AggregateError);
    assert.match(caught.message, /staging failed/i);
    assert.match(caught.message, /injected staging failure/);
    assert.match(caught.message, /injected tmp cleanup failure/);
    assert.equal(caught.committed, false);
    assert.ok(caught.cleanupFailures?.length >= 1);
    assert.ok(caught.pendingTemporaryPaths?.some((path) => /\.tmp$/u.test(path)));
    assert.deepEqual(await readMaintainedTargets(rootDir), before);
    assert.ok((await transactionFiles(rootDir)).some((path) => /\.tmp$/u.test(path)));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("multiple staging failures are retained with an explicit uncommitted outcome", async () => {
  const rootDir = await createFixture();
  try {
    const before = await readMaintainedTargets(rootDir);
    let temporaryWriteCount = 0;
    let caught;
    try {
      await runRelease(rootDir, {
        writeFile: async (path, ...args) => {
          if (/\.tmp$/u.test(String(path))) {
            temporaryWriteCount += 1;
            if (temporaryWriteCount === 2 || temporaryWriteCount === 3) {
              throw new Error(`injected staging failure ${temporaryWriteCount}`);
            }
          }
          return writeFile(path, ...args);
        },
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof AggregateError);
    assert.equal(caught.committed, false);
    assert.equal(caught.stageFailures?.length, 2);
    assert.match(caught.message, /injected staging failure 2/);
    assert.match(caught.message, /injected staging failure 3/);
    assert.deepEqual(caught.pendingTemporaryPaths, []);
    assert.deepEqual(await readMaintainedTargets(rootDir), before);
    assert.deepEqual(await transactionFiles(rootDir), []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("successful rollback reports an explicit uncommitted outcome", async () => {
  const rootDir = await createFixture();
  try {
    const before = await readMaintainedTargets(rootDir);
    let temporaryInstallCount = 0;
    let caught;
    try {
      await runRelease(rootDir, {
        rename: async (from, to) => {
          if (/\.tmp$/u.test(String(from)) && ++temporaryInstallCount === 3) {
            throw new Error("injected commit failure");
          }
          return renameFile(from, to);
        },
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof AggregateError);
    assert.equal(caught.committed, false);
    assert.match(caught.message, /version files were rolled back/i);
    assert.match(caught.message, /injected commit failure/);
    assert.deepEqual(caught.pendingBackupPaths, []);
    assert.deepEqual(caught.pendingTemporaryPaths, []);
    assert.deepEqual(await readMaintainedTargets(rootDir), before);
    assert.deepEqual(await transactionFiles(rootDir), []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("rollback and temporary cleanup failures retain all failure details", async () => {
  const rootDir = await createFixture();
  try {
    const before = await readMaintainedTargets(rootDir);
    let temporaryInstallCount = 0;
    let injectedRollbackFailure = false;
    let caught;
    try {
      await runRelease(rootDir, {
        rename: async (from, to) => {
          const source = String(from);
          if (/\.tmp$/u.test(source) && ++temporaryInstallCount === 3) {
            throw new Error("injected commit failure");
          }
          if (!injectedRollbackFailure && /\.bak$/u.test(source)) {
            injectedRollbackFailure = true;
            throw new Error("injected rollback failure");
          }
          return renameFile(from, to);
        },
        unlink: async (path) => {
          if (/\.index\.html\..+\.tmp$/u.test(String(path))) {
            throw new Error("injected tmp cleanup failure");
          }
          return unlinkFile(path);
        },
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof AggregateError);
    assert.match(caught.message, /rollback was incomplete/i);
    assert.match(caught.message, /injected commit failure/);
    assert.match(caught.message, /injected rollback failure/);
    assert.match(caught.message, /injected tmp cleanup failure/);
    assert.equal(caught.committed, false);
    assert.ok(caught.rollbackFailures?.length >= 1);
    assert.ok(caught.cleanupFailures?.length >= 1);
    assert.equal(caught.pendingBackupPaths?.length, 1);
    assert.ok(caught.pendingTemporaryPaths?.some((path) => /\.tmp$/u.test(path)));
    const [pendingBackupPath] = caught.pendingBackupPaths;
    assert.match(pendingBackupPath, /\.index\.html\..+\.bak$/u);
    await assert.rejects(readFile(join(rootDir, "public", "index.html"), "utf8"), { code: "ENOENT" });
    assert.equal(await readFile(pendingBackupPath, "utf8"), before[2]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("backup cleanup failure reports a committed release and leaves recovery backup", async () => {
  const rootDir = await createFixture();
  try {
    let injectedCleanupFailure = false;
    let caught;
    try {
      await runRelease(rootDir, {
        unlink: async (path) => {
          if (!injectedCleanupFailure && /\.package\.json\..+\.bak$/u.test(String(path))) {
            injectedCleanupFailure = true;
            throw new Error("injected bak cleanup failure");
          }
          return unlinkFile(path);
        },
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof AggregateError);
    assert.match(caught.message, /committed/i);
    assert.match(caught.message, /backup cleanup was incomplete/i);
    assert.match(caught.message, /injected bak cleanup failure/);
    assert.equal(caught.committed, true);
    assert.ok(caught.pendingBackupPaths?.some((path) => /\.bak$/u.test(path)));
    assert.equal(JSON.parse(await readFile(join(rootDir, "package.json"), "utf8")).version, "1.2.4");
    assert.match(await readFile(join(rootDir, "docs", "releases", "v1.2.4.md"), "utf8"), /v1\.2\.4/);
    const backups = await transactionFiles(rootDir);
    assert.ok(backups.some((path) => /\.package\.json\..+\.bak$/u.test(path)));
    assert.equal(backups.some((path) => /\.tmp$/u.test(path)), false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
