#!/usr/bin/env python3
"""pp-image-compress: 无损压缩指定文件夹下的 PNG / JPEG 图片。

用法:
    python compress.py <folder>            # 压缩到 <folder>/compressed/
    python compress.py <folder> --dry-run  # 预览命中文件与预估节省
    python compress.py <folder> --recursive
    python compress.py <folder> --overwrite  # 直接原地覆盖(不推荐)
    python compress.py <folder> --out <dir>  # 自定义输出目录

无损策略:
    - PNG : Pillow save(optimize=True, compress_level=9)  真·位级无损
    - JPEG: Pillow save(quality='keep', optimize=True, progressive=True)
            保留原有量化表, 不重新有损编码; 仅重排熵编码, 是 JPEG 层面的无损

依赖: pip install Pillow
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFile
except ImportError:
    print("[pp-image-compress] 缺少依赖 Pillow, 请先运行: pip install Pillow", file=sys.stderr)
    sys.exit(2)

ImageFile.LOAD_TRUNCATED_IMAGES = False

PNG_EXTS = {".png"}
JPEG_EXTS = {".jpg", ".jpeg"}
SUPPORTED = PNG_EXTS | JPEG_EXTS


def human(n: int) -> str:
    step = 1024.0
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < step:
            return f"{n:.1f}{unit}" if unit != "B" else f"{int(n)}{unit}"
        n /= step
    return f"{n:.1f}TB"


def compress_png(src: Path) -> bytes:
    with Image.open(src) as im:
        im.load()
        buf = io.BytesIO()
        save_kwargs = {"format": "PNG", "optimize": True, "compress_level": 9}
        if "icc_profile" in im.info:
            save_kwargs["icc_profile"] = im.info["icc_profile"]
        im.save(buf, **save_kwargs)
        return buf.getvalue()


def compress_jpeg(src: Path) -> bytes:
    with Image.open(src) as im:
        im.load()
        buf = io.BytesIO()
        save_kwargs = {
            "format": "JPEG",
            "quality": "keep",
            "optimize": True,
            "progressive": True,
        }
        if "icc_profile" in im.info:
            save_kwargs["icc_profile"] = im.info["icc_profile"]
        if "exif" in im.info:
            save_kwargs["exif"] = im.info["exif"]
        im.save(buf, **save_kwargs)
        return buf.getvalue()


def gather(folder: Path, recursive: bool) -> list[Path]:
    it = folder.rglob("*") if recursive else folder.iterdir()
    files: list[Path] = []
    for p in it:
        if not p.is_file():
            continue
        if p.suffix.lower() not in SUPPORTED:
            continue
        parts = set(p.relative_to(folder).parts)
        if "compressed" in parts or ".backup" in parts:
            continue
        files.append(p)
    return sorted(files)


def process_one(src: Path) -> bytes | None:
    ext = src.suffix.lower()
    try:
        if ext in PNG_EXTS:
            return compress_png(src)
        if ext in JPEG_EXTS:
            return compress_jpeg(src)
    except Exception as e:
        print(f"  ! 跳过 {src}: {e}", file=sys.stderr)
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Lossless PNG/JPEG compression (Pillow-only).")
    ap.add_argument("folder", help="目标图片文件夹")
    ap.add_argument("--dry-run", "-n", action="store_true", help="仅预览, 不写盘")
    ap.add_argument("--recursive", "-r", action="store_true", help="递归子目录")
    ap.add_argument("--overwrite", action="store_true", help="原地覆盖(不推荐, 不与 --out 兼用)")
    ap.add_argument("--out", default=None, help="自定义输出目录 (默认 <folder>/compressed)")
    args = ap.parse_args()

    folder = Path(args.folder).expanduser().resolve()
    if not folder.is_dir():
        print(f"[pp-image-compress] 目录不存在: {folder}", file=sys.stderr)
        return 2

    if args.overwrite and args.out:
        print("[pp-image-compress] --overwrite 与 --out 互斥", file=sys.stderr)
        return 2

    out_dir = None
    if not args.overwrite:
        out_dir = Path(args.out).expanduser().resolve() if args.out else (folder / "compressed")

    files = gather(folder, args.recursive)
    print(f"[pp-image-compress] folder     : {folder}")
    print(f"[pp-image-compress] recursive  : {args.recursive}")
    print(f"[pp-image-compress] mode       : {'dry-run' if args.dry_run else ('overwrite' if args.overwrite else 'copy-out')}")
    if out_dir:
        print(f"[pp-image-compress] output     : {out_dir}")
    print(f"[pp-image-compress] candidates : {len(files)}")
    if not files:
        return 0

    total_before = 0
    total_after = 0
    hit = 0
    skipped_no_gain = 0

    for src in files:
        rel = src.relative_to(folder)
        before = src.stat().st_size
        data = process_one(src)
        if data is None:
            continue
        after = len(data)
        total_before += before
        # 只有真的变小才算命中; JPEG quality=keep 有时会略大, 那种就保持原图
        if after >= before:
            total_after += before
            skipped_no_gain += 1
            print(f"  = {rel}  {human(before)} → {human(after)}  (no gain, 保留原图)")
            if not args.dry_run and not args.overwrite:
                # copy-out 模式下, 无收益的也复制一份原图, 保证 compressed/ 是完整可替换的副本
                dst = out_dir / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(src.read_bytes())
            continue

        total_after += after
        hit += 1
        saved = before - after
        pct = saved * 100.0 / before
        print(f"  · {rel}  {human(before)} → {human(after)}  -{human(saved)} ({pct:.1f}%)")

        if args.dry_run:
            continue
        if args.overwrite:
            src.write_bytes(data)
        else:
            dst = out_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(data)

    saved_total = total_before - total_after
    pct_total = (saved_total * 100.0 / total_before) if total_before else 0.0
    print("")
    print(f"[pp-image-compress] processed  : {len(files)}")
    print(f"[pp-image-compress] compressed : {hit}")
    print(f"[pp-image-compress] no-gain    : {skipped_no_gain}")
    print(f"[pp-image-compress] before     : {human(total_before)}")
    print(f"[pp-image-compress] after      : {human(total_after)}")
    print(f"[pp-image-compress] saved      : {human(saved_total)} ({pct_total:.1f}%)")
    if args.dry_run:
        print("[pp-image-compress] dry-run 完成, 未写盘")
    return 0


if __name__ == "__main__":
    sys.exit(main())
