---
name: meme-sender
description: Implement local meme/sticker sending for QQ/OneBot agent bots, including context-triggered memes, proactive startup/shutdown memes, repeated-@ and idle triggers, image resizing, and rate limits. Use when a bot should send memes from a local folder, or when extending an existing agent with meme tools.
---

# 表情包发送

## 概览

为 OneBot/QQ Agent 机器人添加本地表情包发送能力：Agent 按“即将回复的语境”选图并带文字发送，启动/关闭时可主动发送指定表情包，并支持“重复内容”和“被@时”两类特殊触发。

## 核心能力

1. 语境工具：新增 `send_meme` 工具，参数 `context`，按表情包文件名匹配；文件名与语境不一致时用 `context_aliases` 配置别名。
2. 媒体回复：工具返回 `ToolResult { text?, media? }`，Agent 把图片和文本合成一条消息发送。
3. 主动表情包：启动/关闭时通过请求文件触发，发给配置的私聊接收人和群聊。
4. 特殊触发：连续三次相似被@文本自动发“重复内容”表情包；5 分钟无 @ 后第一次被@自动发“被@时”表情包。
5. 帮忙语境：用户请机器人帮忙且能完成时，使用 `context="小事一桩"` 发送对应表情包。
6. 优先级：`被@时` 为低优先级，仅当 Agent 本次未选择其他语境表情包时才补发。
7. 限制：每条文本最多一张图，全局 3 秒最多一张；发送前把图片最长边缩放到 320px。

## 实现步骤

1. 阅读 [references/implementation.md](references/implementation.md)，按其中的配置与代码模式接入。
2. 在机器人配置中加入 `memes` 配置块，指向本地表情包目录。
3. 新增表情包工具并接入 Agent 媒体发送通道。
4. 接入启动/关闭请求文件和事件触发逻辑。
5. 添加测试覆盖匹配、限流、特殊触发与发送格式。

## 项目模板

`assets/project-template/` 提供可直接接入的通用源码模板：

- `meme.ts`：表情包工具、语境匹配、缩放、限流、主动发送。
- `tool-types.ts`：`ToolResult` 类型扩展。
- `agent.ts`：Agent 图片+文字回复通道，并返回是否选择了表情包。
- `events.ts`：重复内容、被@低优先级触发。
- `index.ts`：启动/关闭请求文件监听与优雅退出。
- `memes.config.example.json`：通用 `memes` 配置块。

接入时复制同名文件到机器人项目对应位置，合并配置，安装 `sharp`，并把 `send_meme` 加入 `tools.enabled`。

## 通用规则

- 文件名就是表情包使用语境，匹配不到就不发，不做随机兜底。
- 普通对话中的表情包必须同时带文本回复；启动/关闭主动表情包除外。
- skill 内不写死任何个人 QQ、群号或本机路径，统一使用占位符和配置。

## 资源

- `references/implementation.md`：完整实现模式、配置结构和触发规则。
- `assets/project-template/`：可直接复制的通用项目源码模板。
