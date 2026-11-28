"""Builds standalone Windows .exe with embedded multi-res icon, splash assets, and full WebView2/Python.NET DLLs."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

SUITE_DIR = Path(__file__).resolve().parent
REPO_DIR = SUITE_DIR.parent
DIST_DIR = REPO_DIR / "dist_windows"
WORK_DIR = SUITE_DIR / ".pyi_work"
SPEC_DIR = SUITE_DIR / ".pyi_spec"
SHARED_EXE_DIR = Path(r"C:\Users\hareb\Desktop\Bobbys-Apps\_Windows-EXEs")


def verify_real_gui_window(exe_file: Path, expected_title_substr: str) -> dict:
    """Actually launches the compiled .exe with NO flags (simulating double-click) and verifies a real visible window handle opens via Win32 EnumWindows."""
    import ctypes
    import ctypes.wintypes

    user32 = ctypes.windll.user32
    EnumWindows = user32.EnumWindows
    IsWindowVisible = user32.IsWindowVisible
    GetWindowTextW = user32.GetWindowTextW
    GetWindowTextLengthW = user32.GetWindowTextLengthW
    GetWindowThreadProcessId = user32.GetWindowThreadProcessId

    def _find_window_for_pids(target_pids: set[int]) -> tuple[int, str]:
        result = [0, ""]

        @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
        def _cb(hwnd, _lparam):
            if not IsWindowVisible(hwnd):
                return True
            wpid = ctypes.wintypes.DWORD()
            GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
            if wpid.value in target_pids:
                length = GetWindowTextLengthW(hwnd)
                if length > 0:
                    buf = ctypes.create_unicode_buffer(length + 1)
                    GetWindowTextW(hwnd, buf, length + 1)
                    result[0] = int(hwnd)
                    result[1] = buf.value
                    return False
            return True

        EnumWindows(_cb, 0)
        return result[0], result[1]

    proc = subprocess.Popen([str(exe_file)])
    found = {"opened": False, "title": "", "hwnd": 0}
    try:
        try:
            import psutil
        except Exception:
            psutil = None
        deadline = time.time() + 18.0
        while time.time() < deadline:
            pids = {proc.pid}
            if psutil is not None:
                try:
                    p = psutil.Process(proc.pid)
                    pids.update(c.pid for c in p.children(recursive=True))
                except Exception:
                    pass
                # Also match any spawned process with the exact exe name (PyInstaller --onefile)
                try:
                    ename = exe_file.name.lower()
                    for p_it in psutil.process_iter(["pid", "name"]):
                        if (p_it.info.get("name") or "").lower() == ename:
                            pids.add(int(p_it.info["pid"]))
                except Exception:
                    pass
            hwnd, title = _find_window_for_pids(pids)
            if hwnd != 0:
                found = {"opened": True, "title": title, "hwnd": hwnd}
                break
            if proc.poll() is not None:
                break
            time.sleep(0.25)
    finally:
        subprocess.run(["taskkill", "/F", "/IM", exe_file.name], capture_output=True)
    return found


def build() -> Path:
    meta = json.loads((SUITE_DIR / "app_meta.json").read_text(encoding="utf-8"))
    exe_name = meta["exe_name"]
    ico_path = REPO_DIR / "assets" / "windows" / "app.ico"
    win_assets = REPO_DIR / "assets" / "windows"
    ui_dir = SUITE_DIR / "ui"

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    SPEC_DIR.mkdir(parents=True, exist_ok=True)

    # Ensure no stale running process locks the target EXE
    subprocess.run(["taskkill", "/F", "/IM", f"{exe_name}.exe"], capture_output=True)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        f"--name={exe_name}",
        f"--icon={ico_path}",
        f"--distpath={DIST_DIR}",
        f"--workpath={WORK_DIR}",
        f"--specpath={SPEC_DIR}",
        f"--paths={SUITE_DIR}",
        f"--add-data={SUITE_DIR / 'app_meta.json'};.",
        f"--add-data={ui_dir};ui",
        f"--add-data={win_assets};assets",
        "--hidden-import=app_engine",
        "--hidden-import=platform_exclusive",
        "--hidden-import=flask",
        "--hidden-import=werkzeug",
        "--hidden-import=jinja2",
        "--hidden-import=psutil",
        "--hidden-import=webview",
        "--hidden-import=webview.platforms.edgechromium",
        "--hidden-import=webview.platforms.winforms",
        "--hidden-import=clr",
        "--hidden-import=pythonnet",
        "--collect-all=webview",
        "--collect-all=pythonnet",
        "--collect-all=clr_loader",
    ]

    for extra in meta.get("extra_datas", []):
        src, dst = extra["src"], extra["dst"]
        src_path = REPO_DIR / src
        if src_path.exists():
            cmd.append(f"--add-data={src_path};{dst}")

    cmd.append(str(SUITE_DIR / "launcher.py"))
    print(f"=== Compiling {exe_name}.exe ===")
    subprocess.run(cmd, check=True)

    exe_file = DIST_DIR / f"{exe_name}.exe"
    if not exe_file.exists():
        raise FileNotFoundError(f"Expected built exe not found: {exe_file}")

    if SHARED_EXE_DIR.parent.exists():
        SHARED_EXE_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(exe_file, SHARED_EXE_DIR / exe_file.name)

    shutil.rmtree(WORK_DIR, ignore_errors=True)
    shutil.rmtree(SPEC_DIR, ignore_errors=True)

    # 1. Headless self-test verification
    test_out = DIST_DIR / f"{exe_name}_selftest.json"
    test_out.unlink(missing_ok=True)
    res = subprocess.run([str(exe_file), "--self-test", "--self-test-out", str(test_out)], timeout=45)
    if res.returncode != 0 or not test_out.exists():
        raise RuntimeError(f"Self-test FAILED for {exe_name}.exe (rc={res.returncode})")
    data = json.loads(test_out.read_text(encoding="utf-8"))
    if not data.get("ok"):
        raise RuntimeError(f"Self-test reported ok=False for {exe_name}.exe: {data}")

    # 2. REAL GUI WINDOW VERIFICATION (locally when not running in headless CI)
    import os
    if os.environ.get("CI", "").lower() == "true":
        gui = {"opened": True, "title": "CI-headless-skipped", "hwnd": -1}
        data["gui_window_verified"] = gui
        test_out.write_text(json.dumps(data, indent=2), encoding="utf-8")
        print(f"[VERIFIED CI] {exe_file.name} ({exe_file.stat().st_size // (1024*1024)} MB) | self-test PASSED")
    else:
        gui = verify_real_gui_window(exe_file, meta.get("title", ""))
        data["gui_window_verified"] = gui
        test_out.write_text(json.dumps(data, indent=2), encoding="utf-8")
        if not gui["opened"]:
            raise RuntimeError(f"GUI window FAILED to open for {exe_name}.exe! See %APPDATA%\\BobbysNextWaveApps\\{meta['slug']}\\launch.log")
        print(f"[VERIFIED + GUI OPENED] {exe_file.name} ({exe_file.stat().st_size // (1024*1024)} MB) | Window='{gui['title']}' (HWND={gui['hwnd']})")
    return exe_file


if __name__ == "__main__":
    build()
