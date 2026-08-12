---
name: pp-image-compress
description: 无损压缩指定文件夹下的 PNG/JPEG 图片到 compressed/ 子目录（Python + Pillow）；触发：pp-image-compress、压缩图片、无损压缩、优化图片体积
---

# pp-image-compress Skill

> 无损压缩指定文件夹下的 PNG / JPEG 图片，输出到 `<folder>/compressed/` 子目录，原图不动。**纯 Python + Pillow 方案**，零系统依赖。

## 触发条件

- 用户输入图片文件夹路径 + 明确要求"压缩图片 / 无损压缩 / 优化图片体积"
- 用户说：「帮我压一下这个文件夹的图片」「无损压缩这批图」「优化 assets 体积」
- 直接 `$pp-image-compress <folder>`

## 前置依赖

```bash
pip install Pillow
```

未安装会退出码 2 并提示。

## 执行流程

### 步骤 0：确认目标文件夹

从用户输入拿到图片目录的绝对/相对路径。**默认只扫顶层**，需要递归时加 `--recursive`。

**禁止**在没有明确路径时假设默认目录（不同于 pp-strip-nodeid，这个 skill 没有配置文件兜底）。

### 步骤 1：先跑 dry-run 预览

**必须**先跑 dry-run，让用户看清将处理多少文件、预计节省多少体积：

```bash
python .claude/skills/pp-image-compress/compress.py <folder> --dry-run
```

输出示例：

```
[pp-image-compress] folder     : /abs/path/to/imgs
[pp-image-compress] recursive  : False
[pp-image-compress] mode       : dry-run
[pp-image-compress] output     : /abs/path/to/imgs/compressed
[pp-image-compress] candidates : 12
  · hero.png  482.3KB → 361.7KB  -120.6KB (25.0%)
  · icon.png  8.2KB → 6.1KB  -2.1KB (25.6%)
  = photo.jpg  1.2MB → 1.2MB  (no gain, 保留原图)
  ...

[pp-image-compress] processed  : 12
[pp-image-compress] compressed : 10
[pp-image-compress] no-gain    : 2
[pp-image-compress] before     : 8.4MB
[pp-image-compress] after      : 6.1MB
[pp-image-compress] saved      : 2.3MB (27.4%)
[pp-image-compress] dry-run 完成, 未写盘
```

### 步骤 2：用户确认后实际写盘

用户确认无误后，去掉 `--dry-run` 重跑：

```bash
python .claude/skills/pp-image-compress/compress.py <folder>
```

**默认行为**：写入 `<folder>/compressed/`，保持相对子路径。原图保持原样不动。

**同名保留**：文件名与相对路径完全保持一致，方便一键替换原目录（`cp -r compressed/. .`）。

### 步骤 3：产出摘要

脚本自身会打印：候选数、命中数、无收益数、压缩前后总体积、节省百分比。Agent 侧只需转述关键指标并建议下一步（例如"确认无误后可用 `cp -r <folder>/compressed/. <folder>/` 覆盖原图，或用 git 复核 diff"）。

## 参数

| 参数 | 说明 |
|------|------|
| `<folder>` | **必填**。目标图片文件夹（绝对或相对路径） |
| `--dry-run` / `-n` | 只预览，不写盘 |
| `--recursive` / `-r` | 递归处理子目录 |
| `--out <dir>` | 自定义输出目录（默认 `<folder>/compressed/`） |
| `--overwrite` | 原地覆盖原图（危险，与 `--out` 互斥；仅在原图已有别的备份时使用） |

## 无损策略说明

- **PNG**：`Pillow.save(optimize=True, compress_level=9)` — deflate 最高档 + 熵优化，**像素级完全无损**，仅重排压缩流。ICC profile 保留。
- **JPEG**：`Pillow.save(quality='keep', optimize=True, progressive=True)` — 保留原图量化表，**不重编码**，仅重排 Huffman 熵编码为渐进式。这是 JPEG 层面的无损（像素一致性依赖原有量化表）。ICC / EXIF 保留。

**收益预期**：
- PNG：典型 5%–30%（已经 optipng 过的会没收益）
- JPEG：典型 2%–10%（相机原片通常收益更大，已优化过的接近 0）

**无收益保护**：某些图片压缩后反而变大（罕见但存在），脚本自动保留原图字节，输出 `no gain, 保留原图`。copy-out 模式下 compressed/ 里放的仍是原图字节，保证目录整体可替换。

## 支持范围

- ✅ `.png` — Pillow 处理
- ✅ `.jpg` / `.jpeg` — Pillow 处理
- ❌ 其他扩展名（`.webp` / `.gif` / `.svg`）当前版本不处理，遇到自动跳过

自动跳过：`compressed/`、`.backup/` 子目录（避免重复处理）。

## 禁止

- 禁止跳过 dry-run 直接写盘：即使默认输出到 `compressed/` 不改原图，也必须先给用户看命中列表与预估节省，避免对着 `~/Downloads` 或错误目录跑几千张图
- 禁止用 `--overwrite` 作为默认路径：这个参数只在用户明确说"原地压缩 / 覆盖 / 我有别的备份"时才允许，其它情况下必须走默认的 `compressed/` 输出
- 禁止对 `node_modules/`、`.git/`、`dist/`、`build/` 里的图片跑压缩：调用前 Agent 需要判断路径合理性，用户若给了工程根目录就要反问确认
- 禁止修改 quality 参数为具体数字（例如 `quality=85`）：那会把 JPEG 从"无损重编码"变成"有损重编码"，违反 skill 语义。真需要有损压缩请另开 skill
