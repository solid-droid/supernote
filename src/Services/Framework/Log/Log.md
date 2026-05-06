# Logging API

## Basic Logging
The Log service uses a Proxy, allowing any property name to be used as a log level.
```javascript
Log.info("Application started");
Log.success("Data loaded", { items: 42 });
Log.warn("Low memory");
Log.error("Failed to connect", error);

// Custom levels
Log.custom("This works too");
```

## Performance Timing
```javascript
Log.start('database-sync');
// ... perform work ...
Log.done('database-sync'); // Logs: "[PERF] database-sync took Xms"
```

## History & Reporting
```javascript
// Get all logs
const allLogs = Log.report();

// Filter by type
const errors = Log.report('error');

// Clear history
Log.clear();
```

## Features
- **Chainable**: Methods return the `Log` object.
- **Auto-Styling**: Built-in colors for `error`, `warn`, `success`, and `perf`.
- **Data Support**: Accepts an optional second parameter for metadata objects.
