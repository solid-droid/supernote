import './main.css';
import {
    loadDefaults,
    getPlugins,
    reloadPlugins,
} from '../Services/Plugin/PluginService.js';

export async function start() {
    await loadDefaults();
    window.Supernote.getPlugins = getPlugins;
    createBasicUI();
}

const DOM = { 
    root: null,
    header: null,
    body: null,
    footer: null,
    reloadButton: null,
    reloadStatus: null,
    samplesHost: null,
};

function getWidget(alias) {
    return window.Superhub?.Widgets?.[alias] || null;
}

function createBasicUI() {
    DOM.root = $('#chamber-app');

    DOM.header = $('<div class="app-header" data-tauri-drag-region></div>');
    DOM.header.append('<div class="app-header-title">Supernote</div>');
    
    DOM.reloadButton = $('<button class="reload-plugins-button" type="button">Reload Plugins</button>');
    DOM.reloadStatus = $('<div class="reload-plugins-status">Ready</div>');
   
    DOM.header.append(DOM.reloadButton);
    DOM.header.append(DOM.reloadStatus);
    DOM.root.append(DOM.header);
    
    DOM.body = $('<div class="app-body"></div>');
    DOM.samplesHost = $('<div class="sample-widgets"></div>');
    DOM.body.append(DOM.samplesHost);
    DOM.root.append(DOM.body);
    loadsamplebody();

    DOM.footer = $('<div class="app-footer">Plugin Host</div>');
    DOM.root.append(DOM.footer);

    DOM.reloadButton.on('click', onReloadPlugins);
}

async function loadsamplebody() {
    if (!DOM.samplesHost) {
        return;
    }

    DOM.samplesHost.empty();

    const baseWidget = getWidget('Button');
    const iconWidget = getWidget('IconButton');

    const section = $('<div class="sample-section"></div>');
    section.append('<h3>Design System Buttons</h3>');

    const row = $('<div class="sample-row"></div>');
    section.append(row);
    DOM.samplesHost.append(section);

    const baseTarget = $('<div class="sample-cell sample-cell--button"></div>');
    const iconTarget = $('<div class="sample-cell sample-cell--icon"></div>');
    row.append(baseTarget);
    row.append(iconTarget);

    if (typeof baseWidget === 'function') {
        baseWidget(baseTarget[0], {
            label: 'Primary Action',
            onClick: () => {
                DOM.reloadStatus.text('Primary clicked');
            },
        }, window.Superhub?.getDependency);
    } else {
        baseTarget.append('<div class="sample-error">Superhub.Widgets.Button is not available.</div>');
    }

    if (typeof iconWidget === 'function') {
        iconWidget(iconTarget[0], {
            label: 'Icon Action',
            icon: '⚙',
            onClick: () => {
                DOM.reloadStatus.text('Icon clicked');
            },
        }, window.Superhub?.getDependency);
    } else {
        iconTarget.append('<div class="sample-error">Superhub.Widgets.IconButton is not available.</div>');
    }
}

async function onReloadPlugins() {
    if (!DOM.reloadButton || !DOM.reloadStatus) {
        return;
    }

    DOM.reloadButton.prop('disabled', true);
    DOM.reloadStatus.text('Reloading plugins...');

    try {
        const summary = await reloadPlugins({ forceReload: true });
        await loadsamplebody();
        DOM.reloadStatus.text(`Reloaded ${summary.count} plugin(s)`);
    } catch (error) {
        DOM.reloadStatus.text(`Reload failed: ${error.message}`);
    } finally {
        DOM.reloadButton.prop('disabled', false);
    }
}