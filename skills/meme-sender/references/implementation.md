# 实现参考

## 配置结构

```json
{
  "memes": {
    "dir": "path/to/memes",
    "proactive_recipients": [
      { "type": "private", "id": "OWNER_QQ" }
    ],
    "proactive_all_groups": true,
    "proactive_excluded_groups": [],
    "context_aliases": {
      "办不到的事情": "烦恼.jpg"
    }
  }
}
```

- `dir`：表情包目录，支持相对项目根目录或绝对路径。
- `proactive_recipients`：启动/关闭主动表情包的显式接收人。
- `proactive_all_groups`：为 `true` 时同时发给机器人所在的所有群。
- `proactive_excluded_groups`：不接收主动消息的群。
- `context_aliases`：把某个语境词映射到指定文件名。

## 工具返回类型

```ts
interface ToolResult {
  text?: string;
  media?: MessageSegment[];
}
```

工具 handler 可以返回 `string | ToolResult`。Agent 只取第一个 `image` 段，保证每条文本最多一张图。

## 语境匹配

1. 先把上下文关键词和文件名都规范化：转小写、去掉扩展名和常见标点。
2. 上下文按分隔符拆成多个词，文件名包含的词越多得分越高，同分随机。
3. 先查 `context_aliases`，别名命中直接返回对应文件。
4. 没有匹配就返回纯文本提示，不随机兜底。

### 小事一桩

- 用户请机器人帮忙做事，且这件事可以完成时，工具说明和系统提示应引导模型使用 `context="小事一桩"`。
- 做不到的事情不要使用这张图，正常说明无法完成。

## 图片缩放

- 使用 `sharp` 读取原图元数据。
- 按比例缩放，最长边不超过 320px。
- 输出为 `base64://` 图片段，避免临时文件残留。
- GIF 保留动图，PNG 保留透明通道。

## 限流

- 模块级记录 `lastMemeSentAt`，间隔小于 3000ms 时拒绝发送。
- 被限流时只发文字，不发图。
- Agent 每轮只收集一张图。

## Agent 媒体回复

```ts
if (media && tryAcquireMemeSlot()) {
  send([media, { type: "text", data: { text } }]);
} else {
  send(text);
}
```

文字为空时只发图；启动/关闭主动表情包不受“必须带文字”约束。

## 启动/关闭主动表情包

- 启动脚本写 `data/startup.request.json`，关闭脚本写 `data/shutdown.request.json`。
- 机器人每 500ms 检查请求文件。
- 启动请求：NapCat 连接后发送“刚睡醒”表情包。
- 关闭请求：发送“睡觉了”表情包后优雅退出，脚本最多等待 10 秒再强制停止。
- 主动发送跳过 `proactive_excluded_groups`。

## 特殊触发

### 被@时

- 按群记录 `lastAtAt`。
- 触发顺序：先检查连续三次相似被@的“重复内容”，再让 Agent 正常回复并返回是否选择了表情包。
- 仅当距上次被@超过 5 分钟、且 Agent 本次没有选择其他语境表情包时，才补发“被@时”表情包并带文字。
- 5 分钟内再次被@不重复发送。

### 重复内容

- 按群和用户记录相似文本连续次数。
- 文本归一化后比较字符集合的 Jaccard 相似度，阈值建议 0.6。
- 连续三次相似被@文本后发送“重复内容”表情包并带文字。

### 保留语境

“刚睡醒”“睡觉了”“被@”“重复内容”不应由普通 `send_meme` 工具调用，避免重复触发。

## 建议测试

- 工具：文件名匹配、别名、无匹配、保留语境拦截。
- Agent：图片+文字同一条消息、每轮只发一张、3 秒限流。
- 事件：5 分钟被@冷却、连续三次相似触发、Agent 已选其他表情包时不发“被@时”、主动群发送与排除群。
- 配置：默认值解析。
