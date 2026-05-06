# Tauri Sidecars

This directory contains sample sidecar applications for Bun and Python.

## Bun Sidecar (`src-bun`)

To build the Bun sidecar as an executable for Tauri:

1.  Navigate to `src-bun`.
2.  Install dependencies: `bun install`.
3.  Compile to binary:
    ```bash
    bun build --compile ./index.ts --outfile ./bun-sidecar
    ```
4.  Rename the binary to match the Tauri target triple (e.g., `bun-sidecar-x86_64-pc-windows-msvc.exe`).

## Python Sidecar (`src-python`)

To build the Python sidecar as an executable for Tauri:

1.  Navigate to `src-python`.
2.  (Optional) Create a virtual environment: `python -m venv venv`.
3.  Install PyInstaller: `pip install pyinstaller`.
4.  Compile to binary:
    ```bash
    pyinstaller --onefile ./main.py --name python-sidecar
    ```
5.  Find the binary in `dist/` and rename it to match the Tauri target triple (e.g., `python-sidecar-x86_64-pc-windows-msvc.exe`).

## Configuring Tauri

Update `src-tauri/tauri.conf.json` to include the sidecars:

```json
{
  "bundle": {
    "externalBin": [
      "Sidecar/src-bun/bun-sidecar",
      "Sidecar/src-python/python-sidecar"
    ]
  }
}
```

*Note: Ensure the binaries are placed where Tauri expects them and have the correct target triple suffix.*
