#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_dir="$project_root/dist"
target_dir="${CARGO_TARGET_DIR:-$project_root/core/target}"
cargo build --manifest-path "$project_root/core/Cargo.toml" --target wasm32-unknown-unknown --release
mkdir -p "$dist_dir"
cp "$project_root/web/index.html" "$project_root/web/app.js" "$project_root/web/style.css" "$dist_dir/"
cp "$target_dir/wasm32-unknown-unknown/release/open_viper3hs_codec.wasm" "$dist_dir/codec.wasm"
printf '' > "$dist_dir/.nojekyll"
printf 'Built %s\n' "$dist_dir"
