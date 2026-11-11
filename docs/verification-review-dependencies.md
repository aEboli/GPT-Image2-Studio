# 依赖审查修复验证

验证日期：2026-11-11。环境：Windows、Node.js v25.2.1、npm 11.6.2。

## 结论与修改范围

- 生产锁文件审计由 **30 high 降至 29 high**；`brace-expansion` 不再出现。
- 剩余 29 个受影响包均由 **同一条 Zod 公告**沿 Jimp 依赖链传播，并非 29 个独立漏洞。未宣称审计清零。
- `package-lock.json` 仅修改 7 个 `brace-expansion` 锁项；`package.json` 不需要修改。新增 `test/review-dependencies.test.mjs` 和本文档。
- 依赖分析阶段只更新锁文件；综合阶段已使用 `npm install --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org` 实际更新七个包，逐项核对磁盘版本与锁文件一致。未执行依赖安装脚本。

## 官方依据与兼容性

所有 npm 查询、锁文件更新和审计均显式指定 `https://registry.npmjs.org`。

| 官方来源 | 核查结果 |
| --- | --- |
| [brace-expansion 重写循环公告](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) | 1.x、2.x、5.x 的修复起点分别为 1.1.21、2.1.7、5.0.12。 |
| [嵌套组递归公告](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7) | 上述版本覆盖嵌套组导致的栈耗尽修复。 |
| [parseCommaParts 递归公告](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p) | 上述版本覆盖逗号组解析的栈耗尽修复。 |
| [1.1.21 元数据](https://registry.npmjs.org/brace-expansion/1.1.21)、[2.1.7 元数据](https://registry.npmjs.org/brace-expansion/2.1.7)、[5.0.12 元数据](https://registry.npmjs.org/brace-expansion/5.0.12) | 校验版本、tarball URL、SHA-512 integrity、依赖和 engines；下载包在内存中校验完整性后执行隔离验证，未写入 `node_modules`。 |
| [Jimp npm 元数据](https://registry.npmjs.org/jimp) | 查询时 `latest` 仍为 **1.6.1**。 |
| [Jimp resize 插件 1.6.1](https://registry.npmjs.org/@jimp/plugin-resize/1.6.1) | 声明 `zod: ^3.23.8`；其他受影响插件及 `@jimp/types` 也保留 Zod 3 依赖。 |
| [Zod npm 元数据](https://registry.npmjs.org/zod) | 查询时最新稳定 3.x 为 **3.25.76**，`latest` 为 4.6.7。没有已发布的兼容 3.x 修复版。 |
| [Zod 公告 GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | 公告范围 `<4.6.6`，修复起点 **4.6.6**。 |
| [Zod 上游修复提交](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd) | 修复集合大小约束在逐项解析之前执行；修改的是 `packages/zod/src/v4`，没有 Zod 3 回补。 |
| [Zod v4.6.6 迁移文档源码](https://github.com/colinhacks/zod/blob/v4.6.6/packages/docs/content/v4/changelog.mdx) | `z.function()` 的契约改变，不能将 4.x 当作 3.x 的透明替换。 |

Jimp 1.6.1 发布源码的 gitHead 为 `7e6a95694e00a8b6f1bdd9aad709f5413eb9b08c`。实际安装源码中，`@jimp/plugin-print/dist/esm/index.js` 在模块初始化时调用 `z.function(z.tuple(...)).optional()`，而 `jimp/dist/esm/index.js` 默认导入该插件。因此即使业务没有调用 `print`，也不能仅凭当前业务只用缩放就假定 Zod 4 override 兼容。该判断有官方迁移文档和已安装源码依据；本次没有尝试替换整个 Jimp/Zod 运行时。

`npm audit` 提议的 Jimp **0.22.12** 是跨主版本降级，会涉及当前使用的具名 `Jimp` 导出、对象式尺寸参数和 `createJimp`/默认插件组合，未采用 `npm audit fix --force`。

## 锁文件更新

| 锁项父路径 | 原版本 | 修复版本 | 用途 |
| --- | --- | --- | --- |
| `@electron/asar` | 1.1.16 | 1.1.21 | 开发依赖 |
| `@electron/universal` | 2.1.2 | 2.1.7 | 开发依赖 |
| 根 `node_modules/brace-expansion` | 5.0.7 | 5.0.12 | 开发依赖 |
| `dir-compare` | 1.1.16 | 1.1.21 | 开发依赖 |
| `filelist` | 2.1.2 | 2.1.7 | 开发依赖 |
| `glob` | 1.1.18 | 1.1.21 | 生产依赖 |
| `readdir-glob` | 2.1.4 | 2.1.7 | 生产依赖 |

现有 minimatch 依赖范围分别允许 `^1.1.7`、`^2.0.1` / `^2.0.2`、`^5.0.5`，无需额外 override。5.0.12 的官方 engines 为 `20 || >=22`，已同步到锁项；项目 CI 使用 Node 22，本次验证使用 Node 25。没有新增对 Node 18 的支持承诺。

执行：

```powershell
npm update brace-expansion --package-lock-only --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
```

该命令更新了六个 1.x / 2.x 锁项，但保留了根 5.0.7。再次加 `--prefer-online` 后仍保留该项；未将具体原因归结为未经证实的缓存或版本规则。随后按已验证的 5.0.12 官方元数据仅更新该锁项的版本、URL、integrity 和 engines，并执行：

```powershell
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
```

锁文件校验成功，保留 5.0.12。与修改前比较，包路径集合不变，恰好七个 `brace-expansion` 锁项改变，没有其他包升级、降级或删除。逐项对照官方元数据通过，实际已安装包版本仍未改变。npm 更新了隐藏的 `node_modules/.package-lock.json` 元数据，因此不能用该文件的 hash 不变作为“不安装”的断言。

## 红绿验证

1. **先红**：新增锁文件安全回归测试后，在旧锁文件上执行 `node --test test/review-dependencies.test.mjs`，**0 通过、7 失败**，全部命中已知受影响的 brace-expansion 版本。
2. **实际复现**：旧生产包 1.1.18 / 2.1.4 对以下两个输入均抛出 `RangeError: Maximum call stack size exceeded`。输入在独立短生命周期 Node 进程中运行，没有触碰服务端或其他代理进程。

   ```js
   "{" + "{a},".repeat(7000) + "b}"
   "{".repeat(7000) + "a,b" + "}".repeat(7000)
   ```

3. **官方包隔离验证**：获取 1.1.21、2.1.7、5.0.12 的官方 tarball，核对 SHA-512，用 `tar` 向标准输出读取入口模块，在独立进程中加载并复用原有、未变更的 `balanced-match` / `concat-map`。三个版本都通过普通集合、数字序列、嵌套集合、转义花括号断言；上面两个栈溢出输入均正常返回。另验证 `"{a}" + "}".repeat(16000) + ",z}"` 正常返回。本机本次耗时为逗号组 6–13ms、深度嵌套 294–320ms、重复重写 9–11ms；耗时仅作记录，未写成易波动的硬性测试阈值。
4. **再绿**：更新完成后运行下列局部测试，**21 通过、0 失败**，其中新增依赖锁项测试 7 项、缩略图测试 4 项、Temu 工作簿测试 10 项。

   ```powershell
   node --test --test-concurrency=1 test/review-dependencies.test.mjs test/gallery-thumbnail.test.mjs test/creation-temu-workbook.test.mjs
   ```

   缩略图和工作簿测试使用共享工作区原有安装包，证明当前调用面的基线；修复后 brace-expansion 的运行行为由前述官方包隔离验证覆盖。不能把这 21 项描述成安装新依赖后的全链路验收。

5. **审计**：`npm audit --omit=dev --json --registry=https://registry.npmjs.org` 返回 **29 high**，退出码 **1**；不再包含 brace-expansion，直接公告 URL 只剩 GHSA-mrhx-c7xc-m3w5。`git diff --check` 的分配文件检查通过。未运行全量测试或构建。

## Zod 实际调用面与剩余限制

对 `lib`、`server.mjs`、`generate-image.mjs`、`scripts` 和相关测试进行引用检索，并检查已安装的 Jimp 1.6.1 源码：

- `lib/gallery-thumbnail.mjs`：`createJimp({ formats: [...defaultFormats, galleryWebpFormat], plugins: defaultPlugins })`；读取图像后，以内部固定的 `{ w: 512, h: 512 }` 调用 `scaleToFit`，再编码 WebP。
- `scripts/import-youmind-prompt-library.mjs`：`Jimp.read(original)`，必要时 `resize({ w: IMAGE_WIDTH })`，然后 `getBuffer("image/jpeg", { quality: IMAGE_QUALITY })`；宽度、质量来自脚本常量。
- `server.mjs`：开发 mock 使用小尺寸 `new Jimp(...).getBuffer("image/jpeg")`；标注编辑用 `Jimp.read` 解码源图和 PNG 标注，比较 bitmap 宽高并检查透明度。没有将请求 JSON 集合作为 Jimp 变换配置直接传入。
- `@jimp/plugin-resize/dist/esm/index.js`：当前使用的 `ScaleToFitOptionsSchema` 和 resize schema 校验数值字段及可选模式；`@jimp/types/dist/esm/index.js` 对像素数据使用 Buffer / Uint8Array 实例检查。当前已查调用未直接进入公告涉及的大型用户集合逐项校验。
- Jimp 默认仍加载颜色等包含数组 / tuple schema 的插件，不能把“未发现当前可达路径”写成“依赖漏洞已修复”或完全安全的证明。

当前采用同主版本修复 brace-expansion，保留 Jimp 1.6.1 / Zod 3.25.76 并明确剩余风险。若必须消除 Zod 3 依赖，需要评估移除或替换项目实际使用的 Jimp 图像解码、缩放及插件组合，并重新验证图像格式与桌面打包；仅裁掉未用插件仍不能消除 `@jimp/types` 的 Zod 依赖。本次兼容补丁未实施这一图像库迁移，剩余告警仍然存在。

综合安装时，npm 的隐藏 `node_modules/.package-lock.json` 已提前反映新版本，首次安装误报无需更新，但实际七个包仍为旧版。移除该生成缓存后重新安装，npm 报告更新七个包；直接读取每个已安装包的 package.json 与主锁文件逐项比较，七项全部一致。综合回归结果见 `docs/verification-reviewed-generation-integrity.md`；剩余 Zod 公告仍需单独处理。
