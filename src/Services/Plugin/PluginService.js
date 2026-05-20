const PLUGIN_SERVER_URL = 'http://localhost:3001';
import defaultPluginPackage from './plugin-package.js';

let plugins = {};
const loadedStyleHrefs = new Set();

async function fetchAllPluginsLatest() {
    const response = await fetch(`${PLUGIN_SERVER_URL}/plugins`);
    if (!response.ok) {
        throw new Error('Failed to fetch latest plugins list.');
    }
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
}

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

async function fetchPluginMetadataByUrl(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch plugin metadata from ${url}`);
    }

    return response.json();
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

    if (entry.startsWith('/plugins/')) {
        return `${PLUGIN_SERVER_URL}${entry}`;
    }

    if (entry.startsWith('/')) {
        return `${window.location.origin}${entry}`;
    }

    return `${PLUGIN_SERVER_URL}/${entry.replace(/^\/+/, '')}`;
}

function inferEntryFromLegacy(metadata) {
    const files = Array.isArray(metadata?.Files) ? metadata.Files : [];
    const firstLocalJs = files.find((f) => {
        if (!f || typeof f.path !== 'string') {
            return false;
        }
        return (f.type || 'local') === 'local' && f.path.toLowerCase().endsWith('.js');
    });

    if (!firstLocalJs) {
        return null;
    }

    const slug = metadata?.slug;
    if (slug) {
        return `/plugins/${slug}/assets/${firstLocalJs.path.replace(/^\/+/, '')}`;
    }

    return firstLocalJs.path;
}

function resolveAssetHref(assetPath, metadata) {
    if (!assetPath || typeof assetPath !== 'string') {
        return null;
    }

    if (/^https?:\/\//i.test(assetPath)) {
        return assetPath;
    }

    if (assetPath.startsWith('/plugin-assets/')) {
        return `${PLUGIN_SERVER_URL}${assetPath}`;
    }

    if (assetPath.startsWith('/')) {
        return `${PLUGIN_SERVER_URL}${assetPath}`;
    }

    if (metadata?.slug) {
        return `${PLUGIN_SERVER_URL}/plugins/${metadata.slug}/assets/${assetPath.replace(/^\/+/, '')}`;
    }

    return `${PLUGIN_SERVER_URL}/${assetPath.replace(/^\/+/, '')}`;
}

function loadCssAssets(metadata) {
    const files = Array.isArray(metadata?.Files) ? metadata.Files : [];
    const cssFiles = files.filter((f) => {
        if (!f || typeof f.path !== 'string') {
            return false;
        }
        return f.path.toLowerCase().endsWith('.css');
    });

    for (const cssFile of cssFiles) {
        const href = resolveAssetHref(cssFile.path, metadata);
        if (!href || loadedStyleHrefs.has(href)) {
            continue;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        loadedStyleHrefs.add(href);
    }
}

async function loadPluginByMetadata(metadata, fallbackSlug) {
    if (!metadata) {
        return null;
    }

    const entry = metadata.entry || metadata.module || metadata.url || metadata.path || inferEntryFromLegacy(metadata);
    const moduleSpecifier = resolveModuleSpecifier(entry);

    const loadedModule = await import(/* @vite-ignore */ moduleSpecifier);
    const pluginImpl = loadedModule.default || loadedModule.plugin || loadedModule;

    loadCssAssets(metadata);

    const key = metadata.slug || fallbackSlug;
    plugins[key] = {
        metadata,
        implementation: pluginImpl,
    };

    return plugins[key];
}

async function loadPlugin(slug, version) {
    const metadata = await fetchPluginMetadata(slug, version);
    return loadPluginByMetadata(metadata, slug);
}

async function loadDefaults() {
    const packageEntries = Array.isArray(defaultPluginPackage?.plugins)
        ? defaultPluginPackage.plugins
        : [];

    // Prefer explicit package list for testing/default bootstrap.
    for (const entry of packageEntries) {
        if (!entry?.slug) {
            continue;
        }

        try {
            await loadPlugin(entry.slug, entry.version);
        } catch (error) {
            console.warn(`Failed to load packaged plugin ${entry.slug}:`, error);
        }
    }

    if (plugins.button) {
        return;
    }

    // Fallback: load button via Design System discovery.
    const designSystemMeta = await fetchPluginMetadata('design-system');
    const buttonDS = designSystemMeta?.widgets?.find((x) => x.slug === 'button');

    if (!buttonDS) {
        return;
    }

    let buttonWidget = null;

    if (buttonDS.meta) {
        const metaUrl = buttonDS.meta.startsWith('http')
            ? buttonDS.meta
            : `${PLUGIN_SERVER_URL}${buttonDS.meta.startsWith('/') ? '' : '/'}${buttonDS.meta}`;
        const buttonMeta = await fetchPluginMetadataByUrl(metaUrl);
        buttonWidget = await loadPluginByMetadata(
            {
                ...buttonMeta,
                slug: buttonMeta.slug || buttonDS.slug,
            },
            buttonDS.slug
        );
    } else {
        buttonWidget = await loadPlugin(buttonDS.slug, buttonDS.version);
    }

    if (buttonWidget) {
        plugins.button = buttonWidget;
    }
}

function getConfiguredPluginVersions() {
    return Object.values(plugins)
        .map((plugin) => plugin?.metadata)
        .filter(Boolean)
        .map((meta) => ({ slug: meta.slug, version: meta.version }))
        .filter((entry) => entry.slug && entry.version);
}

function buildPluginManifestModule(entries, options = {}) {
    const generatedAt = new Date().toISOString();
    const mode = options.mode || 'latest';
    const manifest = {
        generatedAt,
        mode,
        plugins: entries,
    };

    return [
        '// Auto-generated by Supernote plugin updater',
        `export const pluginPackage = ${JSON.stringify(manifest, null, 2)};`,
        '',
        'export default pluginPackage;',
        '',
    ].join('\n');
}

function downloadTextFile(filename, content, mimeType = 'application/javascript') {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

async function updatePlugins(options = {}) {
    const useConfiguredVersions = !!options.useConfiguredVersions;
    const latest = await fetchAllPluginsLatest();

    const entries = useConfiguredVersions
        ? getConfiguredPluginVersions()
        : latest
            .map((meta) => ({ slug: meta.slug, version: meta.version }))
            .filter((entry) => entry.slug && entry.version);

    const moduleCode = buildPluginManifestModule(entries, {
        mode: useConfiguredVersions ? 'configured' : 'latest',
    });

    const filename = options.filename || 'plugin-package.generated.js';
    downloadTextFile(filename, moduleCode);

    return {
        mode: useConfiguredVersions ? 'configured' : 'latest',
        count: entries.length,
        filename,
        entries,
    };
}

function getPlugins() {
  return plugins;
}

export {
    loadPlugin,
    loadDefaults,
    getPlugins,
    updatePlugins,
}
