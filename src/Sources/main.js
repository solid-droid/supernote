import './main.css';

export async function start() {
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

    const bun_sidecar_button = $('<button class="action-btn">Spawn Bun Sidecar</button>');
    const python_sidecar_button = $('<button class="action-btn">Spawn Python Sidecar</button>');
    const kill_sidecars_button = $('<button class="action-btn kill-btn">Kill All Sidecars</button>');
    const list_sidecars_button = $('<button class="action-btn">List Running Sidecars</button>');
    const update_app_button = $('<button class="action-btn">Check for Updates</button>');
    const greet_button = $('<button class="action-btn">Greet Rust</button>');
    
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

    bun_sidecar_button.on('click', async () => {
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
    });

    python_sidecar_button.on('click', async () => {
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
    });

    list_sidecars_button.on('click', () => {
        const instances = Tauri.sidecar.list();
        if (instances.length === 0) {
            logToOutput('No sidecars currently running.', 'warn');
        } else {
            logToOutput(`Running Sidecars (${instances.length}):`, 'info');
            instances.forEach(inst => {
                logToOutput(`- ID: ${inst.id} | Program: ${inst.program} | PID: ${inst.pid}`, 'success');
            });
        }
    });

    kill_sidecars_button.on('click', async () => {
        logToOutput('Killing all sidecars...', 'warn');
        await Tauri.sidecar.killAll();
        logToOutput('All sidecars termination signal sent.', 'info');
    });

    update_app_button.on('click', async () => {
        logToOutput('Checking for updates...');
        try {
            await Tauri.updater.check(true);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
            logToOutput(`Update check failed: ${errorMsg}`, 'error');
            console.error('Update Error:', e);
        }
    });

    greet_button.on('click', async () => {
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
    });

    DOM.body.empty().append(
        $('<div class="controls"></div>').append(
            bun_sidecar_button, 
            python_sidecar_button, 
            list_sidecars_button,
            kill_sidecars_button, 
            update_app_button, 
            greet_button
        ),
        output
    );
}