import { Tauri } from '../Tauri/Tauri.js';
import '../Tauri/Services.js';
import '../Tauri/Sidecar.js';
import '../Tauri/Updater.js';

import { Log } from '../Log/Log.js';


import $ from 'jquery';




async function loadGlobals() {
    /* Window Variables */
    
    window.$ = $;
    window.jQuery = $;
    
    window.Supernote = {
        Tauri,
        Log
    };

    window.Superhub = window.Superhub || {
        Widgets: {},
        cache: {
            byKey: {},
            bySlug: {},
            byAlias: {},
        },
        getDependency: () => null,
    };
}


export { loadGlobals };