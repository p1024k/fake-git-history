# fake-git-history 绘图模式 · 使用说明

## 1. 这是什么

给 `fake-git-history` 增加了一个「绘图模式」：把一段**文字**或一个**图标**渲染到某一年的 GitHub/GitLab 贡献热力图上。

- **文字模式** `--text`：输入由 `A–Z` / `0–9` / 空格 组成的短文本（自动转大写）。
- **图标模式** `--draw`：从内置图库选一个图标（`cat` / `heart` / `mouse` / `smiley` / `star`）。

原理：在指定年份里，给若干天倒填提交，让这些天在贡献方格图里「亮起来」，从而拼出文字或图案。

---

## 2. 准备

从源码运行（无需全局安装）：

```bash
node src/cli.js <参数>      # 直接运行
npm start -- <参数>         # 等价
```

如果已经 `npm link` 或全局安装过：

```bash
fake-git-history <参数>
```

> **关键前置（决定提交能不能算进你的 GitHub 贡献）**
> 先把本地 git 身份设成你 GitHub 账号绑定的邮箱和名字，否则 GitHub 不认这些提交：
> ```bash
> git config --global user.name  "你的名字"
> git config --global user.email "你GitHub账号绑定的邮箱"
> ```

---

## 3. 快速开始（三步）

### 第一步：先预览（不会真的提交）

```bash
node src/cli.js --preview --text "HI" --year 2025
```

在支持颜色的终端里，会打印这一年的方格图（约 53 列 × 7 行），`HI` 以**深绿色方块**显示在浅色背景上、居中。

> **关于预览颜色**：预览靠颜色区分「有提交的绿格」和「空格（近白色）」。
> 如果把输出重定向到文件、或在不支持颜色的环境里看，所有格子看起来都一样——这**不是 bug**，在正常终端里就是绿色字母。

### 第二步：确认无误后，真正生成提交

```bash
node src/cli.js --text "HI" --year 2025
```

这一步会在**当前目录创建/覆盖 `my-history/` 文件夹**，里面是一个带倒填日期提交的 git 仓库。

> ⚠️ 它会先 `rm -rf my-history`（如果已存在），**别在重要目录里跑**。

### 第三步：推到 GitHub

1. 在 GitHub 新建一个**空仓库**（public，或开启 private contribution 显示）。
2. 把生成的仓库推上去：

```bash
cd my-history
git remote add origin <你的空仓库地址>
git branch -M main
git push -u origin main
```

3. 等 GitHub 几分钟重新计算，贡献图里就会出现图案。

---

## 4. 参数说明

| 参数 | 简写 | 类型 | 默认 | 说明 |
|---|---|---|---|---|
| `--text` | `-t` | 字符串 | — | 要渲染的文字（自动转大写） |
| `--draw` | — | 字符串 | — | 图标名：`cat` / `heart` / `mouse` / `smiley` / `star` |
| `--year` | `-y` | 数字 | 上一年 | 目标年份，范围 `2000` ~ `当前年-1` |
| `--preview` | `-p` | 布尔 | `false` | 只预览、不生成提交 |
| `--commitsPerDay` | `-c` | 字符串 | `"0,4"` | 控制每个「点亮天」的提交数（取上界） |

**规则：**
- `--text` 和 `--draw` **二选一**，不能同时给。
- 绘图模式下 `--frequency` / `--distribution` 被忽略（需要精确控制）；`--startDate` / `--endDate` 会被目标年份覆盖。
- 不带 `--text` / `--draw` 时，跑的是**原来的随机提交生成**（完全向后兼容，旧行为不变）。

---

## 5. 文字模式

- 字体：5×5 像素字体，支持 **`A–Z`、`0–9`、空格**。输入会自动转大写。
- 不支持的字符（标点、中文等）会被**跳过**并打印一行警告，不影响其余字符。
- **长度上限：8 个字符**（空格也算一个）。一年只有约 53 列，5 宽字体 + 字符间隔，每个字符约占 6 列。
- 字母出现在**周一到周五**那几行（垂直居中），整段文字水平居中。

```bash
node src/cli.js --preview --text "CAT"        # OK
node src/cli.js --preview --text "GIT HUB"    # 7 字符（含空格），OK
node src/cli.js --preview --text "I LOVE GIT" # ❌ 10 字符，报错
```

---

## 6. 图标模式

内置 5 个图标：

```bash
node src/cli.js --preview --draw cat    --year 2025
node src/cli.js --preview --draw heart  --year 2025
node src/cli.js --preview --draw mouse  --year 2025
node src/cli.js --preview --draw smiley --year 2025
node src/cli.js --preview --draw star   --year 2025
```

图标水平 + 垂直居中。名字写错会列出可用图标。

---

## 7. 提交密度 `--commitsPerDay`

- 格式 `"min,max"`，绘图模式取 **max** 作为每个「点亮天」的提交数。默认 `"0,4"` → 每个点亮天 4 条提交。
- 想让绿格颜色更满、提交总数更多，调大上界：`-c "0,9"`。
- 上界至少为 1：`-c "0,0"` 会被拒绝（图案会看不见）。
- **注意**：图案是「亮 / 不亮」二值的，调大密度只会让总提交数变多、让「亮」的那天颜色更饱满，**不会改变字母形状**。

---

## 8. 常见错误

> 当前报错以 Node 堆栈形式打印，**关键信息在首行 `Error:` 之后**，看那一句即可。

| 触发场景 | 错误信息 |
|---|---|
| 文字超过 8 字符 | `Text too long: "HELLO WORLD" has 11 characters. Maximum is 8 characters. Shorten the text.` |
| 年份越界 | `Invalid year 2026. Must satisfy 2000 <= year < 2026.` |
| 未知图标 | `Unknown icon "dragon". Available: cat, heart, mouse, smiley, star.` |
| 同时给 `--text` 和 `--draw` | `Flags --text and --draw are mutually exclusive. Use one.` |
| 文本全是非法字符 | `Nothing to render: the text produced no drawable pixels.` |
| `--commitsPerDay` 上界 < 1 | `--commitsPerDay upper bound must be >= 1 for draw mode (got 0).` |

---

## 9. 限制与注意事项

- 字体是 5×5，少数字母（如 `M`、`W`）会比较方块；只支持**大写英文字母和数字**。
- 文字 ≤ **8 字符**（受年份列数限制）。
- 默认目标是「上一年」（当前即 2025），保证是一整年、安全可渲染。
- **GitHub 贡献要算数**，提交作者邮箱必须绑定到你的 GitHub 账号（见第 2 节）。
- 仓库需 public，或你开启了 private contribution 显示。
- **预览 ≡ GitHub 实际显示**：两者现在都用「周日起点」对齐，预览里看到的形状就是 GitHub 上会出现的形状。
- 极端情况：`--commitsPerDay` 上界 > 840 时，同一天的提交会落在同一分钟（正常用 4 完全没问题）。

---

## 10. 示例速查

```bash
# —— 预览（不生成提交）——
node src/cli.js --preview --text "HI"                 # 默认 2025 年
node src/cli.js --preview --text "2025" --year 2024
node src/cli.js --preview --draw star  --year 2023
node src/cli.js --preview --text "GIT"  -c "0,9"       # 更密的提交

# —— 生成（创建并填充 my-history/）——
node src/cli.js --text "HI" --year 2025

# —— 推送到 GitHub ——
cd my-history
git remote add origin <url>
git branch -M main
git push -u origin main
```
