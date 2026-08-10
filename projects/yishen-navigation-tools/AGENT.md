# AGENT.md

## 唯一 GitHub 账号

- 本项目唯一 GitHub 账号：用户名 `080117`，账号 ID `307566469`。
- 本项目所有 GitHub/Git 操作必须使用该账号，禁止使用或切换其他 GitHub 账号。
- 使用 Windows 凭据管理器中已保存的 `git:https://github.com` 凭据（用户 `080117`）；未经明确许可不得删除、覆盖或重新登录该凭据。

## Git 提交身份

- 本仓库提交前必须确保仓库级配置为 `user.name=080117`、`user.email=080117@users.noreply.github.com`，不依赖全局配置（全局和仓库级身份均已统一为 `080117`）。
- 若仓库级提交身份缺失或与上述不符，先执行：

```bash
git config user.name 080117
git config user.email 080117@users.noreply.github.com
```

再提交。

## 远程仓库约定

- 本工作区远程命名固定为：`origin` 指向 `EmenWebsiteCollection/yishen-navigation`（原项目），`fork` 指向 `080117/yishen-navigation`（个人 fork）。
- 不要直接推送到 `origin/main`；功能分支先推到 `fork`，再向 `origin` 创建 PR。

## 已有功能提醒

- 开始开发新功能前，先检查代码库、现有页面、数据库迁移和文档，确认目标功能是否已经存在。
- 如果发现要做的功能已经存在或已有类似实现，必须先提醒用户，说明已有入口和实现位置，再决定是否继续开发；不能直接重复实现。

## GitHub 协作工作流

### 提交前

- 从当前 `main` 创建功能分支，不要直接在 `main` 上提交：

```bash
git switch -c feat/<功能描述>
```

或：

```bash
git switch -c fix/<修复描述>
```

- 开发完成后运行 `npm run build`；如项目配置了 lint，也一并运行。
- 用仓库级身份 `080117` 提交代码。

### 推送（Windows 凭据）

- 本机默认凭据选择器可能卡住，统一改用 Windows 凭据管理器 `wincred` 推送：

```powershell
$empty = Join-Path $env:TEMP "empty.gitconfig"
New-Item -ItemType File -Path $empty -Force | Out-Null
$env:GIT_CONFIG_SYSTEM = $empty
$env:GIT_TERMINAL_PROMPT = '0'
git -c credential.helper=wincred push -u fork <分支名>
```

### 创建 / 更新 PR

- 用 UTF-8 JSON 文件传标题和描述，避免中文乱码；在 workspace 根目录写 `pr-patch.json`，字段为 `title` / `body`，body 中可写 `Closes #issue-number`。
- 创建 PR：

```bash
node github-pr.mjs create EmenWebsiteCollection/yishen-navigation 080117:<分支名> main
```

- 更新已有 PR：

```bash
node github-pr.mjs update EmenWebsiteCollection/yishen-navigation <PR号>
```

- 等待管理者审核，不自行合并。

### 撤销工作流

- 未提交改动：

```bash
git restore <file>
```

撤销全部未提交改动用 `git restore .`；仅取消暂存用 `git restore --staged <file>`。

- 未推送提交：

```bash
git reset --soft HEAD~1
```

保留改动为已暂存；如需保留为未暂存，用 `git reset --mixed HEAD~1`。不主动使用危险的重置或清理命令。

- 已推送或已合并：

```bash
git revert <commit>
```

产生新的撤销提交，推送到同一功能分支并更新 PR。不重写公共历史，不强推。
