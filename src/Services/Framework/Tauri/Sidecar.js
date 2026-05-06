import { Tauri } from './Tauri.js';
import { Command } from '@tauri-apps/plugin-shell';

const DEFAULT_PROGRAM = '../Sidecar/src-bun/bun-sidecar';

/**
 * Creates a Tauri sidecar command.
 */
const createSidecarCommand = (program, args, options) => {
    return Command.sidecar(program, args, options);
};

/**
 * Normalizes messages for sidecar communication.
 */
const normalizeMessage = (value) => {
    if (typeof value === 'string' || value instanceof Uint8Array) return value;
    if (Array.isArray(value)) return value;
    return JSON.stringify(value);
};

const SidecarBase = {
    instances: new Map(),
    programs: new Map([
        ['default', '../src-sidecars/src-bun/bun-sidecar'],
        ['bun', '../src-sidecars/src-bun/bun-sidecar'],
        ['python', '../src-sidecars/src-python/python-sidecar']
    ]),
    activeId: null,
    nextId: 0,

    /**
     * Registers a program binary name for a given engine key.
     */
    registerProgram(key, program) {
        if (!key || !program) {
            throw new Error('registerProgram requires both a key and a program name.');
        }
        this.programs.set(key, program);
        return this;
    },

    /**
     * Resolves a program name based on engine key or prefix.
     */
    getProgram(key) {
        if (this.programs.has(key)) {
            return this.programs.get(key);
        }
        // Prefix matching (e.g., 'bun1' -> 'bun')
        for (const [k, program] of this.programs.entries()) {
            if (k !== 'default' && key.startsWith(k)) {
                return program;
            }
        }
        return this.programs.get('default');
    },

    listPrograms() {
        return Array.from(this.programs.entries()).map(([key, program]) => ({ key, program }));
    },

    _resolveProgram(data) {
        if (data.program) return data.program;
        const key = data.engine || data.id || 'default';
        return this.getProgram(key);
    },

    _cleanupInstance(id) {
        const instance = this.instances.get(id);
        if (!instance) return;

        const { command } = instance;
        try {
            command.removeAllListeners?.();
            command.stdout?.removeAllListeners?.();
            command.stderr?.removeAllListeners?.();
        } catch (e) {
            console.warn(`[Sidecar] Error during listener cleanup for ${id}:`, e);
        }

        this.instances.delete(id);
        if (this.activeId === id) {
            this.activeId = Array.from(this.instances.keys()).pop() || null;
        }
    },

    /**
     * Spawns a new sidecar instance.
     */
    async spawn(data = {}) {
        const program = this._resolveProgram(data);
        const engine = data.engine || (data.id && this.programs.has(data.id) ? data.id : 'default');
        
        let id = data.id;
        if (!id) {
            const baseId = data.engine || 'sidecar';
            id = baseId;
            let counter = 1;
            while (this.instances.has(id)) {
                id = `${baseId}${counter++}`;
            }
        }

        if (this.instances.has(id)) {
            throw new Error(`Sidecar instance with id '${id}' already exists.`);
        }

        const {
            args = [],
            type = 'echo',
            msg = '',
            env = {},
            cwd,
            encoding,
            onMessage,
            onError,
            onExit
        } = data;

        const commandEnv = { ...env, ChamberMsg: JSON.stringify({ type, msg }) };
        const spawnOptions = { env: commandEnv };
        if (cwd) spawnOptions.cwd = cwd;
        if (encoding) spawnOptions.encoding = encoding;

        const command = createSidecarCommand(program, args, spawnOptions);

        const handleMessage = (line) => {
            if (typeof onMessage === 'function') {
                onMessage(line);
                return;
            }
            console.debug(`[Sidecar:${id}] stdout:`, line);
        };

        const handleError = (error) => {
            if (typeof onError === 'function') {
                onError(error);
                return;
            }
            console.error(`[Sidecar:${id}] error:`, error);
        };

        const handleClose = (payload) => {
            if (typeof onExit === 'function') {
                onExit(payload);
            } else {
                console.debug(`[Sidecar:${id}] exited:`, payload);
            }
            this._cleanupInstance(id);
        };

        command.stdout.on('data', handleMessage);
        command.stderr.on('data', handleError);
        command.on('error', handleError);
        command.on('close', handleClose);

        try {
            const child = await command.spawn();
            const instance = {
                id,
                program,
                args,
                command,
                child,
                pid: child.pid,
                send: async (message) => this.send(id, message),
                kill: async () => this.kill(id)
            };

            this.instances.set(id, instance);
            this.activeId = id;
            return instance;
        } catch (error) {
            this._cleanupInstance(id);
            handleError(error);
            throw error;
        }
    },

    /**
     * Sends a message to a sidecar instance.
     */
    async send(idOrMessage, message) {
        let id = typeof message === 'undefined' ? this.activeId : idOrMessage;
        const payload = typeof message === 'undefined' ? idOrMessage : message;

        if (!id) {
            throw new Error('No sidecar id provided and no active sidecar exists.');
        }

        const instance = this.instances.get(id);
        if (!instance) {
            throw new Error(`No sidecar instance found for id '${id}'.`);
        }

        return await instance.child.write(normalizeMessage(payload));
    },

    /**
     * Kills a sidecar instance.
     */
    async kill(id) {
        const targetId = id ?? this.activeId;
        if (!targetId) return false;

        const instance = this.instances.get(targetId);
        if (!instance) return false;

        try {
            await instance.child.kill();
            return true;
        } catch (e) {
            console.error(`[Sidecar] Failed to kill ${targetId}:`, e);
            return false;
        } finally {
            this._cleanupInstance(targetId);
        }
    },

    /**
     * Kills all running sidecar instances.
     */
    async killAll() {
        const killPromises = Array.from(this.instances.keys()).map(id => this.kill(id));
        return await Promise.all(killPromises);
    },

    /**
     * Gets a sidecar instance by ID.
     */
    get(id) {
        return this.instances.get(id) ?? null;
    },

    /**
     * Lists all running sidecar instances.
     */
    list() {
        return Array.from(this.instances.values()).map((instance) => ({
            id: instance.id,
            program: instance.program,
            pid: instance.pid
        }));
    },

    /**
     * Checks if a sidecar (or any sidecar) is running.
     */
    isRunning(id) {
        if (typeof id === 'string') {
            return this.instances.has(id);
        }
        return this.instances.size > 0;
    },

    /**
     * Convenience method for Bun sidecars.
     */
    async bun(data = {}) {
        return this.spawn({ engine: 'bun', ...data });
    },

    /**
     * Convenience method for NodeJS (Bun) sidecars.
     */
    async nodeJS(data = {}) {
        return this.bun(data);
    },

    /**
     * Convenience method for Python sidecars.
     */
    async python(data = {}) {
        return this.spawn({ engine: 'python', ...data });
    }
};

/**
 * Proxy to allow direct access to sidecar instances via Sidecar.id
 */
const Sidecar = new Proxy(SidecarBase, {
    get(target, prop) {
        if (prop in target) {
            return target[prop];
        }
        // Allow accessing instances by ID directly: Sidecar.bun1
        if (target.instances.has(prop)) {
            return target.instances.get(prop);
        }
        return undefined;
    }
});

// --- Auto-Register ---
Tauri.register('sidecar', Sidecar);

export default Sidecar;