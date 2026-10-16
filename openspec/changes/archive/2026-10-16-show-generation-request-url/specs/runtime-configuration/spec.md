## ADDED Requirements

### Requirement: 当前参数摘要显示生图请求 URL

当前生图参数摘要 SHALL 在请求发起 IP 下方增加 `Url :` 一行，显示所选生图通道的完整请求 URL，包含基础地址和当前协议后缀。该值 SHALL 复用实际生成请求的通道配置和 URL 拼接规则，且 SHALL NOT 包含 API Key。直连和 Grok 的图像协议后缀 SHALL 根据有无参考图显示 images/edits 或 images/generations。长 URL SHALL 在摘要值区域内自动换行。

#### Scenario: 切换当前生图通道

- **WHEN** 用户选择路由、直连、Gemini 或 Grok 生图通道
- **THEN** Url 行显示所选生图通道的完整接口地址
- **AND** 直连通道显示生图 API 地址，而非文本或视觉 API 地址

#### Scenario: 修改地址或协议后缀

- **WHEN** 用户修改当前通道基础地址、完整地址或协议后缀
- **THEN** Url 行同步更新为相应完整请求地址
- **AND** 完整地址中的协议后缀不会被重复拼接
