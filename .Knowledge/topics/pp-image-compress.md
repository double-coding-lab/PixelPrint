---
id: pp-image-compress
revision: 0
summary: pp-image-compress
primary: feature
confidence: inferred
tags: [module]
---
# pp-image-compress

> 纯 Pillow 无损压缩 PNG / JPEG,产物写入 `<folder>/compressed/` 子目录,保留原子目录结构。适用于"零散图片体积瘦身",不做换肤切图,不做代码生成。

## 适用范围

- 一批 PNG / JPEG 图片(通常是切图产物或美术给的原图)想在**不损失像素**前提下减小体积
- 图片来自任意目录,只要给到路径即可,不强绑定 `pp-d2c` 流水线
- 无网络依赖,本地 Pillow 直接跑

**不适用**:
- 换肤稿批量切图 → 用 [[pp-d2c-reskin]]
- 有损压缩到极致小(如给微信小程序省包体)→ 本 skill 是无损,追极小请另选 pngquant / tinypng
- 视频 / GIF / SVG → 本 skill 只处理 PNG / JPEG

## 关键约定

| 项 | 值 |
|---|---|
| PNG 压缩 | `optimize=True, compress_level=9` |
| JPEG 压缩 | `quality='keep', optimize=True, progressive=True` |
| ICC / EXIF | 保留(不改色彩空间、不清元数据) |
| 输出目录 | `<folder>/compressed/`(保留原目录结构) |
| 无收益保护 | 压完比原图**更大**时,直接复制原图到输出目录,不用压缩版 |
| 干跑 | 支持 `--dry-run`,只打印每张预计压缩率,不写盘 |

## 执行流程(SKILL 里更细)

1. 扫 `<folder>` 递归找所有 PNG / JPEG
2. 逐张压缩到内存,对比大小
3. dry-run → 打表让用户看每张压缩率,等确认
4. 正式跑 → 写入 `<folder>/compressed/<原相对路径>/<原文件名>`;无收益的直接 copy 原图

## 依赖

- Python 3.7+
- `pip install Pillow`(**唯一 npm/pip 依赖**;install.js 分发时自动落地,pip 安装由用户手动跑)

## 与其他 skill 的分工

| 场景 | 用哪个 |
|---|---|
| 无损压缩零散图片 | **`pp-image-compress`(本 topic)** |
| 换肤稿批量切图 | [[pp-d2c-reskin]] |
| 整页 D2C 出码 | [[pp-d2c]] / [[pp-d2c-rn]] |
| 页面某一小块重生成 | [[pp-fix-partial]] |

## 完整流程见 SKILL

`templates/skills/pp-image-compress/SKILL.md` + `compress.py`。SKILL 里覆盖:参数表、失败兜底、no-gain 保护逻辑、常见 Pillow 报错处理。
