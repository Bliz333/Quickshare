#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

check_file() {
  local file="$1"
  printf '[check-js] %s\n' "$file"
  node --check "$file"
}

check_dir() {
  local dir="$1"

  while IFS= read -r file; do
    check_file "$file"
  done < <(find "$dir" -maxdepth 1 -type f -name '*.js' | sort)
}

check_dir "src/main/resources/static/js"
check_file "playwright.config.js"
check_dir "tests/e2e"

printf '[check-js] All JS syntax checks passed\n'
