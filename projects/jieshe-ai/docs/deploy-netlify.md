# 戒社 AI · Netlify 部署指南

> 本目录是戒社AI的「公开部署版」：去掉了全部语音功能，模型默认走 OpenRouter（密钥保存在服务端环境变量，不进入前端代码），任何人打开链接即可对话。

## 一、版本差异（相对本地版 app/）
- ❌ 移除：语音输入（麦克风）、自动朗读/朗读按钮、金句试听、语音引擎设置
- ✅ 保留：三大功能（忏悔室/问答/闲聊，提示词为蒸馏定稿版）、流式对话、停止/重新生成/复制、会话历史（浏览器 localStorage 按日分组+搜索）、危机护栏横幅、求助热线、亮/暗/自动主题、移动端抽屉、快捷键 Ctrl+N / Ctrl+K
- 🖼 图标：web/icon.jpg（用户提供的头像图），用于 favicon、侧栏品牌标、助手头像
- ⚙ 设置：仅剩「模型 ID / 温度 / 最大输出」三项（存浏览器 localStorage）

## 二、部署步骤（二选一）

### 方式 A：Git 仓库导入（推荐，长期维护）
1. 把整个项目推到 GitHub/GitLab（注意：不要提交 pipeline/cookies.txt 与 app/config.json 里的密钥！部署只需要 web/、netlify/、netlify.toml 三个部分，其余目录在 .gitignore 或复制到新仓库即可）。
2. 打开 app.netlify.com → Add new site → Import an existing project → 选仓库。
3. Build settings 自动读取 netlify.toml（publish=web，functions=netlify/functions），无需手填。
4. Deploy。

### 方式 B：Netlify Drop（拖拽，最快）
1. 在项目根目录执行（或手动打包）：把 web/ 文件夹、netlify/ 文件夹、netlify.toml 放进一个文件夹里，整体拖到 app.netlify.com/drop。
2. Netlify 会识别 netlify.toml 并部署静态文件与 Function。

## 三、配置环境变量（关键！）
1. 去 openrouter.ai/keys 创建一个 API Key。
2. Netlify 控制台 → 你的站点 → Site configuration → Environment variables → Add：
   - 名称：OPENROUTER_API_KEY，值：你的 OpenRouter 密钥（必填）
   - （可选）OPENROUTER_MODEL：默认已内置 deepseek/deepseek-chat（付费模型，价格很低），可整体覆盖默认模型
3. 保存后点击 Deploys → Trigger deploy（重新发布使变量生效）。

## 四、函数超时设置（重要！）
OpenRouter 免费模型回复较慢，默认函数超时 10 秒可能不够：
- Site configuration → Functions → Time limit 调大到 26 秒（免费额度上限）。
- 或让访客在设置里改用更快的付费模型（如 deepseek/deepseek-chat）。

## 五、本地预览（可选）
1. npm i -g netlify-cli
2. 设置环境变量后运行：netlify dev
3. 打开 http://localhost:8888

## 六、费用与安全提醒
- 流量走你自己的 OpenRouter Key，模型为付费模型（每次对话约几厘钱到几分钱）；务必在 OpenRouter 后台设置消费上限。
- 别把 OPENROUTER_API_KEY 写进任何提交到公开仓库的文件，只用 Netlify 环境变量。
- 本站含危机干预内容，已内置自杀护栏（触发关键词时横幅显示 12356 等求助热线）。
