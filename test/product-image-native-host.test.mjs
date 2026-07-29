import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { buildProductImageClipboardHost } from "../lib/product-image-native-host-build.mjs";

const nativeHostDir = new URL("../extensions/product-image-collector/native-host/", import.meta.url);

test("native clipboard host is purpose-bound and independently installable", async () => {
  const [source, installer, uninstaller] = await Promise.all([
    readFile(new URL("ProductImageClipboardHost.cs", nativeHostDir), "utf8"),
    readFile(new URL("install-native-host.ps1", nativeHostDir), "utf8"),
    readFile(new URL("uninstall-native-host.ps1", nativeHostDir), "utf8"),
  ]);

  assert.match(source, /com\.aeboli\.gpt_image2_studio\.product_image_clipboard/);
  assert.match(source, /Clipboard\.SetFileDropList/);
  assert.match(source, /SetApartmentState\(ApartmentState\.STA\)/);
  assert.match(source, /Task\.Run\(\(\) => SetFileDropClipboard\(paths\)\)/);
  assert.match(source, /MaxRequestBytes\s*=\s*4\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /MaxItemCount\s*=\s*1000/);
  assert.match(source, /MaxImageBytes\s*=\s*20L\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /MaxBatchBytes\s*=\s*512L\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /ClipboardCannotOpenError\s*=\s*unchecked\(\(int\)0x800401D0\)/);
  assert.match(source, /if\s*\(!IsClipboardBusy\(error\)\)\s*throw/);
  assert.match(source, /writeError\s+is\s+ExternalException\s+&&\s+IsClipboardBusy/);
  assert.match(source, /AllowAutoRedirect\s*=\s*false/);
  assert.doesNotMatch(source, /Process\.Start|cmd\.exe|powershell\.exe|127\.0\.0\.1|localhost/);

  assert.match(installer, /Google\\Chrome\\NativeMessagingHosts/);
  assert.match(installer, /Microsoft\\Edge\\NativeMessagingHosts/);
  assert.match(installer, /chrome-extension:\/\/gbdkgkooddcicpkikaklapgeakhjjcan\//);
  assert.equal(installer.codePointAt(0), 0xfeff);
  assert.equal(uninstaller.codePointAt(0), 0xfeff);
  assert.match(uninstaller, /Remove-Item/);
});

test("compiled native host dispatches clipboard work to STA after asynchronous preparation", async () => {
  const buildDir = await mkdtemp(join(tmpdir(), "product-image-native-host-sta-test-"));
  try {
    const executable = join(buildDir, "ProductImageClipboardHost.exe");
    await buildProductImageClipboardHost({
      rootDir: fileURLToPath(new URL("..", import.meta.url)),
      outputPath: executable,
    });

    const output = await new Promise((resolve, reject) => {
      const child = spawn(executable, ["--self-test-clipboard-apartment"], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stdout = [];
      const stderr = [];
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.once("error", reject);
      child.once("close", (code) => resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }));
    });

    assert.equal(output.code, 0);
    assert.equal(output.stderr, "");
    assert.deepEqual(JSON.parse(output.stdout), { ok: true, apartment: "STA" });
  } finally {
    await rm(buildDir, { recursive: true, force: true });
  }
});

test("compiled native host rejects non-copy commands through the framed protocol", async () => {
  const buildDir = await mkdtemp(join(tmpdir(), "product-image-native-host-test-"));
  try {
    const executable = join(buildDir, "ProductImageClipboardHost.exe");
    await buildProductImageClipboardHost({
      rootDir: fileURLToPath(new URL("..", import.meta.url)),
      outputPath: executable,
    });
    const requestBytes = Buffer.from(JSON.stringify({ type: "run-command" }), "utf8");
    const frame = Buffer.allocUnsafe(4 + requestBytes.length);
    frame.writeUInt32LE(requestBytes.length, 0);
    requestBytes.copy(frame, 4);

    const output = await new Promise((resolve, reject) => {
      const child = spawn(executable, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      const stdout = [];
      const stderr = [];
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.once("error", reject);
      child.once("close", (code) => resolve({
        code,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }));
      child.stdin.end(frame);
    });

    assert.equal(output.code, 0);
    assert.equal(output.stderr, "");
    const responseLength = output.stdout.readUInt32LE(0);
    assert.equal(output.stdout.length, responseLength + 4);
    const response = JSON.parse(output.stdout.subarray(4).toString("utf8"));
    assert.equal(response.ok, false);
    assert.match(response.message, /只接受复制图片请求/);
  } finally {
    await rm(buildDir, { recursive: true, force: true });
  }
});
