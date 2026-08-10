# 技能区

本地 Codex 技能备份，来源为 `C:\Users\29234\.codex\skills`。

当前备份包含 1844 个技能目录、6450 个文件，约 104 MB；已排除系统自带的 `.system` 目录。

## 同步本地技能

```powershell
robocopy "C:\Users\29234\.codex\skills" "skills" /E /XD "C:\Users\29234\.codex\skills\.system" /NFL /NDL /NJH /NJS /NP
```
