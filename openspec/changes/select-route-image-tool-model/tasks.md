## 1. 白名单与测试

- [x] 1.1 在 `lib/model-defaults.mjs` 新增 `IMAGE_TOOL_MODEL_OPTIONS`、`DEFAULT_IMAGE_TOOL_MODEL` 和 `normalizeImageToolModel()`。
- [x] 1.2 新增 `test/image-tool-model.test.mjs`：断言选项集合与默认值、白名单归一化（含 `gpt-image-2.5`、`gpt-image-1.5`、自定义值、空值、非法 fallback）。

## 2. 配置贯通

- [x] 2.1 `lib/image-route-config.mjs` 归一化 `imageToolModel` 并在路由 A 分支返回该值，替换硬编码常量。
- [x] 2.2 `lib/config-store.mjs` 注册默认值、`IMAGE_TOOL_MODEL` / `IMAGE_STUDIO_IMAGE_TOOL_MODEL` 环境变量、routeA 键列表与公开配置投影。
- [x] 2.3 `lib/browser-config.mjs` 在归一化、公开投影、保存与 FormData/请求载荷中带上该字段。
- [x] 2.4 `lib/request-private-config.mjs` 读取请求字段，按 `responsesModel` 的同档规则只在请求自带 Key 时生效。
- [x] 2.5 `server.mjs` 的 `handleConfigPost` 持久化该字段。
- [x] 2.6 补测试覆盖本地配置读写与收敛、环境变量、浏览器往返、请求字段生效条件、路由 B/C 不受影响。

## 3. 界面

- [x] 3.1 `public/index.html` 在「Responses 模型」下方新增 `imageToolModelSelect` 下拉框（三个选项）与说明文案；参数区「工具模型」加上 `id="parameterToolModel"`。
- [x] 3.2 `public/app.js` 注册 refs、新增 `getSelectedImageToolModel()`、写入请求载荷、`syncConfigUi` 回显下拉框与参数区、`change` 事件即时更新参数区显示、中英文案键。
- [x] 3.3 把客户端乐观记录里硬编码的 `imageModel` 改为读取所选工具模型（`public/app.js` 四处、`lib/views/quick-blend-view.mjs`、`lib/views/image-edit-view.mjs`）。
- [x] 3.4 补测试断言配置区只有下拉、没有同名文本输入框，且选项与白名单一致。

## 3b. 记录与标签一致性

- [x] 3b.1 `server.mjs` 的 PPT 清单改用 `getSelectedImageGenerationConfig(config).imageModel`，与幻灯片实际使用的模型一致。
- [x] 3b.2 `lib/studio-formatters.mjs` 的 `formatImageModelLabel` 补上两个 2.5 模型的标签。
- [x] 3b.3 补测试：用真实 `requestImageEdit` 断言编辑请求的 `model` 随配置变化且非法值被收敛；断言四个 view/app 文件不再写死 `gpt-image-2`。
- [x] 3b.4 为 `image-edit-mode` 与 `local-mask-image-edit` 写 spec delta，修订固定 `model=gpt-image-2` 的既有要求。

## 3c. 质量档

- [x] 3c.1 新增 `lib/image-quality-options.mjs`：选项集合、默认值 `high`、`getImageQualityOptions()`、`normalizeImageQuality()`、`isImageQualitySupportedByModel()`。
- [x] 3c.2 `lib/model-defaults.mjs` 新增 `supportsExtendedImageQuality()`，仅两个 2.5 变体为 true。
- [x] 3c.3 `lib/config-store.mjs`：默认值改用常量、新增 `IMAGE_QUALITY` / `IMAGE_STUDIO_IMAGE_QUALITY` 环境变量，并在 `mergeConfig` 拿到归一化工具模型后收敛 `defaults.quality`。
- [x] 3c.4 服务端 9 处质量解析点改为按模型归一化；PPT 单页用 `slideQuality`，补图条目按 `itemGenerationConfig.imageModel` 收敛。
- [x] 3c.5 `public/index.html` 把写死的 `质量 High` 换成 `qualityInput` 下拉，`parameter-meta` 只留工具模型并改 aria 键。
- [x] 3c.6 `public/app.js`：注册 ref、`renderImageQualityOptions()`、`getSelectedImageQuality()`、`syncConfigUi` 与工具模型 `change` 时重建选项、`buildGenerationFormData` 补发 `quality` 字段、替换 6 处客户端写死值、新增 i18n 键。
- [x] 3c.7 把 `image-quality-options.mjs` 加入 `scripts/sync-public-lib.mjs` 清单。
- [x] 3c.8 新增 `test/image-quality-options.test.mjs`：档位集合、按模型过滤、扩展档降级、配置与环境变量收敛、真实 `requestImageEdit` 的 `quality` 字段、参数区下拉标记。
- [x] 3c.9 用 Electron 探针在真实渲染里确认选项集合随模型变化且 `max` 切回旧模型后降级。

## 3d. 深色主题下拉可读性

- [x] 3d.1 用 Electron 探针实测：`#imageToolModelSelect` 的 `option` 背景为 `rgba(0,0,0,0)`，文字继承近白色 `--text`，系统弹层铺浅色底导致白底白字；其余下拉均有显式不透明底色。
- [x] 3d.2 `public/styles.css` 补全局 `select option, select optgroup { background: var(--bg-soft); color: var(--text); }`，特异度 (0,0,2) 低于既有按类规则，不覆盖它们刻意的配色。
- [x] 3d.3 升 `styles.css` / `app.js` 资源版本号至 `20260909-image-tool-model-1`，并同步 4 个钉死该版本的测试文件。
- [x] 3d.4 复测深色与浅色两套主题，确认新下拉 option 对比度 15.79 / 16.83，且 `#endpointPathSelect` 的 9.87 未被改动。
- [x] 3d.5 补回归测试断言全局 option 规则存在、按类规则仍在、资源版本号已升。

## 4. 同步、文档与验证

- [x] 4.1 运行 `npm run sync:public-lib` 同步 `public/lib/` 镜像。
- [x] 4.2 更新两份 README 的工具模型段落为下拉选项表；`.env.example` 与两份 README 环境变量清单新增 `IMAGE_TOOL_MODEL`。
- [x] 4.3 更新 `test/studio-preview-layout.test.mjs` 的参数区标记断言。
- [x] 4.4 运行 `npm test`、`npm run sync:public-lib -- --check`、`npm run check:release`。
- [x] 4.5 运行 `npx --no-install openspec validate select-route-image-tool-model --strict`、`git diff --check`，并复核新增中文为 UTF-8 且无乱码。
