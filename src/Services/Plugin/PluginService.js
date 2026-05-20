import defaultPluginPackage from './plugin-package.js';

const DEFAULT_PLUGIN_SERVER_URL = 'http://localhost:3001';
const PLUGIN_SERVER_OVERRIDE_KEY = 'supernote.pluginServerUrl';

function normalizeBaseUrl(url) {
    return String(url || '').replace(/\/+$/, '');
}

function resolveInitialPluginServerUrl() {
    const envUrl = import.meta.env?.VITE_PLUGIN_SERVER_URL;
    const storedUrl = localStorage.getItem(PLUGIN_SERVER_OVERRIDE_KEY);
    const explicitUrl = storedUrl || envUrl;

    let base = explicitUrl;
    if (!base) {
        const host = window.location.hostname;
        if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'tauri.localhost') {
            base = `http://${host}:3001`;
        }
    }

    base = normalizeBaseUrl(base || DEFAULT_PLUGIN_SERVER_URL);

    // Android emulators cannot reach host machine via localhost.
    if (/Android/i.test(navigator.userAgent)) {
        try {
            const parsed = new URL(base);
            if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'tauri.localhost') {
                parsed.hostname = '10.0.2.2';
                return normalizeBaseUrl(parsed.toString());
            }
        } catch {
            // Ignore malformed override and fall back to base.
        }
    }

    return base;
}

let pluginServerUrl = resolveInitialPluginServerUrl();

function getPluginServerUrl() {
    return pluginServerUrl;
}

function setPluginServerUrl(url, options = {}) {
    pluginServerUrl = normalizeBaseUrl(url || DEFAULT_PLUGIN_SERVER_URL);

    if (options.persist !== false) {
        localStorage.setItem(PLUGIN_SERVER_OVERRIDE_KEY, pluginServerUrl);
    }

    return pluginServerUrl;
}

function buildPluginServerUrl(pathname = '') {
    if (!pathname) {
        return getPluginServerUrl();
    }

    return `${getPluginServerUrl()}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

let plugins = {};
const loadedStyleHrefs = new Set();

function withCacheBuster(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        parsed.searchParams.set('_t', String(Date.now()));
        return parsed.toString();
    } catch {
        return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    }
}

function clearPluginRuntimeState() {
    plugins = {};
    loadedStyleHrefs.clear();

    const pluginLinks = document.querySelectorAll('link[data-plugin-style="true"]');
    pluginLinks.forEach((link) => link.remove());
}

function getPackagePluginEntries() {
    const packageEntries = Array.isArray(defaultPluginPackage?.plugins)
        ? defaultPluginPackage.plugins
        : [];

    return packageEntries
        .map((entry) => ({
            slug: entry?.slug,
            version: entry?.version,
            variants: Array.isArray(entry?.variants) ? entry.variants : [],
        }))
        .filter((entry) => entry.slug);
}

function buildVariantsQuery(variants) {
    const cleaned = Array.isArray(variants)
        ? variants.map((value) => String(value || '').trim()).filter(Boolean)
        : [];

    if (cleaned.length === 0) {
        return '';
    }

    return `variants=${encodeURIComponent(cleaned.join(','))}`;
}

async function fetchPluginMetadata(slug, version, options = {}) {
    const versionSuffix = version ? `/${version}` : '';
    const variantsQuery = buildVariantsQuery(options.variants);
    const requestUrl = buildPluginServerUrl(`/plugins/${slug}${versionSuffix}${variantsQuery ? `?${variantsQuery}` : ''}`);
    const response = await fetch(requestUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch plugin metadata for ${slug}${version ? `@${version}` : ''}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        const body = await response.text();
        const bodyPreview = body.slice(0, 120).replace(/\s+/g, ' ');
        throw new Error(
            `Invalid plugin metadata response from ${requestUrl}. Expected JSON, got ${contentType || 'unknown'}: ${bodyPreview}`
        );
    }

    const payload = await response.json();

    // /plugins/:slug may return all versions. Use the newest item as the default.
    if (Array.isArray(payload)) {
        return payload[0] || null;
    }

    return payload;
}

async function fetchPluginMetadataWithFallback(slug, version, options = {}) {
    try {
        return await fetchPluginMetadata(slug, version, options);
    } catch (error) {
        // If a pinned version is missing after versioning changes, fallback to latest.
        if (version) {
            console.warn(`Falling back to latest for plugin ${slug}; requested version ${version} is unavailable.`);
            return fetchPluginMetadata(slug, undefined, options);
        }

        throw error;
    }
}

function resolveModuleSpecifier(entry) {
    if (!entry || typeof entry !== 'string') {
        throw new Error('Plugin metadata is missing a valid module entry.');
    }

    if (/^https?:\/\//i.test(entry)) {
        return entry;
    }

    if (entry.startsWith('/plugin-assets/')) {
        return buildPluginServerUrl(entry);
    }

    if (entry.startsWith('/plugins/')) {
        return buildPluginServerUrl(entry);
    }

    if (entry.startsWith('/')) {
        return `${window.location.origin}${entry}`;
    }

    return buildPluginServerUrl(entry.replace(/^\/+/, ''));
}

function getPluginLogicEntry(metadata) {
    if (metadata?.exports?.logic?.url) {
        return metadata.exports.logic.url;
    }

    if (metadata?.entry) {
        return metadata.entry;
    }

    throw new Error(`Plugin ${metadata?.slug || 'unknown'} is missing exports.logic.url`);
}

function resolveAssetHref(assetPath, metadata) {
    if (!assetPath || typeof assetPath !== 'string') {
        return null;
    }

    if (/^https?:\/\//i.test(assetPath)) {
        return assetPath;
    }

    if (assetPath.startsWith('/plugin-assets/')) {
        return buildPluginServerUrl(assetPath);
    }

    if (assetPath.startsWith('/')) {
        return buildPluginServerUrl(assetPath);
    }

    if (metadata?.slug) {
        return buildPluginServerUrl(`/plugins/${metadata.slug}/assets/${assetPath.replace(/^\/+/, '')}`);
    }

    return buildPluginServerUrl(assetPath.replace(/^\/+/, ''));
}

function resolveStyleAssets(metadata) {
    const styleExports = Array.isArray(metadata?.exports?.styles) ? metadata.exports.styles : [];
    return styleExports
        .map((entry) => entry?.url || entry?.path)
        .filter((path) => typeof path === 'string' && path.length > 0);
}

function loadCssAssets(metadata, options = {}) {
    const forceReload = !!options.forceReload;
    const styleAssets = resolveStyleAssets(metadata);

    for (const styleAsset of styleAssets) {
        const href = resolveAssetHref(styleAsset, metadata);
        if (!href) {
            continue;
        }

        if (!forceReload && loadedStyleHrefs.has(href)) {
            continue;
        }

        const finalHref = forceReload ? withCacheBuster(href) : href;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = finalHref;
        link.dataset.pluginStyle = 'true';
        document.head.appendChild(link);
        loadedStyleHrefs.add(href);
    }
}

async function loadPluginByMetadata(metadata, fallbackSlug, options = {}) {
    if (!metadata) {
        return null;
    }

    const forceReload = !!options.forceReload;

    const moduleSpecifier = resolveModuleSpecifier(getPluginLogicEntry(metadata));
    const importSpecifier = forceReload ? withCacheBuster(moduleSpecifier) : moduleSpecifier;

    const loadedModule = await import(/* @vite-ignore */ importSpecifier);
    const pluginLogic = loadedModule.logic || loadedModule.default || loadedModule.plugin || loadedModule;
    const pluginTemplate = loadedModule.template || null;

    loadCssAssets(metadata, { forceReload });

    const key = metadata.slug || fallbackSlug;
    const selectedVariants = Array.isArray(options.variants) && options.variants.length > 0
        ? options.variants
        : (Array.isArray(metadata?.selectedVariants) ? metadata.selectedVariants : []);

    plugins[key] = {
        metadata,
        selectedVariants,
        exports: {
            logic: pluginLogic,
            template: pluginTemplate,
            module: loadedModule,
        },
        implementation: pluginLogic,
    };

    return plugins[key];
}

async function loadPlugin(slug, version, options = {}) {
    const selectedVariants = Array.isArray(options.variants) ? options.variants : [];
    const metadata = await fetchPluginMetadataWithFallback(slug, version, {
        variants: selectedVariants,
    });
    return loadPluginByMetadata(metadata, slug, {
        ...options,
        variants: selectedVariants,
    });
}

async function loadDefaults() {
    const packageEntries = getPackagePluginEntries();

    // Prefer explicit package list for testing/default bootstrap.
    for (const entry of packageEntries) {
        if (!entry?.slug) {
            continue;
        }

        try {
            await loadPlugin(entry.slug, entry.version, {
                variants: entry.variants,
            });
        } catch (error) {
            console.warn(`Failed to load packaged plugin ${entry.slug}:`, error);
        }
    }
}

async function reloadPlugins(options = {}) {
    const versionMode = options.versionMode === 'latest' ? 'latest' : 'configured';
    const forceReload = options.forceReload !== false;
    const entries = getPackagePluginEntries();

    clearPluginRuntimeState();

    const loaded = [];
    for (const entry of entries) {
        try {
            const requestedVersion = versionMode === 'latest' ? undefined : entry.version;
            const plugin = await loadPlugin(entry.slug, requestedVersion, {
                forceReload,
                variants: entry.variants,
            });
            if (plugin) {
                loaded.push({
                    slug: plugin.metadata?.slug || entry.slug,
                    version: plugin.metadata?.version || entry.version,
                    variants: plugin.selectedVariants || [],
                });
            }
        } catch (error) {
            console.warn(`Failed to reload plugin ${entry.slug}:`, error);
        }
    }

    return {
        mode: versionMode,
        count: loaded.length,
        entries: loaded,
    };
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
    const entries = getPackagePluginEntries();

    const moduleCode = buildPluginManifestModule(entries, {
        mode: 'package',
    });

    const filename = options.filename || 'plugin-package.generated.js';
    downloadTextFile(filename, moduleCode);

    return {
        mode: 'package',
        count: entries.length,
        filename,
        entries,
    };
}

function getPlugins() {
  return plugins;
}

const __testing = {
        buildVariantsQuery,
        resolveModuleSpecifier,
        resolveStyleAssets,
        resolveAssetHref,
        getPluginLogicEntry,
};

export {
    loadPlugin,
    loadDefaults,
    getPlugins,
    updatePlugins,
    reloadPlugins,
    getPluginServerUrl,
    setPluginServerUrl,
    __testing,
}
