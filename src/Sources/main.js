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

function getPluginLogic(slug) {
    const plugin = getPlugins()[slug];
    return plugin?.exports?.logic || plugin?.implementation || null;
}

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
   
}