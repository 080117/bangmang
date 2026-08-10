---
name: citlali-qq-bot
description: 维护基于 NapCat(OneBot v11) + Node.js/TypeScript 的 QQ 机器人，人格为《原神》茜特菈莉（身份认同式扮演，默认称呼对话者为“旅行者”）。涵盖：项目位置与启动/重启、config.json 人设与回复长度配置、平台搜索工具（必应/B站/微博/知乎）、Cookie 抓取（Playwright 读真实 Chrome 配置 + QQ 内 /cookie 命令）、Windows 常见排障（编码、Chrome 独占锁、tool 消息报错等）。当用户提到“QQ 机器人”“茜特菈莉”“/cookie”“微博/知乎/B站搜索”“回复太长/太短”“聊天机器人人设”等话题时使用。
---

# Citlali QQ Bot（茜特菈莉人设 QQ 机器人）

## 概述
基于 NapCat + Node.js 的 QQ 智能机器人，人格为《原神》茜特菈莉本人。机器人独立运行、不依赖 Codex：对话走 DeepSeek API，消息收发走 NapCat(OneBot v11 反向 WebSocket)。

## 项目位置与运行
- 项目根目录：C:\Users\29234\Documents\ChatGPT\机器人
- 一键启动：桌面快捷方式「启动QQ机器人.lnk」→ scripts/start-bot.ps1（检查是否已在运行、缺 NapCat 则自动拉起、缺编译产物则 npm run build，然后前台 node dist/index.js，Ctrl+C 停止）。
- 手动：npm run build 后 node dist/index.js；开发态 npm run dev。
- 后台重启流程：结束所有命令行含 dist/index.js 的 node 进程 → 把 data/agent.log、data/agent.log.err 改名备份 → Start-Process（-WindowStyle Hidden + -RedirectStandardOutput/-RedirectStandardError）启动。
- 依赖：Node.js（C:\Users\29234\AppData\Local\hermes\node\node.exe）、NapCat + QQ 登录、.env（DEEPSEEK_API_KEY）、能访问 DeepSeek 的网络。
- 注意：计划任务 NapCatAgentBot 存在但从未成功运行；机器人一直由脚本/手动启动。

## 配置
### .env
DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL（默认 https://api.deepseek.com）、DEEPSEEK_MODEL（deepseek-chat）。

### config.json 关键项
- llm.system_prompt：茜特菈莉人设（完整文本见 references/persona-prompt.md）。要点：身份认同“你就是茜特菈莉本人”；默认把对话者当“旅行者”；回复长度分场景（闲聊一句话为主 ≤30 字、正经询问 ≤100 字）；“别动不动就喝酒”。
- llm.max_tokens：300（控制回复长度）。
- tools.enabled：get_time, weather, web_search, bili_search, weibo_search, zhihu_search, memory_save, memory_recall。
- reply.*：命令前缀 /、群聊模式 at_or_reply 等。
- 改完 config.json 必须重启机器人才生效（配置只在启动时加载一次）。

## 工具
工具在 src/agent/tools/，注册表 src/agent/tools/index.ts，按 config.json → tools.enabled 启用，模型自动获得工具描述。
- web_search：必应搜索（国内可用；不要用 DuckDuckGo，国内会超时）。
- bili_search：B站公开搜索接口，无需登录。
- weibo_search / zhihu_search：需要 data/cookies/{weibo,zhihu}.cookie.txt（见“Cookie 抓取”）。
- get_time / weather（wttr.in）/ memory_save / memory_recall。
- 新增工具：新建 src/agent/tools/xxx.ts（导出 BotTool），加入 index.ts 的 allTools，并在 config.json 启用。

## Cookie 抓取（微博/知乎）
- QQ 命令：管理员发 /cookie weibo|zhihu|all（私聊仅超管；群里管理员，且 @机器人 /cookie weibo 也能识别）。
- 脚本：scripts/get-cookie.mjs --real-profile --site weibo --timeout 180。
- 原理：不解密浏览器数据库（新版 Chrome 独占锁定且 v20 加密），而是用 Playwright 以真实 Chrome 配置（--user-data-dir=%LOCALAPPDATA%\Google\Chrome\User Data --profile-directory=Default）启动，经 CDP 直接读 Cookie。
- 前提：必须完全关闭 Chrome（脚本检测到 Chrome 运行会提示并退出，不代劳关闭）。
- 保存：data/cookies/{site}.cookie.txt（name=value; ...）与 .json。检测标记：微博 SUB、知乎 z_c0。
- /cookie 实时回传 [msg] 进度；超时（默认 180s）会返回“当前 cookie 名”诊断。
- 排障：一直“未检测到登录” → 先确认该账号在 Default 配置里确实已登录（打开 weibo.com 看头像）；必要时用独立窗口模式（不传 --real-profile，在新窗口登录一次）。

## 常见排障
- PowerShell 5.1 脚本中文乱码/语法错：.ps1 必须用 UTF-8 带 BOM 写（[System.IO.File]::WriteAllText($p, $c, [Text.UTF8Encoding]::new($true))）。
- 中文经管道传给 node/python 变 ?：不要通过 stdin 管道把中文脚本喂给 node/python；用 [System.IO.File]::WriteAllText 写文件再运行；校验文件用纯 ASCII + \uXXXX 转义。
- 大模型报 tool must follow tool_calls：会话历史残留孤立 tool 消息导致；src/agent/agent.ts 的 sanitizeHistory() 发送前会丢弃 tool 消息与带 tool_calls 的 assistant 消息。
- @机器人 命令不生效：src/events.ts 的 stripLeadingSelfAt() 去掉开头 @自己 后再判断命令前缀。
- 微博/知乎搜不到：先看 data/cookies/ 有没有对应 cookie；过期/风控会返回明确提示，重跑 /cookie。
- B站搜索偶发风控（-412）：提示稍后再试即可。

## 资源
- scripts/get-cookie.mjs：Cookie 抓取脚本（Playwright，真实 Chrome 配置）。
- scripts/start-bot.ps1：一键启动器（桌面快捷方式指向它）。
- scripts/launch-napcat.ps1：NapCat 启动脚本。
- references/persona-prompt.md：当前茜特菈莉人设完整提示词。
- references/config-notes.md：配置字段、工具与排障细节。
