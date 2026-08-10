# 实现模式参考

## 配置

```json
{
  "memes": {
    "dir": "path/to/memes",
    "proactive_recipients": [],
    "proactive_all_groups": false,
    "proactive_excluded_groups": [],
    "context_aliases": {}
  }
}
```

- `dir`：表情包目录。
- `proactive_recipients`：主动表情包显式接收人。
- `proactive_all_groups`：是否同时发给所有群。
- `proactive_excluded_groups`：不接收主动消息的群。
- `context_aliases`：语境词到文件名的映射。

## 工具返回

```ts
interface ToolResult {
  text?: string;
  media?: MessageSegment[];
}
```

Agent 只取第一个 `image` 段，保证每条文本最多一张图。

## 语境匹配

- 文件名即语境；先查 `context_aliases`，再按文件名子串评分。
- 同分随机；没有匹配就返回纯文本，不随机兜底。
- 用户请机器人帮忙且能完成时，引导模型使用 `context="小事一桩"`。

## 图片缩放与限流

- 使用 `sharp` 把最长边缩放到 320px，输出 `base64://`。
- 全局 3 秒最多一张；被限流时只发文字。
- 普通对话表情包必须带文字；启动/关闭主动表情包除外。

## 生命周期

- 启动脚本写 `data/startup.request.json`，关闭脚本写 `data/shutdown.request.json`。
- 机器人每 500ms 检查请求文件；启动发“刚睡醒”，关闭发“睡觉了”后优雅退出。
- 主动发送跳过 `proactive_excluded_groups`。

## 特殊触发

- 重复内容：按群和用户记录相似文本，连续三次相似被@后发送。
- 被@时：先处理重复内容，再让 Agent 回复；仅当 Agent 未选其他语境表情包且超过 5 分钟无@时补发。
- “刚睡醒”“睡觉了”“被@”“重复内容”不应由普通 `send_meme` 工具调用。

## 建议测试

- 工具：匹配、别名、无匹配、保留语境拦截。
- Agent：图文同一条消息、每轮一张、3 秒限流。
- 事件：5 分钟冷却、三次相似触发、Agent 已选其他表情包时不发被@时、主动群发送与排除群。
