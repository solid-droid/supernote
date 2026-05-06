# Services API

## Dialogs & Notifications
```javascript
// Simple notification
await Tauri.services.notify("Process complete");

// Question dialog (Returns true/false)
const confirm = await Tauri.services.notify("Delete file?", { 
    title: 'Confirm',
    kind: 'warning',
    okLabel: 'Delete',
    cancelLabel: 'Keep'
}, true);

// Customizing kind (info, warning, error)
await Tauri.services.notify("Error occurred", { kind: 'error' });
```

## File Operations
```javascript
// Import Files
const path = await Tauri.services.import();
const paths = await Tauri.services.import({ multiple: true });
const dir = await Tauri.services.import({ directory: true });

// Export (Placeholder)
await Tauri.services.export({ key: 'value' }, 'backup.json');
```
