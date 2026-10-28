# Context

套图记录使用 `recordCheckedSetIds` 保存选择状态，而列表只渲染分页模型中的 `visibleSets`。全选必须从 `filterCreationRecordSets()` 取得完整筛选结果，不能从当前 DOM 复选框收集 ID，否则尚未加载显示的匹配记录会被遗漏。

# Decisions

- 按当前完整筛选集合计算全选状态与目标 ID。
- 全选时将筛选集合加入既有选择；取消全选时仅移除筛选集合中的 ID。
- 按钮显示“全选”或“取消全选”，并通过 `aria-pressed` 暴露当前筛选集合是否已全选。
