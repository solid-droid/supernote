/** @type {import('./types').ITauri} */

import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
const registry = new Map();

const ghost = (prop) => new Proxy(() => {}, {
    get: () => {
        console.warn(`✨ Tauri.${prop} is not plugged in.`);
        return () => Tauri;
    },
    apply: () => {
        console.warn(`✨ Tauri.${prop}() called but not found.`);
        return Tauri;
    }
});

const tauriBase = {
    window: !!window.__TAURI__ ? getCurrentWindow() : null,
    env: {
        isTauri: !!window.__TAURI__,
        isMobile: /Android|iPhone|iPad/i.test(navigator.userAgent),
        isDev: false
    },
    
    // The "Plug" Mechanism
    register(name, plugin) {
        registry.set(name, plugin);
        console.log(`🔌 Plugin Attached: Tauri.${name}`);
        return Tauri; 
    },

    // Core Window Methods
    close() { this.window?.close(); return Tauri; },
    minimize() { this.window?.minimize(); return Tauri; },
    async resize(w, h) {
        await this.window?.setSize(new LogicalSize(w, h));
        await this.window?.center();
        return Tauri;
    }
};

// Initial Dev Mode Check
if (tauriBase.env.isTauri) {
    window.__TAURI__.core?.invoke('is_dev_mode').then(res => tauriBase.env.isDev = res).catch(() => {});
}

export const Tauri = new Proxy(tauriBase, {
    get(target, prop) {
        // 1. Skip Promise checks
        if (prop === 'then') return undefined;

        // 2. Return actual properties or plugins
        if (prop in target) return target[prop];
        if (registry.has(prop)) return registry.get(prop);

        // 3. Fallback to Ghost
        return ghost(prop);
    }
});