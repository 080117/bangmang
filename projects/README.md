# 项目区

项目区使用 git submodule 收录独立项目，避免把各自 git 历史混进父仓库。

## 当前项目

- `yishen-navigation`：依神网站汇总
  - submodule URL：`https://github.com/080117/yishen-navigation.git`
  - 跟踪分支：`main`
- `yishen-navigation-tools`：该项目协作脚本与说明
  - `AGENT.md`：项目协作约定
  - `github-pr.mjs`：创建/更新 PR 的辅助脚本
  - `pr-patch.json`：PR 标题与描述（本地生成，不入库）

## 新增项目

```bash
git submodule add -b main <repo-url> projects/<name>
git commit -m "feat: add <name> submodule"
```

克隆本仓库后初始化子模块：

```bash
git submodule update --init --recursive
```
