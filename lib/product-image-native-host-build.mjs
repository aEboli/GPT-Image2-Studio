import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {}
  }
  return "";
}

function runCompiler(executable, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        if (output.length < 32_768) output += String(chunk).slice(0, 32_768 - output.length);
      });
    }
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(output.trim() || `C# compiler exited with code ${code}.`));
    });
  });
}

export async function buildProductImageClipboardHost({ rootDir, outputPath } = {}) {
  if (process.platform !== "win32") {
    throw new Error("商品图本地剪贴板助手只能在 Windows 上构建。");
  }
  const resolvedRoot = resolve(rootDir || ".");
  const sourcePath = join(
    resolvedRoot,
    "extensions",
    "product-image-collector",
    "native-host",
    "ProductImageClipboardHost.cs",
  );
  const resolvedOutput = resolve(outputPath || join(resolvedRoot, "ProductImageClipboardHost.exe"));
  const windowsDir = process.env.WINDIR || "C:\\Windows";
  const frameworkDirs = [
    join(windowsDir, "Microsoft.NET", "Framework64", "v4.0.30319"),
    join(windowsDir, "Microsoft.NET", "Framework", "v4.0.30319"),
  ];
  const compiler = await firstExisting(frameworkDirs.map((directory) => join(directory, "csc.exe")));
  if (!compiler) {
    throw new Error("未找到 Windows .NET Framework C# 编译器，无法构建本地剪贴板助手。");
  }
  const frameworkDir = dirname(compiler);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await runCompiler(compiler, [
    "/nologo",
    "/target:exe",
    "/optimize+",
    "/platform:anycpu",
    "/langversion:5",
    "/codepage:65001",
    `/out:${resolvedOutput}`,
    `/reference:${join(frameworkDir, "System.dll")}`,
    `/reference:${join(frameworkDir, "System.Core.dll")}`,
    `/reference:${join(frameworkDir, "System.Net.Http.dll")}`,
    `/reference:${join(frameworkDir, "System.Web.Extensions.dll")}`,
    `/reference:${join(frameworkDir, "System.Windows.Forms.dll")}`,
    sourcePath,
  ]);
  return resolvedOutput;
}
