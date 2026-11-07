## 状态

2026-11-05：用户已批准实现，并明确要求白底 CG/功能渲染需要光效效果。已先复现失败再实施运行代码及回归测试；用户配置、既有生成记录和图片资产未改动，验证使用纯函数及隔离 HTTP mock，没有调用真实生图/文本模型。最终验证结果见文末。

## 基线

命令：

```powershell
node --test test/creation-reference-labels.test.mjs test/creation-marketing-plan.test.mjs test/creation-marketing-quality.test.mjs test/creation-commercial-cg-effect.test.mjs test/creation-suite-diversity.test.mjs
```

结果：131 tests，131 pass，0 fail。通过说明既有契约稳定，不代表本次新目标已实现。

提案完成后执行：单独变更严格校验通过；全部 OpenSpec 严格校验 70/70 通过；git diff --check 通过。新增文件另外执行 UTF-8、异常替换字符、行尾空格与 Markdown 代码块闭合检查。

## 可复现反例

在工作区根目录执行下面 JavaScript（PowerShell 可将代码以单引号 here-string 管道传给 node --input-type=module）。使用仓库现有 fixture 和纯函数，不写磁盘，也不调用模型：

```javascript
import { marketingPlanFixture } from './test/fixtures/creation-marketing-plan.mjs';
import { buildCreationPlan } from './lib/creation-planner.mjs';
import { applyCreationMarketingPlan } from './lib/creation-marketing-plan.mjs';
import { buildCreationItemReferenceImages } from './lib/creation-reference-labels.mjs';
import { auditCreationMarketingQuality } from './lib/creation-marketing-quality.mjs';
const { input, payload } = marketingPlanFixture(4);
input.referenceImageRoles.push({index:2,filename:'detail.png',role:'material'}, {index:3,filename:'finger.png',role:'feature'});
input.productInsights.confirmed_facts.find(f=>f.id==='control').reference_indexes=[2];
input.productInsights.confirmed_facts.find(f=>f.id==='fingers').reference_indexes=[3];
Object.assign(payload.items[0], {image_type:'clean-catalog-main',prompt:'完整一双手套，纯白背景，无文字，仅展示实物。'});
const plan=applyCreationMarketingPlan(buildCreationPlan(input),payload,{count:4,referenceCount:3,primaryIndex:1});
const images=['gloves.png','detail.png','finger.png'].map((filename,i)=>({filename,referenceIndex:i+1,byteLength:100000}));
console.log(JSON.stringify({case:'simple-white',factIds:plan.items[0].marketingAssignment.factIds,attached:buildCreationItemReferenceImages(plan.items[0],images,plan.referenceImageRoles).map(i=>i.filename)}));
const duplicate=structuredClone(plan);
for(const [i,goal,evidence] of [[0,'证明冬季骑行佩戴稳固','袖口贴合'],[2,'证明按键操作方便','手背控制按钮']]) { const item=duplicate.items[i]; item.role='scene';item.imageType='scene-application';item.marketingAssignment.goal=goal;Object.assign(item.marketingAssignment.creativeBrief,{scene:'冬日城市道路摩托车通勤',action:'戴手套握住摩托车车把',framing:'手部与车把的近景',evidence_focus:evidence,new_information:goal,visual_form:'use-scene'});}
console.log(JSON.stringify({case:'same-motorcycle-grip-different-selling-points',duplicateIssues:auditCreationMarketingQuality(duplicate).issues.filter(i=>i.code==='duplicate-task')}));
const cg=buildCreationPlan({productName:'手套',selectedRoles:['atmosphere']}).items[0];
console.log(JSON.stringify({case:'cg-prompt',hasWhiteBackground:/pure white|RGB.?255|纯白/i.test(cg.prompt),hasRecomposition:/recompos|new pose|重新构图|fresh.*pose/i.test(cg.prompt)}));
```

实现前的实际输出（用于记录原始缺口）：

```json
{"case":"simple-white","factIds":["appearance","control","fingers"],"attached":["gloves.png","detail.png","finger.png"]}
{"case":"same-motorcycle-grip-different-selling-points","duplicateIssues":[]}
{"case":"cg-prompt","hasWhiteBackground":false,"hasRecomposition":false}
```

这些检查仅用于定位当前缺口。白底重构的关键词检查不等于图片像素验收；实现时应进一步断言实际提示词和附件契约。

## 实现后验收矩阵

| 案例 | 预期 |
| --- | --- |
| 清晰主体＋多张综合说明卡，任务为纯白商品展示 | 仅主体，事实溯源仍完整 |
| 单部件特写，主体可看清该部件 | 不额外附加说明卡 |
| 单部件特写，只有另一张图能看清该部件 | 主体＋必要细节，不附无关尺寸/场景 |
| 同一事实的多个来源 | 选最小必要证明集合，不全部并入附件 |
| 多款式或多个实际视角 | 每个不可替代的信息有来源，可按需超过常见张数 |
| 6 MiB 不足容纳唯一必要视觉证据 | 明确原因，不静默丢证据或广播全部图片 |
| 同名不同内容／不同名相同内容 | 不误合并独有来源／不重复发送相同信息 |
| 两个相同握车把近景，文案讲不同卖点 | 报告重复并只修冲突项 |
| 高置信重复两轮修复后仍未解决 | 保留任务为待调整，不自动发图，其他合格项正常，数量同步 |
| 同一部件的微距与真实使用动作 | 保留独立用途，避免误报 |
| CG 与功能效果图 | 默认纯白，重构姿态/相机与任务，主体材质及表面归属正确 |
| 严格白底商品展示 | 无概念热流、新增文案或额外道具，不冒称已获 Amazon 审核 |
| 新预览→生成→保存→补图 | 最终提示词、附件编号/用途和商品身份一致 |
| 历史冻结／用户锁定／信息图重构／SKU | 分别保持原始输入、手动内容、单源重构和款式边界 |

## 验证边界

公开 Amazon 帮助页请求返回了不可用于核验完整政策的页面，未将未经核实的类目例外或平台合规结论写入系统。白底默认、禁止主图概念特效和不得冒称已合规是本提案的应用约束。真实生成质量及最终平台审核仍需独立验收。

## 实现后反例复核

在同一仓库 fixture 和相同纯函数复现代码下，当前结果为：

```json
{"case":"simple-white","factIds":["appearance","control","fingers"],"attached":["gloves.png"]}
{"case":"same-motorcycle-grip-different-selling-points","duplicateIssues":[{"code":"duplicate-task","itemId":"ai-3","sourceIndex":3,"message":"与第 1 张的购买问题、动作或证据表达重复；改变背景或用途措辞不能算新增任务。","similarItemId":"ai-1","confidence":"high"}]}
{"case":"cg-prompt","hasWhiteBackground":true,"hasRecomposition":true}
```

简单白底从 3 张附件降为 1 张，原始 control/fingers 事实及其溯源仍保留；同一握把近景变为 high-confidence duplicate-task；CG 的白底与重构指令均存在。

## 已通过的专项验证

- 新增 creation-visual-reference-needs.test.mjs：20/20 通过，覆盖白底、参数文字来源、独有细节、替代来源、复合事实的不同部件/开合状态、九张必要视图、内容去重、预算、提示词引用、冻结、待调整、手机动作及 CG/功能画面差异。
- 扩展聚焦回归：229/229 通过，包含既有规划、平台、部分有效计划及 HTTP 生成/补图流程。
- creation-marketing-e2e.test.mjs 已独立通过：新计划精简参考、九张必要参考、三张生成加一张重复待调整、待调整项不能补图，以及 v0.2.116 旧队列指纹和原提示词的生成与补图均有实际 HTTP mock 断言。
- 进度面板 DOM 测试覆盖“重复画面待调整 · 其他合格项可继续”，预览槽位文案校验已同步白底、重构与光效方向。
- 代码语法和中文 UTF-8 检查已通过，未发现异常替换字符。公共模块 134 项同步检查和 v0.2.117 发布事实检查通过。

专项验证中的模型调用均由隔离本地 HTTP mock 提供，不是用户真实接口。测试证明规划、请求、记录和补图契约，不证明真实生成图的白底像素、光效质量、动作一致性或 Amazon 审核通过。

## 构建与运行边界

当前 package.json 无 build:pages 脚本，仓库 CI 也未将其作为构建入口，因此没有运行或声称通过该命令。本次没有打包 Electron 安装包，没有重启正在运行的用户服务。源码更新在加载新代码后对新规划生效；已有冻结计划继续沿用原输入。

## 最终串行全量验证

- 命令：npm test。
- 结果：3030 tests，3030 pass，0 fail，0 skipped，耗时约 465 秒。
- 日志：test-results/creation-visual-verified-full.log（本地忽略的验证产物，不纳入源码提交）。
- 单独复核新增专项：20/20；独立 HTTP 测试包含新旧冻结计划、生成、保存、补图和重复项阻断，全部通过。
- 单独复核预览文案与模型列表路由：2/2，通过；未修改无关模型路由逻辑。
- 版本维护检查：v0.2.117，公共模块 134 项一致，代码语法及中文编码检查通过。

## 规范归档

- 已归档至 2026-11-05-reduce-creation-reference-noise-and-scene-repetition。
- creation-mode 主规格合并 3 项新增、5 项修改，保留原场景名称及其他既有场景。
- 归档后 OpenSpec 严格检查：69/69 通过；其他活动变更未归档。
- 归档后公共模块检查 134 项一致、v0.2.117 发布事实检查及 git diff --check 均通过。
