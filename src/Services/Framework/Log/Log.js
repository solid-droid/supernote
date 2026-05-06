/** @type {import('./types').ILog} */

/** @type {Record<string, string>} */
const styles = {
    error: 'color: #ff4500; font-weight: bold;',
    warn: 'color: #ff8c00; font-weight: bold;',
    success: 'color: #32cd32; font-weight: bold;',
    perf: 'color: #ff00ff; font-weight: bold;'
};

const _timers = new Map();
const _history = [];

const LogBase = {
    start(label) {
        _timers.set(label, performance.now());
        return Log;
    },
    done(label) {
        const start = _timers.get(label);
        if (!start) return Log.warn(`No timer for ${label}`);
        const duration = parseFloat((performance.now() - start).toFixed(2));
        _timers.delete(label);
        return Log.perf(`${label} took ${duration}ms`, { duration });
    },
    report(type = null) {
        return type ? _history.filter(i => i.type === type) : _history;
    },
    clear() {
        _history.length = 0;
        _timers.clear();
        return Log;
    }
};

export const Log = new Proxy(LogBase, {
    get(target, prop) {
        if (prop === 'then') return undefined; // Async fix
        if (prop in target) return target[prop];

        return (msg, data = null) => {
            const entry = { timestamp: new Date().toISOString(), type: prop, message: msg, data };
            _history.push(entry);

            console.log(
                `%c[${String(prop).toUpperCase()}] %c(${new Date().toLocaleTimeString()}): ${msg}`,
                styles[String(prop)] || 'color: gray;',
                'color: #888;',
                data || ''
            );
            return Log;
        };
    }
});