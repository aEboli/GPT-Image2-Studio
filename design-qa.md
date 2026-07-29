# 商品图采集设计 QA

## Studio 批次卡片完整预览与双区操作栏

- 源视觉真值：`artifacts/design-qa/studio-import-card-reference-full.png` 与 `studio-import-card-reference-actions.png`，来自用户提供的 Studio 批次全景和卡片局部标注。
- 实现截图：`artifacts/design-qa/studio-import-card-contain-implementation-720x878.png`；桌面截图：`studio-import-card-contain-implementation-2559x1314.png`；窄屏截图：`studio-import-card-contain-implementation-390x844.png`。
- 视口与状态：卡片局部 `720×878`；桌面 `2559×1314`；窄屏 `390×844`。Studio 批次弹窗打开，使用同源受限代理加载 Amazon 真实 `1448×1671` 商品图，主图、详情图和 SKU 图均处于已选状态。
- 完整对照：`artifacts/design-qa/studio-import-card-contain-full-comparison.png`。两侧使用同一桌面视口；测试清单仅保留 3 张代表图，因此完整对照只判断弹窗尺寸、网格密度和卡片结构，不把商品内容数量差异当作视觉漂移。
- 聚焦对照：`artifacts/design-qa/studio-import-card-contain-focused-comparison.png`。左侧为用户标注的旧卡片，右侧为当前实现卡片；卡片媒体区和底部操作栏均清晰可读，无需额外裁片。

### Findings

- 最终对照没有发现可执行的 P0、P1 或 P2 问题。
- 非 1:1 图片在固定方形媒体区内计算为 `object-fit: contain`，背景为 `rgb(255, 255, 255)`；`1448×1671` 原图完整可见，左右留白而未裁切或拉伸。
- 分类、序号和尺寸从图片覆层移到下方左侧信息块；放大按钮固定在右侧 `42px` 独立块，中间边界清楚，文字不再遮挡商品图。
- `2559×1314` 下弹窗为 `1980×1180px`，网格计算为 8 列、单卡约 `231px`；`390×844` 下弹窗为 `372×826px`，网格回退 2 列，页面和卡片均无水平溢出。
- 加载失败文案默认通过 `hidden` 离开可访问树，仅在真实图片错误时显示；成功图片的复选框名称保持为“主图 1”等正常文本。

### 必查表面

- 字体与排版：沿用现有 12px 分类标签和 10px 元数据，字重、行高和零字距保持一致；左侧信息块对齐明确，窄卡片内没有文字覆盖或撑宽。
- 间距与布局：媒体区继续固定 1:1；操作栏为 `minmax(0, 1fr) 42px` 两列，桌面 8 列和窄屏 2 列都保持稳定。
- 颜色与视觉令牌：图片展示面使用纯白，信息与操作区继续使用现有深色面板、边框和悬停令牌，没有引入新的主题色。
- 图片质量与资源：验证图从同源受限代理加载，保留自然尺寸与原始宽高比；卡片显示修改不改变查看、导入或下载使用的原始 URL。
- 文案与内容：保留“主图/详情图/SKU 图 + 序号”和尺寸或规格值；新增“图片加载失败”只属于真实错误状态。

### 交互与浏览器检查

- 右侧“放大查看主图 1”按钮唯一可定位，点击后查看器打开并继续使用 `/api/product-image-collector/image` 同源代理；关闭后正确返回批次列表。
- 当前 Studio 页面控制台 `warn/error` 为 0；成功图片不再错误暴露加载失败的可访问名称。

### 对照历史

1. 用户标注中的旧卡片使用 `cover` 并把分类和尺寸压在图片底部；底部操作栏只有居中的放大按钮。
2. 首轮实现改为纯白 `contain` 媒体区，并把操作栏拆为左信息、右放大两个区域；宽窄视口未发现 P0、P1 或 P2 视觉问题。
3. 可访问性复核发现透明的失败文案仍会进入成功图片名称；最终实现改为默认真实隐藏、失败时再显示，视觉结果不变，复核通过。

### Open Questions

- 无阻塞项。完整对照的商品内容不同于用户截图，但聚焦卡片使用相同结构和交互状态，足以验证本次明确要求的完整显示与双区操作栏。

final result: passed

## v1.1.18 标题分工与图片信息条

- 源视觉真值：`artifacts/design-qa/product-image-panel-v1.1.18-reference.png`，来自用户提供的 1688 商品页截图。
- 实现截图：`artifacts/design-qa/product-image-panel-v1.1.18.png`；窄面板截图：`product-image-panel-v1.1.18-narrow.png`。
- 验收页面：`artifacts/design-qa/product-image-panel-v1.1.18.html`，直接加载当前 `extensions/product-image-collector/floating-panel.js` 和仓库内真实商品测试图片。
- 视口与状态：完整视图 `1707×932`，窄面板 `480×844`；1688、5 张主图、7 张详情图、3 张 SKU 图，共 15 张且全部加载成功。
- 完整对照：`artifacts/design-qa/product-image-panel-v1.1.18-comparison.png`；头部与首行卡片局部：`product-image-panel-v1.1.18-panel-comparison.png`；信息条局部：`product-image-panel-v1.1.18-metadata-comparison.png`。三组图均把目标与实现放入同一比较输入后检查。

### Findings

- 最终对照没有发现可执行的 P0、P1 或 P2 问题。
- 左侧显示 `跨境新品 Quirky Cat Vase 精致的古怪小猫花瓶家居桌面树脂摆件`，不再显示末尾 `——1688`；清单数据仍保留完整标题，未改变复制、下载、文件夹或文件名输入。
- 右侧标题块显示 `GPT-Image2-Studio` 和 `1688`。完整视图中标题右边界为 `1513.24px`、标题块左边界为 `1536.67px`；标题块右边界为 `1632.67px`、操作区左边界为 `1638.67px`，没有重叠。
- `480×844` 窄面板中商品标题自然换为两行，`clientHeight / scrollHeight` 均为 `30px`；标题、平台块和操作区仍无重叠，面板水平溢出为 `0`。
- 图片名与分辨率共用的信息条计算样式为 `rgba(248, 250, 252, 0.64)` 和 `blur(2px)`。同框局部可见图片纹理继续透过，深浅图片上的文字仍保持可读。

### 必查表面

- 字体与排版：沿用现有微软雅黑/Segoe UI 字体、字号、行高和字重；只改变标题内容分工，没有引入缩放字号或负字距。
- 间距与布局：右侧 96px 标题块使用网格居中；宽窄视口下头部边界、卡片网格和底部操作栏均无重叠或水平溢出。
- 颜色与视觉令牌：信息条保留浅灰中性色与深色文字，把背景不透明度从 `0.88` 降至 `0.64`，模糊从 `4px` 降至 `2px`，视觉更轻但对比仍足够。
- 图片质量与资源：15 张仓库真实测试图片均以 `object-fit: contain` 加载，没有占位图、裁切、拉伸或 URL 改写；验收图片内容与用户商品不同属于隔离测试数据差异，不是采集器 UI 漂移。
- 文案与内容：左侧只保留商品标题，右侧由“商品图采集”改为平台名称；选中数、分组名称、图片名、分辨率和操作文案保持原契约。

### 交互与浏览器检查

- 当前面板版本为 `1.1.18`，15 个卡片节点及 15 张图片全部完成加载；面板宽屏宽度为 `529.27px`，水平溢出为 `0`。
- 页面与商品图采集器控制台没有错误或警告。Chrome 日志中两条 `Failed to fetch` 来自无关的已安装扩展 `hdgbmcpjcflbhcgdgbdaooeohnjfabhi`，调用栈不包含本项目页面、验收脚本或采集器脚本。

### 对照历史

1. 用户截图中的旧头部把 `——1688` 留在左侧标题末尾，右侧仍显示“商品图采集”，图片信息条遮挡较重。
2. `v1.1.18` 首轮同框对照已实现左侧纯商品标题、右侧居中平台名和更透明的信息条；宽屏及窄屏均未发现需要二次修正的 P0/P1/P2 差异。

### Open Questions

- 无阻塞项。最终验收页加载当前工作区脚本；Chrome 已安装的解压插件若未自动更新，仍需在扩展管理页重新加载 `artifacts/extensions/product-image-collector-unpacked` 才能看到同一版本。

final result: passed

## v1.1.10 完整规格名与纯平台标题

- 隔离验收页：`artifacts/design-qa/product-image-panel-v1.1.10.html`；完整截图：`product-image-panel-v1.1.10.png`；面板裁片：`product-image-panel-v1.1.10-crop.png`。
- 标题完整显示为 `大门插销铁门栓门扣大门门栓铁插销镀彩锌门栓6寸8寸10寸分体插销——1688`，标题 `clientHeight / scrollHeight` 为 `30 / 30px`，没有弯引号、直引号、截断或隐藏内容。
- 第一行四个规格名分别为 `老式6寸门栓【200个/件】`、`老式8寸门栓【120个/件】`、`老式10寸门栓【80个/件】`、`老式12寸门栓【60个/件】`，统一计算字号为 `9.1px`。
- 第二行四个更长规格名统一计算字号为 `7.8px`。两行共 8 个节点均为 `clientWidth = scrollWidth = 119px`，证明全部字符完整容纳且没有省略号；同一行字号完全一致，不同行按本行最长名称独立计算。
- 12 张真实图片全部成功加载，四张非 1:1 详情图继续保持白底 `contain`；面板宽 `529.27px` 且没有水平溢出。

final result: passed

## v1.1.9 标题与卡片验收

- 真实 1688 页面 `838592338170`：工作区采集器输出 `T加厚201不锈钢 插销门栓门扣门锁式插销锁老式门大门明装厕所门——‘1688’`，没有混入代发、库存、退款或加购数据；8 个 SKU 名称按页面顺序保留。
- 真实 1688 页面 `823645312929`：标题同样只含商品名与一个 `——‘1688’` 后缀；46 个 SKU 均保留页面规格名称。
- 隔离验收页：`artifacts/design-qa/product-image-panel-v1.1.9.html`；完整截图：`product-image-panel-v1.1.9.png`；面板裁片：`product-image-panel-v1.1.9-crop.png`。
- `1707×876` 视口下面板为 `529.27×876px`，卡片媒体区约 `119×119px`，无水平溢出。
- 四张真实非 1:1 图片分别为 `800×1115`、`800×696`、`800×897`、`800×1173`，全部成功加载；计算样式为纯白背景和 `object-fit: contain`，截图中可见横向或纵向留白且图片主体没有裁切。
- 四张 SKU 卡片在信息栏与查看/下载按钮之间分别只显示 `2寸插销`、`3寸插销`、`4寸插销`、`5寸插销`，没有类别、序号或说明前缀。
- 卡片预览只改显示样式；查看器与下载仍读取 `item.url`，没有生成替代图片或改写原图数据。

final result: passed

## 对照目标

- 全屏视觉真值：`artifacts/design-qa/product-image-viewer-v1.1.8-reference-fullscreen.png`。
- 原始尺寸视觉真值：`artifacts/design-qa/product-image-viewer-v1.1.8-reference-original.png`。
- 原查看器问题截图：`artifacts/design-qa/product-image-viewer-v1.1.8-reference-current.png`。
- 标题问题截图：`artifacts/design-qa/product-image-viewer-v1.1.8-reference-title.png`。
- 实现截图：`artifacts/design-qa/product-image-viewer-v1.1.8-panel.png`、`product-image-viewer-v1.1.8-contained.png`、`product-image-viewer-v1.1.8-fullscreen.png`、`product-image-viewer-v1.1.8-original.png`。
- 合并对照：`artifacts/design-qa/product-image-viewer-v1.1.8-comparison.png`、`product-image-viewer-v1.1.8-fullscreen-comparison.png`、`product-image-viewer-v1.1.8-original-comparison.png`、`product-image-viewer-v1.1.8-title-comparison.png`。
- 验收页面：`artifacts/design-qa/product-image-viewer-v1.1.8.html`。
- 验收视口：`1707×876`；右侧面板实测 `529.27×876px`。
- 验收状态：17 张主图、10 张详情图、7 张 SKU 图，共 34 张；查看器使用真实 Temu CDN `1254×1254` 商品图。

## Findings

- 最终对照未发现可执行的 P0、P1 或 P2 问题。
- “全屏”按 cover 方式铺满整个插件舞台，实测缩放为 `1.606`，与图1的沉浸式裁切方向一致，不调用浏览器全屏。
- “原始尺寸”恢复未变换的 `scale(1)`，完整保留图片原始宽高比，与图2的完整图片方向一致。
- 全屏和原始尺寸各连续点击两次，前后 transform 分别保持 `1.606 / 1.606` 与 `1 / 1`；按钮始终可用、没有 `aria-pressed`、没有锁定类，鼠标点击后焦点已释放。
- 查看器没有左上角返回、图片标题、文件名或“第 N / 共 M 张”说明；右上角关闭、底部工具栏及左右切换按钮均为带轻微底色的半透明控件。
- 完整商品标题在 48px 头部内自然换为两行，标题高度 `29.69px`、滚动高度 `30px`，没有省略；标题下方不再存在独立数量节点。
- 六个按钮下方完整显示 `已选 34 / 共 34 张商品图 · SKU 共 7 个规格。`。

## 交互与浏览器检查

- 默认打开以 `scale(1)` 完整显示图片；全屏、原始尺寸和两者的连续重复点击均通过。
- 点击下一张后图片可访问名称从 `主图-1` 变为 `主图-2`，上一张恢复可用；边界禁用状态正常。
- 关闭按钮将查看器恢复为 hidden；图片外区域、双击和 Escape 的既有关闭契约未改动。
- 工具栏背景为 `rgba(248, 250, 252, 0.38)`，关闭和切换按钮背景为 `rgba(248, 250, 252, 0.68)`。
- 左切换按钮、226.33px 工具栏和右切换按钮之间没有重叠；全部位于面板边界内。
- 应用内浏览器控制台错误和警告均为 0。

## 必查表面

- 字体与排版：商品标题使用现有 11px 字号和 1.35 行高，允许任意长单词换行；状态行 10px 且可自然换行，没有截断或遮挡。
- 间距与布局：查看器取消独立头部和说明底栏，图片舞台得到更多空间；工具栏居中、切换按钮分置两侧、关闭按钮位于右上角。
- 颜色与状态：控制区由不透明白底改为浅色半透明加轻微模糊；命令按钮不保留选中、按下或锁定色。
- 图片与资源：使用真实 Temu 商品图片，没有占位图、CSS 图形或手绘资源；全屏 cover 与原始宽高比分工清楚。
- 文案与内容：删除返回、查看器图片说明和次序文案；保留中文 tooltip、可访问名称及完整采集统计。
- 图标与可访问性：关闭、前后切换和五项图片操作使用现有统一图标，`1:1` 保留参考界面文字；键盘触发仍保留焦点，只有鼠标命令在执行后释放焦点。
- 响应性与边界：529.27px 面板内控制区没有重叠或水平溢出，长标题只增加自身行数，不挤出右侧品牌及刷新/关闭按钮。

## 对照历史

1. 用户截图显示旧查看器把“全屏”和 `1:1` 当成持续选中状态，左上角返回与上下说明区占用空间，标题则单行截断并在下面重复显示数量。
2. 首轮实现将全屏改为 cover 并移除锁定类，但视觉对照发现 `1:1` 仍按自然像素放大到 `2.508`，与图2要求的完整原始宽高比不符；自动化点击后还保留了焦点轮廓。
3. 第二轮把 `1:1` 改为未变换的 `scale(1)`，并仅在鼠标点击命令后释放焦点，键盘焦点行为保持。最终全屏、原始尺寸、透明控制区、精简导航和完整标题均通过合并对照。

## Open Questions

- `v1.1.8` 查看器、`v1.1.9` 标题/卡片和 `v1.1.10` 动态规格字号结果均来自隔离加载的对应工作区脚本；Chrome 已安装实例仍需在扩展管理页手动重载最新解压目录后确认安装态表现。

## Follow-up Polish

- 无阻塞项。继续降低按钮底色会削弱复杂商品图上的辨识度，本轮透明度已在自然与清晰之间取得平衡。

final result: passed
## v1.1.20 批量复制成功提示

- Chrome 临时验收页直接加载当前 `v1.1.20` 面板脚本和 4 张真实 1688 商品缩略图；底部按顺序显示“复制到 Studio”“复制图片”“下载所选”。
- 点击“复制图片”后显示 `已复制 4 张图片`，计算背景为 `rgba(8, 118, 79, 0.78)`；提示位于插件边界内和页脚上方，不改变列表或三个按钮的位置，约 1.8 秒后恢复为 `opacity: 0`、`visibility: hidden`。
- 桌面视口中三个按钮等宽约 `166.7px`；CSS `480×845` 窄视口中三个按钮等宽 `150px`。两种状态下操作栏和面板均无水平溢出，提示不接触页脚。
- Windows 实际写入两张 PNG 后，`.NET Clipboard.GetFileDropList()` 返回 `Count=2`，两个临时文件均存在，证明复制结果是多个独立文件而不是合成图或首图回退。
- Chrome 已安装实例检查到 `v1.1.19`，包含第三按钮但不包含本次成功提示；由于扩展管理页不能由测试会话接管，仍需手动重新加载 `artifacts/extensions/product-image-collector-unpacked` 后完成最终安装态复核。

final result: implementation passed; installed v1.1.20 reload pending

## v1.1.22 Native Messaging 复制验收

- 最终构建包：`artifacts/extensions/GPT-Image2-Studio-Product-Image-Collector-v1.1.22.zip`；Chrome 当前稳定扩展 ID 为 `gbdkgkooddcicpkikaklapgeakhjjcan`，Native host 为 `com.aeboli.gpt_image2_studio.product_image_clipboard`。
- 在真实 1688 商品页 `1061922615487` 的 `v1.1.22` 安装态，面板识别并全选 31 张商品图；点击“复制图片”后状态行显示 `已复制 31 张图片，可直接粘贴到聊天软件。`，提示文本为 `已复制 31 张图片`。
- 通过 250ms 采样记录到提示状态：约 `750ms` 时 `data-visible="true"`，约 `2250ms` 时恢复 `data-visible="false"`；提示位于插件内部，不改变底部三按钮布局。
- Windows 系统剪贴板读取结果为 `Count=31`、`UniqueCount=31`、`ExistingCount=31`，31 个路径均指向临时批次中的独立图片文件。助手 `--self-test-filedrop 500` 返回成功，随后读取结果为 `Count=500`、`UniqueCount=500`、`ExistingCount=500`。
- Native host 的异步路径自检返回 `STA`；扩展聚焦测试 `35/35` 通过，并断言直接复制不查询 Studio 标签页或本地 HTTP 端点。最终 Chrome 验收在 Studio 页面未参与复制请求的情况下完成；未关闭用户现有 Studio 标签页，以避免丢失其未保存状态。

final result: passed; remaining OpenSpec item is the separately scoped closed-Studio manual check

## v1.1.23 悬浮入口与长批量响应

- 最终构建包为 `artifacts/extensions/GPT-Image2-Studio-Product-Image-Collector-v1.1.23.zip`（68,201 字节，SHA-256 `9D29E79ACD5E8A1A6E09A75BB5AE805B1196F822A6F760B1391DFE5CBF460B76`）；解压目录的入口、面板、后台和 Manifest 与工作区源码逐项一致，安装后的 Native host 与解压目录 EXE 哈希一致。
- 真实 Chrome 1688 商品 `1061922615487` 当前仍保留 `v1.1.22` 入口控制器，但从最终解压目录动态注入的面板已为 `v1.1.23`。未点击扩展栏 action，从网页入口连续关闭和打开 3 次，每次都只有 1 个入口、1 个面板和 31 张商品图；重新采集后仍为已选 `31 / 31`。
- 直接复制 31 张图片时，重新采集、清单复制、图片复制和下载命令处于禁用状态；全选、折叠、关闭和 31 个查看按钮全部保持可用。完成后状态为 `已复制 31 张图片，可直接粘贴到聊天软件。`，插件内提示为 `已复制 31 张图片`。
- 成功提示完成时为可见，约 2.25 秒后计算样式恢复为 `opacity: 0`、`visibility: hidden`；Windows FileDrop 剪贴板读取为 `Count=31`、`UniqueCount=31`、`ExistingCount=31`。最终安装助手的线程自检为 `STA`。
- 当前采集扩展 ID 没有匹配到新的 `warn/error` 日志。页面已有的 AliCDN 组件重复注册、1688 页面脚本错误和另一扩展 `hdgbmcpjcflbhcgdgbdaooeohnjfabhi` 的请求错误不属于本项目；缓存旧入口上下文在本轮验收前留有一条消息通道关闭记录。
- 站点级内容脚本清单仍需在 `chrome://extensions/` 对 `artifacts/extensions/product-image-collector-unpacked` 手动点击一次“重新加载”。该管理页不由浏览器测试会话接管，因此 Amazon 等商城从非商品页无刷新进入详情页的最终安装态验收仍保持待办；源码执行级回归已经覆盖进入、离开、超时恢复和失效 DOM 清理。

final result: implementation and dynamic panel passed; installed v1.1.23 manifest reload pending
