---
name: meme-workflow
description: Reusable workflow for designing and implementing local meme/sticker sending in an agent bot, covering context triggers, proactive startup/shutdown memes, repeated-@ and idle triggers, image resizing, rate limits, and tests. Use when planning or porting meme-sending functionality to any bot.
---

# Meme Workflow

## 概览

可复用的表情包功能落地流程：从分析机器人架构开始，到配置、实现、测试，适用于任何 OneBot/QQ 或其他 Agent 机器人。

## 工作流

1. 分析架构：定位工具注册表、消息发送 API、事件路由、配置加载、启动/关闭脚本。
2. 确定触发模型：
   - 语境触发：Agent 按即将回复的内容选图。
   - 主动触发：启动/关闭时通过请求文件发送。
   - 事件触发：连续三次相似被@、5 分钟无@后的低优先级被@。
3. 设计配置接口：`memes.dir`、`proactive_recipients`、`proactive_all_groups`、`proactive_excluded_groups`、`context_aliases`。
4. 实现核心：`ToolResult` 媒体返回、Agent 图文合并、单条消息一张图、全局 3 秒限流、最长边 320px 缩放。
5. 实现生命周期：启动/关闭请求文件轮询与优雅退出。
6. 实现事件触发：重复内容优先，`被@时` 低优先级，仅在 Agent 未选其他表情包时补发。
7. 测试与验收：匹配、别名、无匹配、限流、特殊触发、发送格式、配置默认值。

## 通用规则

- 文件名即语境，匹配不到就不发，不随机兜底。
- 普通对话表情包必须带文字；启动/关闭主动表情包除外。
- 不包含个人 QQ、群号或本机路径，使用占位符。

## 资源

- `references/workflow.md`：详细实现模式与代码片段。
