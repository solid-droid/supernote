import defaultPluginPackage from './plugin-package.js';
import { createPluginHelper } from './PluginHelper.js';

const DEFAULT_PLUGIN_SERVER_URL = normalizeDefaultServerUrl(defaultPluginPackage?.superhub);
const PLUGIN_SERVER_OVERRIDE_KEY = 'supernote.pluginServerUrl';

function normalizeDefaultServerUrl(url) {
    const value = String(url || '').trim();
    return value ? value.replace(/\/+$/, '') : 'http://localhost:3005';
}

// Service acts as an orchestrator; helper owns stateful/runtime details.
const helper = createPluginHelper({
    pluginPackage: defaultPluginPackage,
    defaultPluginServerUrl: DEFAULT_PLUGIN_SERVER_URL,
    pluginServerOverrideKey: PLUGIN_SERVER_OVERRIDE_KEY,
});

const {
    getPluginServerUrl,
    setPluginServerUrl,
} = helper;

function normalizeReference(ref) {
    const raw = String(ref || '').trim();
    if (!raw) {
        return '';
    }

    if (raw.startsWith('widget>')) {
        return raw;
    }

    if (raw.includes('>')) {
        return `widget>${raw}`;
    }

    return raw;
}

function toCacheKey(slug, version) {
    return `${slug}@${version}`;
}

function ensureSuperhubGlobal() {
    const existing = window.Superhub && typeof window.Superhub === 'object' ? window.Superhub : {};

    existing.Widgets = existing.Widgets || {};
    existing.cache = existing.cache || {
        byKey: {},
        bySlug: {},
        byAlias: {},
    };

    existing.getDependency = (reference) => {
        const ref = String(reference || '').trim();
        if (!ref) {
            return null;
        }

        if (existing.cache.byAlias[ref]) {
            return existing.cache.byAlias[ref];
        }

        const normalized = normalizeReference(ref);
        if (normalized.includes('@') && existing.cache.byKey[normalized]) {
            return existing.cache.byKey[normalized];
        }

        if (existing.cache.bySlug[normalized]) {
            return existing.cache.bySlug[normalized];
        }

        return null;
    };

    window.Superhub = existing;
    return existing;
}

function createWidgetInvoker(pluginRecord) {
    return (target, options = {}, dependencyCallback) => {
        const render = pluginRecord?.logic?.render;
        if (typeof render !== 'function') {
            return null;
        }

        const resolver = typeof dependencyCallback === 'function'
            ? dependencyCallback
            : window.Superhub?.getDependency;

        return render(target, options, resolver);
    };
}

function registerPluginInGlobal(widgetEntry, plugin) {
    const slug = plugin.metadata?.slug;
    const version = plugin.metadata?.version;
    const alias = widgetEntry.alias;
    const cacheKey = toCacheKey(slug, version);
    const logic = plugin?.exports?.logic || plugin?.implementation || null;

    const record = {
        key: cacheKey,
        slug,
        version,
        alias,
        metadata: plugin.metadata,
        loadedFiles: plugin.loadedFiles || null,
        logic,
        plugin,
    };

    const superhub = ensureSuperhubGlobal();
    superhub.cache.byKey[cacheKey] = record;
    superhub.cache.bySlug[slug] = record;
    if (alias) {
        superhub.cache.byAlias[alias] = record;
        superhub.Widgets[alias] = createWidgetInvoker(record);
    }

    superhub.Widgets[slug] = createWidgetInvoker(record);
    superhub.getPlugins = getPlugins;
    return record;
}

async function loadWidget(widgetEntry, options = {}) {
    const candidateMetas = await helper.resolveWidgetMetadataCandidates(widgetEntry);
    const useMinified = options.useMinified ?? helper.useMinifiedByDefault;

    let lastError = null;
    for (const metadata of candidateMetas) {
        try {
            const plugin = await helper.loadPluginByMetadata(metadata, widgetEntry, {
                forceReload: !!options.forceReload,
                useMinified,
            });

            const render = plugin?.exports?.logic?.render || plugin?.implementation?.render;
            if (typeof render !== 'function') {
                throw new Error(`Widget ${metadata?.slug || widgetEntry.fullSlug}@${metadata?.version || 'unknown'} has no render function.`);
            }

            registerPluginInGlobal(widgetEntry, plugin);

            return plugin;
        } catch (error) {
            lastError = error;
            console.warn(`Failed widget candidate ${metadata?.slug || widgetEntry.fullSlug}@${metadata?.version || 'unknown'}:`, error);
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new Error(`No plugin candidates available for ${widgetEntry.raw}`);
}

async function loadDefaults(options = {}) {
    ensureSuperhubGlobal();
    const packageEntries = helper.getPackageWidgetEntries();
    const useMinified = options.useMinified ?? helper.useMinifiedByDefault;

    const loaded = [];

    for (const entry of packageEntries) {
        try {
            const plugin = await loadWidget(entry, {
                forceReload: !!options.forceReload,
                useMinified,
            });
            if (plugin) {
                loaded.push({
                    slug: plugin.metadata?.slug,
                    version: plugin.metadata?.version,
                    requested: entry.raw,
                });
            }
        } catch (error) {
            console.warn(`Failed to load packaged widget ${entry.raw}:`, error);
        }
    }

    return {
        count: loaded.length,
        entries: loaded,
    };
}

async function reloadPlugins(options = {}) {
    const forceReload = options.forceReload !== false;
    const useMinified = options.useMinified ?? helper.useMinifiedByDefault;

    const superhub = ensureSuperhubGlobal();
    superhub.Widgets = {};
    superhub.cache = {
        byKey: {},
        bySlug: {},
        byAlias: {},
    };

    helper.clearPluginRuntimeState();
    const loaded = await loadDefaults({
        forceReload,
        useMinified,
    });

    return {
        mode: useMinified ? 'minified' : 'full',
        forceReload,
        ...loaded,
    };
}

function getPlugins() {
    return helper.getPlugins();
}

const __testing = helper.__testing;

export {
    loadWidget,
    loadDefaults,
    getPlugins,
    reloadPlugins,
    getPluginServerUrl,
    setPluginServerUrl,
    __testing,
};
