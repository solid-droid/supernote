import './main.css';
import { loadDefaults, getPlugins, reloadPlugins } from '../Services/Plugin/PluginService.js';

export async function start() {
    await loadDefaults();
    createBasicUI();
}

const DOM = { 
    root: null,
    header: null,
    body: null,
    footer: null,
};

function createBasicUI() {
    DOM.root = $('#chamber-app');


    DOM.header = $('<div class="app-header" data-tauri-drag-region>Header</div>');
    DOM.root.append(DOM.header);
    
    DOM.body = $('<div class="app-body">Body</div>');
    DOM.root.append(DOM.body);
    loadsamplebody();

    DOM.footer = $('<div class="app-footer">Footer new version</div>');
    DOM.root.append(DOM.footer);
}

async function loadsamplebody() {
    const { Tauri, Log } = window.CHAMBER;
    
    const output = $('<div id="output"></div>');

    const logToOutput = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const colors = {
            info: '#d4d4d4',
            error: '#f44747',
            success: '#6a9955',
            warn: '#cca700'
        };
        const color = colors[type] || colors.info;
        const line = $(`<div><span style="color: #888">[${timestamp}]</span> <span style="color: ${color}">${msg}</span></div>`);
        
        output.append(line);
        
        // Auto-scroll to bottom
        output.scrollTop(output[0].scrollHeight);
        
        Log[type]?.(msg);
    };

    const bun_sidecar_button = createActionButton({
        label: 'Spawn Bun Sidecar',
        onClick: async () => {
        try {
            logToOutput('Spawning Bun sidecar...');
            const handle = await Tauri.sidecar.bun({
                onMessage: (msg) => logToOutput(`[Bun] ${msg}`, 'success'),
                onError: (err) => logToOutput(`[Bun Error] ${err}`, 'error'),
                onExit: (payload) => logToOutput(`[Bun Exited] code: ${payload.code}`, 'warn')
            });
            logToOutput(`Bun spawned with PID: ${handle.pid}`, 'success');
        } catch (e) {
            logToOutput(`Failed to spawn Bun: ${e.message}`, 'error');
        }
    }
    });

    const python_sidecar_button = createActionButton({
        label: 'Spawn Python Sidecar',
        onClick: async () => {
        try {
            logToOutput('Spawning Python sidecar...');
            const handle = await Tauri.sidecar.python({
                onMessage: (msg) => logToOutput(`[Python] ${msg}`, 'success'),
                onError: (err) => logToOutput(`[Python Error] ${err}`, 'error'),
                onExit: (payload) => logToOutput(`[Python Exited] code: ${payload.code}`, 'warn')
            });
            logToOutput(`Python spawned with PID: ${handle.pid}`, 'success');
        } catch (e) {
            logToOutput(`Failed to spawn Python: ${e.message}`, 'error');
        }
    }
    });

    const list_sidecars_button = createActionButton({
        label: 'List Running Sidecars',
        variant: 'secondary',
        onClick: () => {
        const instances = Tauri.sidecar.list();
        if (instances.length === 0) {
            logToOutput('No sidecars currently running.', 'warn');
        } else {
            logToOutput(`Running Sidecars (${instances.length}):`, 'info');
            instances.forEach(inst => {
                logToOutput(`- ID: ${inst.id} | Program: ${inst.program} | PID: ${inst.pid}`, 'success');
            });
        }
    }
    });

    const kill_sidecars_button = createActionButton({
        label: 'Kill All Sidecars',
        variant: 'danger',
        onClick: async () => {
        logToOutput('Killing all sidecars...', 'warn');
        await Tauri.sidecar.killAll();
        logToOutput('All sidecars termination signal sent.', 'info');
    }
    });

    const greet_button = createActionButton({
        label: 'Greet Rust',
        onClick: async () => {
        if (window.__TAURI__) {
            try {
                const response = await window.__TAURI__.core.invoke('greet', { name: 'Chamber User' });
                logToOutput(`Rust says: ${response}`, 'success');
            } catch (e) {
                logToOutput(`Greet failed: ${e}`, 'error');
            }
        } else {
            logToOutput('Tauri not detected.', 'error');
        }
    }
    });

    const reload_latest_versions_button = createActionButton({
        label: 'Reload UI (Latest Versions)',
        variant: 'secondary',
        onClick: async () => {
        try {
            const reloadResult = await reloadPlugins({
                versionMode: 'latest',
                forceReload: true,
            });

            await loadsamplebody();
            await Tauri.services.notify(
                `Reloaded ${reloadResult.count} configured plugins using latest available versions.`,
                { title: 'Plugins Updated', kind: 'info' }
            );
        } catch (error) {
            logToOutput(`Latest-version UI reload failed: ${error?.message || error}`, 'error');
        }
    }
    });

    const reload_configured_versions_button = createActionButton({
        label: 'Reload UI (Configured Versions)',
        variant: 'secondary',
        onClick: async () => {
        try {
            const reloadResult = await reloadPlugins({
                versionMode: 'configured',
                forceReload: true,
            });

            await loadsamplebody();
            await Tauri.services.notify(
                `Reloaded ${reloadResult.count} configured plugins using package versions.`,
                { title: 'UI Reloaded', kind: 'info' }
            );
        } catch (error) {
            logToOutput(`Configured-version UI reload failed: ${error?.message || error}`, 'error');
        }
    }
    });

    DOM.body.empty().append(
        $('<div class="controls"></div>').append(
            bun_sidecar_button, 
            python_sidecar_button, 
            list_sidecars_button,
            kill_sidecars_button, 
            greet_button,
            reload_latest_versions_button,
            reload_configured_versions_button
        ),
        output
    );
}

function createActionButton(options = {}) {
    const label = options.label || 'Button';
    const plugin = getPlugins().button?.implementation;

    if (plugin) {
        const ButtonClass = plugin.default || plugin;
        const instance = new ButtonClass({
            label,
            variant: options.variant || 'primary',
            disabled: !!options.disabled,
            onClick: options.onClick || null,
        });

        return $(instance.element);
    }

    const button = $('<button></button>').text(label);
    if (options.onClick) {
        button.on('click', options.onClick);
    }
    return button;
}