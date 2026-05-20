const PLUGIN_SERVER_URL = 'http://localhost:3001';
let plugins = {};

async function fetchPluginMetadata(slug, version) {
    const versionSuffix = version ? `/${version}` : '';
    const response = await fetch(`${PLUGIN_SERVER_URL}/plugins/${slug}${versionSuffix}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch plugin metadata for ${slug}${version ? `@${version}` : ''}`);
    }

    const payload = await response.json();

    // /plugins/:slug may return all versions. Use the newest item as the default.
    if (Array.isArray(payload)) {
        return payload[0] || null;
    }

    return payload;
}

function resolveModuleSpecifier(entry) {
    if (!entry || typeof entry !== 'string') {
        throw new Error('Plugin metadata is missing a valid module entry.');
    }

    if (/^https?:\/\//i.test(entry)) {
        return entry;
    }

    if (entry.startsWith('/plugin-assets/')) {
        return `${PLUGIN_SERVER_URL}${entry}`;
    }

    if (entry.startsWith('/')) {
        return `${window.location.origin}${entry}`;
    }

    return `${PLUGIN_SERVER_URL}/${entry.replace(/^\/+/, '')}`;
}

async function loadPlugin(slug, version) {
    const metadata = await fetchPluginMetadata(slug, version);
    if (!metadata) {
        return null;
    }

    const moduleSpecifier = resolveModuleSpecifier(
        metadata.entry || metadata.module || metadata.url || metadata.path
    );

    const loadedModule = await import(/* @vite-ignore */ moduleSpecifier);
    const pluginImpl = loadedModule.default || loadedModule.plugin || loadedModule;

    const key = metadata.slug || slug;
    plugins[key] = {
        metadata,
        implementation: pluginImpl,
    };

    return plugins[key];
}

async function loadDefaults() {
    // load button and add to plugins
    const designSystemMeta = await fetchPluginMetadata('design-system');
    const buttonDS = designSystemMeta?.widgets?.find((x) => x.slug === 'button');

    if (!buttonDS) {
        return;
    }

    const buttonWidget = await loadPlugin(buttonDS.slug, buttonDS.version);
    if (buttonWidget) {
        plugins.button = buttonWidget;
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
