# Supernote 📝

Supernote is a premium, lightweight, cross-platform note-taking application built with **Tauri v2** and **Vite**. It features a dynamic, runtime-extensible plugin architecture and integrates powerful backend sidecars (Bun and Python) to perform local computations beyond the standard frontend sandbox.

---

## 🚀 Key Features

*   **Tauri v2 Desktop Shell**: High performance, small binary footprint, native OS dialogs, notifications, and system hooks.
*   **Dynamic Plugin System**: Extends UI controls and editor behavior at runtime. Plugins are dynamically downloaded, loaded, and initialized from the registry server ([Superhub](file:///c:/Files/Projects/SuperApps/superhub/README.md)).
*   **Native Sidecars**:
    *   **Bun Sidecar (`src-bun`)**: Run fast server-side JavaScript/TypeScript workflows locally.
    *   **Python Sidecar (`src-python`)**: Run scriptable scripts, data analysis, and helper automations.
*   **Unified UI Styling**: Sleek jQuery-driven UI featuring glassmorphic designs, micro-animations, customizable dark theme support, and a dragging-enabled custom window header.
*   **Cross-Platform Targets**: Compile to Windows, macOS, Linux, and Android.

---

## 📁 Repository Structure

```
supernote/
├── docs/                      # Documentation files (e.g., setup instructions)
├── scripts/                   # Utility scripts for sidecars, release packaging, and key generation
│   ├── build-sidecars.js      # Compiles Bun and Python sidecars
│   ├── create-tag.js          # Prepares Git tags & release metadata
│   ├── setup.ps1 / setup.sh   # Installs dependencies (Rust, Bun, Python, PyInstaller)
│   └── secrets/               # EXCLUDED FROM GIT - holds signing and updater private keys
├── src/                       # Frontend application code
│   ├── Services/              # Core business services
│   │   ├── Framework/         # Framework initialization
│   │   ├── Network/           # REST and WebSocket network modules
│   │   ├── Plugin/            # Plugin loader, cache management, and dynamically-imported registry links
│   │   ├── Runtime/           # Application runtime states
│   │   └── Storage/           # Application persistence/storage configuration
│   ├── Sources/               # UI components, layouts, custom styles, and core sidecar-spawning routines
│   │   ├── main.css           # Styling rules, color palettes, variables
│   │   └── main.js            # Core page layout, sidecar buttons, and service interactions
│   ├── main.css               # Global application loader stylesheet
│   └── main.js                # Core entry point (bootstrap sequence)
├── src-sidecars/              # Sidecar codebases
│   ├── src-bun/               # TypeScript-based Bun sidecar source code
│   └── src-python/            # Python sidecar script codebase
├── src-tauri/                 # Rust code and Tauri packaging configurations
│   ├── src/                   # Main Rust file (commands, setup, resize hooks)
│   └── tauri.conf.json        # Tauri target build configuration
├── info.json                  # Git release versioning and download URLs
└── package.json               # Frontend dependencies & run scripts
```

---

## ⚙️ Prerequisites & Setup

Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust/Cargo](https://www.rust-lang.org/)
*   [Bun](https://bun.sh/)
*   [Python 3](https://www.python.org/)

### 1. Run First-Time Setup
Execute the platform-specific setup script to verify environments and install requirements (e.g., PyInstaller, Node packages, dependencies):

*   **Windows (PowerShell):**
    ```powershell
    .\scripts\setup.ps1
    ```
*   **macOS / Linux (Bash):**
    ```bash
    chmod +x ./scripts/setup.sh
    ./scripts/setup.sh
    ```

### 2. Build Sidecars
Compile the sidecars into executable binaries placed inside `src-tauri` with the target triple name:
```bash
node scripts/build-sidecars.js
```

### 3. Run Development Server
Start the client application in development mode:
```bash
npm run dev
```

### 4. Build Production Bundle
Build and package the production installer:
```bash
npm run build
```

---

## 🔌 Plugin Registry & Service

Supernote loads plugins dynamically using the `PluginService` located under [`src/Services/Plugin/PluginService.js`](file:///c:/Files/Projects/SuperApps/supernote/src/Services/Plugin/PluginService.js). 

1.  **Registry URL**: By default, Supernote looks for the registry on `http://localhost:3001`. You can configure a custom server URL directly from the application's UI settings.
2.  **Plugin Loading**: On startup, it reads the default plugin manifest [`plugin-package.js`](file:///c:/Files/Projects/SuperApps/supernote/src/Services/Plugin/plugin-package.js) and requests corresponding files from the registry server.
3.  **Sandboxing & Dynamic Import**: It imports ES modules dynamically using `import(/* @vite-ignore */ url)` and appends related style assets dynamically into the document `<head>`.

### v2 Plugin Runtime Contract

- Supernote now consumes plugin metadata with `exports.logic`, `exports.template`, and `exports.styles`.
- Plugin package entries can define default variants:

```js
{ slug: 'button', version: '1.0.1', variants: ['primary', 'secondary', 'danger'] }
```

- Variant selection is hybrid:
    - default variants from `plugin-package.js`
    - optional runtime variant override per load call

### Direct Widget Instantiation

- UI code now creates widget instances directly from plugin logic exports.
- The button helper wrapper in the source page has been removed; components instantiate the loaded widget class directly.

---

## 🛠️ Developer Scripts

Refer to [`scripts/README.md`](file:///c:/Files/Projects/SuperApps/supernote/scripts/README.md) for advanced commands regarding:
*   Tauri updater key generation (`generate-updater-keys.js`).
*   Android release key configurations (`createSecrets.ps1`).
*   Tagging releases and preparing automatic update jsons (`create-tag.js`).
