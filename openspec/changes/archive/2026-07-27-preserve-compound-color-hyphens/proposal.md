# Change: 保留复合颜色名称内部连字符

## Why

现有无标点规则把 `off-white` 规范成了 `off white`。这里的连字符属于颜色名称本身，并不是多种颜色之间的分隔标点，完全删除会改变标准颜色写法。

## What Changes

- 保留已识别复合颜色名称内部的单个连字符，例如 `off-white`。
- 不同颜色之间仍只使用空格，例如 `brown, black, silver` 仍规范为 `brown black silver`。
- 分隔两个独立颜色的连字符仍删除，例如 `brown-black/silver` 规范为 `brown black silver`。
- 更新参考分析和最终生成提示，允许颜色词内部连字符，但继续禁止其他标点和分隔连字符。

## Capabilities

### Modified Capabilities

- `creation-mode`: SKU 颜色标签允许复合颜色名称内部的必要连字符。

## Impact

- 受影响代码：共享颜色归一化器、Creation SKU 生成提示、参考分析提示及其测试。
- `colorNames` 数组、产品单位顺序、重复项和其他无标点规则不变。
- 无需迁移存量数据；历史标签再次分析或规划时按新规则归一化。
