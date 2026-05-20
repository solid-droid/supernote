import './main.css';
import {
    loadDefaults,
    getPlugins,
    reloadPlugins,
    getPluginServerUrl,
    setPluginServerUrl,
} from '../Services/Plugin/PluginService.js';

export async function start() {
    await loadDefaults();
    window.CHAMBER.getPlugins = getPlugins;
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
    const pluginServerInput = $('<input type="text" class="plugin-server-input" />');
    pluginServerInput.val(getPluginServerUrl());

    const pluginServerSection = $('<div class="plugin-server-section"></div>').append(
        $('<div class="plugin-server-label">Plugin Server URL</div>'),
        pluginServerInput
    );
    
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
        output.scrollTop(output[0].scrollHeight);
        Log[type]?.(msg);
    };

    const bun_sidecar_button = createActionButton({
        label: 'Spawn Bun',
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
        label: 'Spawn Python',
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
        label: 'List Sidecars',
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
        label: 'Kill Sidecars',
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
        label: 'Reload UI (Latest)',
        variant: 'secondary',
        onClick: async () => {
            try {
                const reloadResult = await reloadPlugins({
                    versionMode: 'latest',
                    forceReload: true,
                });
                const pluginList = (reloadResult.entries || [])
                    .map((entry) => `${entry.slug}@${entry.version || 'latest'}`)
                    .join(', ');
                await loadsamplebody();
                logToOutput(`Reloaded ${reloadResult.count} plugins using latest available versions: ${pluginList}`, 'success');
            } catch (error) {
                logToOutput(`Latest reload failed: ${error?.message || error}`, 'error');
            }
        }
    });

    const reload_configured_versions_button = createActionButton({
        label: 'Reload UI (Configured)',
        variant: 'secondary',
        onClick: async () => {
            try {
                const reloadResult = await reloadPlugins({
                    versionMode: 'configured',
                    forceReload: true,
                });
                const pluginList = (reloadResult.entries || [])
                    .map((entry) => `${entry.slug}@${entry.version || 'latest'}`)
                    .join(', ');
                await loadsamplebody();
                logToOutput(`Reloaded ${reloadResult.count} plugins using package versions: ${pluginList}`, 'success');
            } catch (error) {
                logToOutput(`Configured reload failed: ${error?.message || error}`, 'error');
            }
        }
    });

    const apply_plugin_server_button = createActionButton({
        label: 'Apply Server URL',
        variant: 'secondary',
        onClick: async () => {
            try {
                const requestedUrl = String(pluginServerInput.val() || '').trim();
                const appliedUrl = setPluginServerUrl(requestedUrl);
                pluginServerInput.val(appliedUrl);
                logToOutput(`Saved server URL: ${appliedUrl}`, 'success');
            } catch (error) {
                logToOutput(`Failed to apply plugin server URL: ${error?.message || error}`, 'error');
            }
        }
    });

    const test_plugin_server_button = createActionButton({
        label: 'Test Server URL',
        variant: 'secondary',
        onClick: async () => {
            try {
                const requestedUrl = String(pluginServerInput.val() || '').trim();
                const appliedUrl = setPluginServerUrl(requestedUrl);
                pluginServerInput.val(appliedUrl);

                const testUrl = `${appliedUrl}/plugins`;
                const response = await fetch(testUrl, { method: 'GET' });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const payload = await response.json();
                const count = Array.isArray(payload) ? payload.length : 1;
                logToOutput(`Server reachable! Returned ${count} plugin(s).`, 'success');
            } catch (error) {
                logToOutput(`Registry test failed: ${error?.message || error}`, 'error');
            }
        }
    });

    // Create the two-column dashboard
    const dashboardLayout = $('<div class="dashboard-layout"></div>');
    
    // Left: System console and actions
    const leftCol = $('<div class="dashboard-col left-col"></div>').append(
        $('<div class="section-title">System & Sidecars</div>'),
        $('<div class="controls-grid"></div>').append(
            bun_sidecar_button, 
            python_sidecar_button, 
            list_sidecars_button,
            kill_sidecars_button, 
            greet_button,
            reload_latest_versions_button,
            reload_configured_versions_button,
            apply_plugin_server_button,
            test_plugin_server_button
        ),
        $('<div class="section-title">Console Logs</div>'),
        output
    );

    // Right: Design System playground
    const rightCol = $('<div class="dashboard-col right-col"></div>');
    buildPlayground(rightCol, logToOutput);

    dashboardLayout.append(leftCol, rightCol);

    DOM.body.empty().append(
        pluginServerSection,
        dashboardLayout
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

function buildPlayground(container, log) {
    const playSection = $('<div class="playground-section"></div>');

    // 1. Theme Card
    const themeCard = $('<div class="playground-card"></div>');
    themeCard.append($('<div class="playground-card-title">Theme System</div>'));
    
    const baseThemeSelect = $('<select class="plugin-server-input" style="padding: 6px 10px; font-size:12px;"><option value="dark">Dark Theme</option><option value="light">Light Theme</option></select>');
    const styleThemeSelect = $('<select class="plugin-server-input" style="padding: 6px 10px; font-size:12px;"><option value="modern">Modern Style</option><option value="glass">Glassmorphism</option><option value="retro">Retro/Vintage</option></select>');
    
    const applyThemeBtn = createActionButton({
        label: 'Apply Theme',
        onClick: () => {
            const base = baseThemeSelect.val();
            const style = styleThemeSelect.val();
            const themePlugin = getPlugins().theme?.implementation;
            if (themePlugin) {
                const ThemeClass = themePlugin.default || themePlugin;
                let themeInst;
                if (typeof ThemeClass === 'function') {
                    themeInst = new ThemeClass();
                } else {
                    themeInst = ThemeClass;
                }
                themeInst.apply(base, style);
                log(`Applied Theme: Base = ${base}, Style = ${style}`, 'success');
            } else {
                log('Theme plugin is not loaded yet.', 'error');
            }
        }
    });

    themeCard.append(
        $('<div class="theme-selector-grid"></div>').append(baseThemeSelect, styleThemeSelect),
        applyThemeBtn
    );

    // 2. Atoms Card
    const atomsCard = $('<div class="playground-card"></div>');
    atomsCard.append($('<div class="playground-card-title">Atoms Showcase</div>'));

    // Buttons variants
    const btnRow = $('<div class="showcase-row"></div>');
    const ButtonImpl = getPlugins().button?.implementation;
    const ButtonClass = ButtonImpl ? (ButtonImpl.default || ButtonImpl) : null;
    if (ButtonClass) {
        const Primary = new ButtonClass({ label: 'Primary Button', variant: 'primary', onClick: () => log('Primary atom clicked', 'success') });
        const Secondary = new ButtonClass({ label: 'Secondary Button', variant: 'secondary', onClick: () => log('Secondary atom clicked', 'success') });
        const Danger = new ButtonClass({ label: 'Danger Button', variant: 'danger', onClick: () => log('Danger atom clicked', 'error') });
        btnRow.append(Primary.element, Secondary.element, Danger.element);
    } else {
        btnRow.append('Button plugin not loaded');
    }

    // Input Mirror
    const inputContainer = $('<div style="display: flex; flex-direction: column; gap: 4px; width: 100%;"></div>');
    const InputImpl = getPlugins().input?.implementation;
    const InputClass = InputImpl ? (InputImpl.default || InputImpl) : null;
    const mirrorText = $('<div style="font-size: 11px; color: var(--ds-text-color, #ccc); opacity: 0.8; font-weight: 500;">Typed mirror: (waiting for input)</div>');
    if (InputClass) {
        const inputInstance = new InputClass({
            label: 'Text Mirror Input',
            placeholder: 'Type something here...',
            onChange: (e) => {
                const val = e.target.value;
                mirrorText.text(val ? `Typed mirror: "${val}"` : 'Typed mirror: (waiting for input)');
            }
        });
        inputContainer.append(inputInstance.element, mirrorText);
    } else {
        inputContainer.append('Input plugin not loaded');
    }

    atomsCard.append(btnRow, $('<div style="margin-top: 8px; width: 100%;"></div>').append(inputContainer));

    // 3. Components Card
    const compCard = $('<div class="playground-card"></div>');
    compCard.append($('<div class="playground-card-title">Components Showcase</div>'));

    // Dynamic Form
    const FormImpl = getPlugins().form?.implementation;
    const FormClass = FormImpl ? (FormImpl.default || FormImpl) : null;
    const formContainer = $('<div class="showcase-form-container" style="border: 1px dashed rgba(255,255,255,0.1); padding: 10px; border-radius: 6px;"></div>');
    if (FormClass) {
        const formInst = new FormClass({
            fields: [
                { id: 'name', label: 'Client Name', type: 'text', placeholder: 'Jane Doe', required: true },
                { id: 'email', label: 'Contact Email', type: 'email', placeholder: 'jane@example.com', required: true }
            ],
            submitLabel: 'Register Client',
            onSubmit: (values) => {
                log(`Form Submitted: ${JSON.stringify(values)}`, 'success');
                window.CHAMBER.Tauri.services.notify(`Welcome ${values.name}!`, { title: 'Registration Successful', kind: 'success' });
            }
        });
        formContainer.append(formInst.element);
    } else {
        formContainer.append('Form plugin not loaded');
    }

    // Dynamic Popup Button
    const PopupImpl = getPlugins().popup?.implementation;
    const PopupClass = PopupImpl ? (PopupImpl.default || PopupImpl) : null;
    const launchPopupBtn = createActionButton({
        label: 'Launch Draggable Popup',
        onClick: () => {
            if (PopupClass) {
                const popupInst = new PopupClass({
                    title: 'Interactive Modal Popup',
                    content: `
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <p style="margin: 0; font-size: 13px; opacity:0.9;">This modal window is loaded dynamically from the registry. You can drag it by clicking and moving its header!</p>
                            <div id="popup-form-slot" style="margin-top:6px;"></div>
                        </div>
                    `,
                    footer: $('<div class="showcase-row"></div>').append(
                        createActionButton({
                            label: 'Close Window',
                            variant: 'secondary',
                            onClick: () => popupInst.close()
                        }),
                        createActionButton({
                            label: 'Submit Action',
                            onClick: () => {
                                log('Action submitted from within popup!', 'success');
                                popupInst.close();
                            }
                        })
                    )[0]
                });
                popupInst.open();

                // Mount a mini-form or input inside the popup content once open!
                setTimeout(() => {
                    const slot = document.getElementById('popup-form-slot');
                    if (slot && InputClass) {
                        const inPop = new InputClass({
                            label: 'Secret Key Code',
                            placeholder: 'Type code...'
                        });
                        inPop.mount(slot);
                    }
                }, 50);
            } else {
                log('Popup plugin not loaded.', 'error');
            }
        }
    });

    compCard.append(formContainer, $('<div style="margin-top: 10px; display:flex; justify-content: flex-end;"></div>').append(launchPopupBtn));

    playSection.append(themeCard, atomsCard, compCard);
    container.append(playSection);
}