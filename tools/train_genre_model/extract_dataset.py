#!/usr/bin/env python3
"""Walks a genre-labeled dataset folder and writes a features CSV.

Expected layout (same as GTZAN-style datasets):

    dataset/
      rock/track1.wav
      rock/track2.wav
      jazz/track1.wav
      ...

Usage:
    python extract_dataset.py --dataset-dir dataset --out features.csv
"""

import argparse
import csv
import sys
from pathlib import Path

from features import FEATURE_NAMES, extract_features

AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    genre_dirs = sorted(p for p in args.dataset_dir.iterdir() if p.is_dir())
    if not genre_dirs:
        sys.exit(f"no genre subfolders found in {args.dataset_dir}")

    rows = []
    for genre_dir in genre_dirs:
        files = [
            f for f in sorted(genre_dir.iterdir()) if f.suffix.lower() in AUDIO_EXTENSIONS
        ]
        print(f"[{genre_dir.name}] {len(files)} files")
        for f in files:
            try:
                feats = extract_features(str(f))
            except Exception as e:  # noqa: BLE001 - keep going on unreadable files
                print(f"  skip {f.name}: {e}", file=sys.stderr)
                continue
            rows.append({"genre": genre_dir.name, "path": str(f), **feats})

    if not rows:
        sys.exit("no features extracted - check the dataset directory")

    with args.out.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["genre", "path", *FEATURE_NAMES])
        writer.writeheader()
        writer.writerows(rows)

    print(f"wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
