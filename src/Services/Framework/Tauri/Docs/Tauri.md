# Tauri Core API

## Environment & Window
```javascript
const { isTauri, isDev, isMobile } = Tauri.env;

// Window Management
Tauri.minimize();
Tauri.close();
await Tauri.resize(1024, 768); // Also centers the window
```

## Plugin System
```javascript
// Register a custom plugin
Tauri.register('myPlugin', {
    hello: () => console.log('Hi!')
});

// Accessing plugins (Dynamic Proxy)
Tauri.myPlugin.hello();

// Ghosting (Fails gracefully if plugin not found)
Tauri.nonExistent.method(); // Warns in console, doesn't crash
```

## Internal Window Handle
```javascript
// Access the raw Tauri window instance
if (Tauri.window) {
    await Tauri.window.setFullscreen(true);
}
```
