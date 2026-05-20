const PLUGIN_SERVER_URL = 'http://localhost:3001';
let plugins = {};

function loadPlugin(slug, version) {
    // Implementation for loading a specific plugin
}

function loadDefaults() {
    // load button and add to plugins
    let designSystemMeta = loadPlugin('design-system');
    let buttonDS = designSystemMeta?.widgets?.find(x => x.slug === 'button');
    let buttonWidget = loadPlugin(buttonDS.slug, buttonDS.version);
    if(buttonWidget) {
        plugins['button'] = buttonWidget;
    }
}

function getPlugins() {
  return plugins;
}

export {
    loadPlugin,
    loadDefaults,
    getPlugins,
}
