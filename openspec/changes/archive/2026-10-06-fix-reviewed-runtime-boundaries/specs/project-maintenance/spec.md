## ADDED Requirements

### Requirement: Concurrent record persistence remains valid and complete

套图、写真、文章插图和 PPT 清单 SHALL 按文件串行保存并原子替换；提示词历史追加 SHALL 串行保护整个读取、合并与写入事务。读取 SHALL 只看见完整的旧版本或新版本。

#### Scenario: Readers overlap manifest saves
- **WHEN** 同一清单被多个生成项保存且列表同时读取
- **THEN** 所有读取结果都是完整 JSON
- **AND** 最后提交的清单完整持久化

#### Scenario: Two analyses finish concurrently
- **WHEN** 两个提示词分析同时追加到同一历史文件
- **THEN** 两条成功返回的记录均被保留
- **AND** 后续读取可以解析完整历史
