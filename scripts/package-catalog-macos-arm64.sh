#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSET_DIR="$ROOT_DIR/scripts/release-assets/catalog-macos-arm64"
OUT_DIR="$ROOT_DIR/release/JavBoss-个人资源库-Mac-AppleSilicon"
ZIP_PATH="$ROOT_DIR/release/JavBoss-个人资源库-Mac-AppleSilicon.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

GOCACHE="$ROOT_DIR/.gocache" \
GOMODCACHE="$ROOT_DIR/.gomodcache" \
go build -trimpath -ldflags '-s -w -X main.buildMode=release' -o "$OUT_DIR/javboss" ./cmd/server

mkdir -p "$OUT_DIR/web"
cp -R "$ROOT_DIR/web/dist" "$OUT_DIR/web/dist"
cp -R "$ROOT_DIR/modernz" "$OUT_DIR/modernz"
cp -R "$ROOT_DIR/browser-extension" "$OUT_DIR/browser-extension"
cp -R "$ROOT_DIR/data" "$OUT_DIR/data"
cp "$ASSET_DIR/config.toml" "$OUT_DIR/config.toml"
cp "$ASSET_DIR/javboss.command" "$OUT_DIR/javboss.command"
cp "$ASSET_DIR/使用说明.md" "$OUT_DIR/使用说明.md"
chmod +x "$OUT_DIR/javboss" "$OUT_DIR/javboss.command"

rm -f "$ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$OUT_DIR" "$ZIP_PATH"

printf '已生成：%s\n' "$ZIP_PATH"
