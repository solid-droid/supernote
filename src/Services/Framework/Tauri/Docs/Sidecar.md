# Sidecar API

## Spawning Instances
```javascript
// Shorthand (Auto-ID: bun, bun1, bun2...)
await Tauri.sidecar.bun();
await Tauri.sidecar.python();
await Tauri.sidecar.nodeJS(); // Alias for bun

// Explicit ID and Engine
await Tauri.sidecar.spawn({ id: 'worker1', engine: 'bun' });

// Prefix resolution (Resolves 'bun_task' -> 'bun' engine)
await Tauri.sidecar.spawn({ id: 'bun_task', args: ['--fast'] });
```

## Communication
```javascript
// Direct ID access (Proxy)
await Tauri.sidecar.worker1.send({ type: 'start' });
await Tauri.sidecar.bun.send("Hello");

// From handle
const instance = await Tauri.sidecar.python({ id: 'py' });
await instance.send("Message");

// Active instance (most recently spawned)
await Tauri.sidecar.send("Global message");
```

## Management
```javascript
// List running processes
const active = Tauri.sidecar.list(); // [{ id, program, pid }]

// Check status
const isRunning = Tauri.sidecar.isRunning('worker1');

// Kill instances
await Tauri.sidecar.worker1.kill();
await Tauri.sidecar.kill('bun');
await Tauri.sidecar.killAll();
```

## Runtime Registration
```javascript
Tauri.sidecar.registerProgram('custom', 'custom-binary');
await Tauri.sidecar.spawn({ engine: 'custom' });
```

## Event Callbacks
```javascript
await Tauri.sidecar.spawn({
    id: 'logger',
    engine: 'bun',
    onMessage: (msg) => console.log('Log:', msg),
    onError: (err) => console.error('Error:', err),
    onExit: (code) => console.log('Exited with:', code)
});
```
