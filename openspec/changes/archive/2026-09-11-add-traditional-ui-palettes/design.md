## 方案

命名配色通过 `data-palette` 选择器覆盖核心 CSS token；`data-theme="dark|light"` 保留给旧的明暗兼容规则。用户自定义颜色经过六位十六进制校验后写入 CSS 自定义属性，清空后回退到所选配色。

配色选择使用 `role="radiogroup"`/`role="radio"`，花卉开关和样式选择保持原生键盘行为。装饰使用现有 token 的低透明度 CSS 图形，挂在应用壳层并标记 `aria-hidden`，在强制颜色模式下隐藏。

首屏脚本只读取 allowlist 中的配色和纹样名称，并过滤自定义颜色；应用启动后由 `app.js` 同步控件状态及 localStorage。
