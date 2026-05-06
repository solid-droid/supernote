# Updater API

## Update Checking
```javascript
// Background check (Silent if no update)
await Tauri.updater.check();

// Manual check (Notifies user even if up to date)
await Tauri.updater.check(true);
```

## Workflow
1. Checks for updates via `@tauri-apps/plugin-updater`.
2. Prompts user with a dialog if update is found.
3. Downloads and installs with progress logging.
4. Relaunches the application automatically upon completion.

## Requirements
### Signing Keys
Tauri v2 requires a public key to verify updates. This is configured in `tauri.conf.json`:
```json
"plugins": {
  "updater": {
    "pubkey": "YOUR_MINISIGN_PUBLIC_KEY",
    "endpoints": ["..."]
  }
}
```
To generate new keys, run:
`npx tauri signer generate -w src-tauri/tauri.conf.json`

