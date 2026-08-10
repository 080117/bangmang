# 配置与工具细节（config-notes）

## config.json 结构（关键字段）
- self_id：机器人 QQ 号；owner：超管 QQ 号；admins：管理员列表。
- ws：NapCat 反向 WS 地址（host/port/path/token），需与 NapCat WebUI 配置一致。
- reply.group_mode：群聊触发模式（at / at_or_reply / all）；command_prefix：/；max_context_messages：20。
- llm.temperature：0.7；llm.max_tokens：300；llm.system_prompt：茜特菈莉人设（见 persona-prompt.md）。
- tools.enabled：get_time, weather, web_search, bili_search, weibo_search, zhihu_search, memory_save, memory_recall。
- weather.default_city：默认城市。

## 工具与平台
- web_search：必应 HTML 搜索（cn.bing.com 优先、www.bing.com 回退），解析 b_algo 块。
- bili_search：B站 /x/web-interface/search/all/v2，取 video 结果（标题/UP/播放量/时长/链接），无需登录。
- weibo_search：m.weibo.cn 搜索接口，需要 data/cookies/weibo.cookie.txt（标记 Cookie：SUB）。
- zhihu_search：www.zhihu.com/api/v4/search_v3，需要 data/cookies/zhihu.cookie.txt（标记：z_c0；签名需 d_c0）+ x-zse-96 签名（src/agent/tools/zhihu-sign.ts，移植开源实现）。
- memory_save / memory_recall：SQLite 长期记忆；weather：wttr.in。

## 管理员命令
- /ping /status /reset /memory list|clear /admin add|remove /mute /kick /task ...
- /cookie weibo|zhihu|all：抓取平台 Cookie（私聊仅超管；群聊管理员；@机器人 前缀也会被识别）。

## 启动/重启
- 桌面快捷方式「启动QQ机器人.lnk」→ scripts/start-bot.ps1。
- 手动：npm run build && node dist/index.js。
- 后台重启：杀 dist/index.js 进程 → 轮换 data/agent.log(.err) → Start-Process node dist/index.js（Hidden + 重定向日志）。

## 关键排障（速查）
1. 改 config.json 后必须重启。
2. PowerShell 5.1 写 .ps1 用 UTF-8 BOM，否则中文乱码/语法错。
3. 中文别经 stdin 管道喂 node/python（会变 ?）；用文件方式传。
4. 模型报 tool must follow tool_calls：会话历史工具消息已由 agent.ts sanitizeHistory() 清理。
5. @机器人 命令：events.ts stripLeadingSelfAt() 处理。
6. 微博/知乎搜不到：data/cookies/ 缺 cookie 或已过期 → 重跑 /cookie（先完全关闭 Chrome）。
7. 抓 Cookie 一直“未检测到登录”：确认账号在 Chrome Default 配置里已登录；可换独立窗口模式。
