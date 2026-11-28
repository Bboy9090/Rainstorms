#!/usr/bin/env bash
set -euo pipefail

# Cross-Platform Parity Builder for macOS (.app + .zip) and Linux (ELF binary + .tar.gz)
# Reads extra_datas dynamically from desktop_suite/app_meta.json to guarantee 100% parity with build_windows_exe.py.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="$(python3 -c "import json; print(json.load(open('$SCRIPT_DIR/app_meta.json', encoding='utf-8'))['exe_name'])")"
APP_SLUG="$(python3 -c "import json; print(json.load(open('$SCRIPT_DIR/app_meta.json', encoding='utf-8')).get('slug', 'bobbys-app'))")"
OS_NAME="$(uname -s)"

# PEP 668 safe virtualenv on macOS/Linux if not already inside a venv
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  if [[ ! -d "$REPO_DIR/.venv-desktop" ]]; then
    python3 -m venv "$REPO_DIR/.venv-desktop"
  fi
  # shellcheck disable=SC1091
  source "$REPO_DIR/.venv-desktop/bin/activate"
fi

EXTRA_PIP=""
if grep -q "import numpy" "$SCRIPT_DIR/app_engine.py" 2>/dev/null; then
  EXTRA_PIP="numpy"
fi

python3 -m pip install --quiet --upgrade pyinstaller pywebview flask psutil pillow $EXTRA_PIP

# Build dynamic --add-data arguments from app_meta.json extra_datas (exact parity with Windows)
EXTRA_ARGS=()
while IFS= read -r item; do
  [[ -n "$item" ]] && EXTRA_ARGS+=(--add-data "$item")
done < <(python3 - "$SCRIPT_DIR/app_meta.json" "$REPO_DIR" <<'PY'
import json, pathlib, sys
meta = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
repo = pathlib.Path(sys.argv[2])
for extra in meta.get("extra_datas", []):
    src = repo / extra["src"]
    dst = extra["dst"]
    if src.exists():
        print(f"{src}:{dst}")
PY
)

HIDDEN_ARGS=(
  --hidden-import=app_engine
  --hidden-import=platform_exclusive
  --hidden-import=flask
  --hidden-import=werkzeug
  --hidden-import=jinja2
  --hidden-import=psutil
  --collect-all=webview
)
if [[ -n "$EXTRA_PIP" ]]; then
  HIDDEN_ARGS+=(--hidden-import=numpy)
fi

echo "=== Building $APP_NAME for $OS_NAME (extra_datas=${#EXTRA_ARGS[@]}) ==="
if [[ "$OS_NAME" == "Darwin" ]]; then
  ICON_ARGS=()
  for ic in \
    "$REPO_DIR/assets/macos/AppIcon.icns" \
    "$REPO_DIR/store_packaging/macos/AppIcon.icns" \
    "$REPO_DIR/assets/AppIcon.icns" \
    "$REPO_DIR/assets/nextwave/icon-1024.png" \
    "$REPO_DIR/assets/windows/icon_256.png"; do
    if [[ -f "$ic" ]]; then
      ICON_ARGS=(--icon "$ic")
      break
    fi
  done

  pyinstaller --noconfirm --clean --windowed \
    --name "$APP_NAME" \
    --osx-bundle-identifier "com.bobbyblanco.${APP_SLUG}" \
    "${ICON_ARGS[@]}" \
    --distpath "$REPO_DIR/dist_macos" \
    --workpath "$SCRIPT_DIR/.build_macos" \
    --specpath "$SCRIPT_DIR/.spec_macos" \
    --paths "$SCRIPT_DIR" \
    --add-data "$SCRIPT_DIR/app_meta.json:." \
    --add-data "$SCRIPT_DIR/ui:ui" \
    --add-data "$REPO_DIR/assets/windows:assets" \
    "${EXTRA_ARGS[@]}" \
    "${HIDDEN_ARGS[@]}" \
    "$SCRIPT_DIR/launcher.py"

  # Mandatory headless self-test on compiled macOS binary before zipping
  TEST_OUT="$REPO_DIR/dist_macos/${APP_NAME}_selftest_macos.json"
  rm -f "$TEST_OUT"
  "$REPO_DIR/dist_macos/$APP_NAME.app/Contents/MacOS/$APP_NAME" --self-test --self-test-out "$TEST_OUT"
  python3 -c "import json, sys; d=json.load(open(sys.argv[1])); assert d.get('ok'), d; print('[VERIFIED macOS]', d)" "$TEST_OUT"

  cd "$REPO_DIR/dist_macos"
  ditto -c -k --sequesterRsrc --keepParent "$APP_NAME.app" "${APP_NAME}-macOS.zip"
  echo "Built & verified macOS release zip: $REPO_DIR/dist_macos/${APP_NAME}-macOS.zip"
else
  pyinstaller --noconfirm --clean --onefile --windowed \
    --name "$APP_NAME" \
    --distpath "$REPO_DIR/dist_linux" \
    --workpath "$SCRIPT_DIR/.build_linux" \
    --specpath "$SCRIPT_DIR/.spec_linux" \
    --paths "$SCRIPT_DIR" \
    --add-data "$SCRIPT_DIR/app_meta.json:." \
    --add-data "$SCRIPT_DIR/ui:ui" \
    --add-data "$REPO_DIR/assets/windows:assets" \
    "${EXTRA_ARGS[@]}" \
    "${HIDDEN_ARGS[@]}" \
    "$SCRIPT_DIR/launcher.py"

  TEST_OUT="$REPO_DIR/dist_linux/${APP_NAME}_selftest_linux.json"
  rm -f "$TEST_OUT"
  "$REPO_DIR/dist_linux/$APP_NAME" --self-test --self-test-out "$TEST_OUT"
  python3 -c "import json, sys; d=json.load(open(sys.argv[1])); assert d.get('ok'), d; print('[VERIFIED Linux]', d)" "$TEST_OUT"

  cd "$REPO_DIR/dist_linux"
  tar -czf "${APP_NAME}-Linux-x86_64.tar.gz" "$APP_NAME"
  echo "Built & verified Linux release archive: $REPO_DIR/dist_linux/${APP_NAME}-Linux-x86_64.tar.gz"
fi
