function normalizeBaseUrl(url) {
	return String(url || '').replace(/\/+$/, '');
}

function buildPluginServerUrl(baseUrl, pathname = '') {
	if (!pathname) {
		return baseUrl;
	}

	return `${baseUrl}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

function withCacheBuster(url) {
	try {
		const parsed = new URL(url, window.location.origin);
		parsed.searchParams.set('_t', String(Date.now()));
		return parsed.toString();
	} catch {
		return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
	}
}

function resolveInitialPluginServerUrl(defaultPluginServerUrl, pluginServerOverrideKey) {
	const envUrl = import.meta.env?.VITE_PLUGIN_SERVER_URL;
	const storedUrl = localStorage.getItem(pluginServerOverrideKey);
	const packageUrl = String(defaultPluginServerUrl || '').trim();
	const explicitUrl = packageUrl || storedUrl || envUrl;

	let base = explicitUrl;
	if (!base) {
		const host = window.location.hostname;
		if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'tauri.localhost') {
			base = `http://${host}:3005`;
		}
	}

	base = normalizeBaseUrl(base || defaultPluginServerUrl);

	if (/Android/i.test(navigator.userAgent)) {
		try {
			const parsed = new URL(base);
			if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'tauri.localhost') {
				parsed.hostname = '10.0.2.2';
				return normalizeBaseUrl(parsed.toString());
			}
		} catch {
			// Ignore malformed override and keep base.
		}
	}

	return base;
}

function compareVersions(a, b) {
	const aParts = String(a || '').split('.').map((value) => Number(value));
	const bParts = String(b || '').split('.').map((value) => Number(value));
	const maxLen = Math.max(aParts.length, bParts.length);

	for (let index = 0; index < maxLen; index += 1) {
		const aPart = Number.isFinite(aParts[index]) ? aParts[index] : 0;
		const bPart = Number.isFinite(bParts[index]) ? bParts[index] : 0;

		if (aPart > bPart) {
			return 1;
		}
		if (aPart < bPart) {
			return -1;
		}
	}

	return 0;
}

function normalizeAlias(rawAlias, path) {
	const explicit = String(rawAlias || '').trim();
	if (explicit) {
		return explicit;
	}

	const lastSegment = String(path || '').split('>').filter(Boolean).pop() || 'Widget';
	return lastSegment
		.split(/[.\-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join('');
}

function parsePluginReference(ref, typePrefix) {
	const raw = String(ref || '').trim();
	const atIndex = raw.lastIndexOf('@');
	if (atIndex <= 0 || atIndex === raw.length - 1) {
		throw new Error(`Invalid plugin entry: ${raw}`);
	}

	const rawPath = raw.slice(0, atIndex).trim();
	const versionToken = raw.slice(atIndex + 1).trim();
	if (!rawPath || !versionToken || !rawPath.includes('>')) {
		throw new Error(`Invalid plugin entry: ${raw}`);
	}

	const prefix = `${typePrefix}>`;
	const path = rawPath.startsWith(prefix)
		? rawPath.slice(prefix.length)
		: rawPath;

	return {
		raw,
		path,
		versionToken,
		fullSlug: `${typePrefix}>${path}`,
		isLatest: versionToken.toLowerCase() === 'latest',
	};
}

function parseWidgetReference(ref) {
	return parsePluginReference(ref, 'widget');
}

function parseThemeReference(ref) {
	return parsePluginReference(ref, 'theme');
}

function parseWidgetEntry(entry) {
	if (typeof entry === 'string') {
		const parsed = parseWidgetReference(entry);
		return {
			...parsed,
			slugRef: entry,
			alias: normalizeAlias('', parsed.path),
		};
	}

	if (entry && typeof entry === 'object') {
		const parsed = parseWidgetReference(entry.slug);
		return {
			...parsed,
			slugRef: entry.slug,
			alias: normalizeAlias(entry.alias, parsed.path),
		};
	}

	throw new Error(`Invalid widget entry: ${JSON.stringify(entry)}`);
}

function parseThemeEntry(entry) {
	if (typeof entry === 'string') {
		const parsed = parseThemeReference(entry);
		return {
			...parsed,
			slugRef: entry,
			alias: normalizeAlias('', parsed.path),
		};
	}

	if (entry && typeof entry === 'object') {
		const parsed = parseThemeReference(entry.slug);
		return {
			...parsed,
			slugRef: entry.slug,
			alias: normalizeAlias(entry.alias, parsed.path),
		};
	}

	throw new Error(`Invalid theme entry: ${JSON.stringify(entry)}`);
}

function getPackageWidgetEntries(pluginPackage) {
	const widgetEntries = Array.isArray(pluginPackage?.widgets) ? pluginPackage.widgets : [];
	return widgetEntries.map(parseWidgetEntry);
}

function getPackageThemeEntries(pluginPackage) {
	const themeEntries = Array.isArray(pluginPackage?.themes) ? pluginPackage.themes : [];
	return themeEntries.map(parseThemeEntry);
}

function shouldUseMinified(pluginPackage) {
	if (typeof pluginPackage?.minified === 'boolean') {
		return pluginPackage.minified;
	}

	return true;
}

function parseJsonResponse(payload, errorLabel) {
	if (!payload || payload.ok !== true) {
		const msg = payload?.error || errorLabel;
		throw new Error(msg);
	}
}

function getEntryFileName(fileUrl) {
	const value = String(fileUrl || '').trim();
	if (!value) {
		return '';
	}

	const clean = value.split('?')[0].split('#')[0];
	const parts = clean.split('/').filter(Boolean);
	return parts[parts.length - 1] || '';
}

function getEntryJsFile(meta) {
	const files = Array.isArray(meta?.files) ? meta.files : [];
	const explicit = files.find((item) => item?.entry === true && /\.m?js$/i.test(item?.url || ''));
	if (explicit) {
		return getEntryFileName(explicit.url);
	}

	const firstJs = files.find((item) => /\.m?js$/i.test(item?.url || ''));
	if (firstJs) {
		return getEntryFileName(firstJs.url);
	}

	throw new Error(`Plugin ${meta?.slug || 'unknown'} has no JavaScript entry file.`);
}

function getStyleFiles(meta) {
	const files = Array.isArray(meta?.files) ? meta.files : [];
	return files
		.map((item) => getEntryFileName(item?.url))
		.filter((name) => /\.css$/i.test(name));
}

function toCacheKey(slug, version) {
	return `${slug}@${version}`;
}

function normalizeReference(ref) {
	const raw = String(ref || '').trim();
	if (!raw) {
		return '';
	}

	if (raw.startsWith('widget>') || raw.startsWith('theme>')) {
		return raw;
	}

	if (raw.includes('>')) {
		return `widget>${raw}`;
	}

	return raw;
}

function createPluginHelper(options) {
	const {
		pluginPackage,
		defaultPluginServerUrl,
		pluginServerOverrideKey,
	} = options;

	let pluginServerUrl = resolveInitialPluginServerUrl(defaultPluginServerUrl, pluginServerOverrideKey);
	let plugins = {};
	const moduleCache = new Map();
	const loadedStyleHrefs = new Set();

	function getPluginServerUrl() {
		return pluginServerUrl;
	}

	function setPluginServerUrl(url, setOptions = {}) {
		pluginServerUrl = normalizeBaseUrl(url || defaultPluginServerUrl);

		if (setOptions.persist !== false) {
			localStorage.setItem(pluginServerOverrideKey, pluginServerUrl);
		}

		return pluginServerUrl;
	}

	function buildUrl(pathname = '') {
		return buildPluginServerUrl(getPluginServerUrl(), pathname);
	}

	async function fetchMetaBySlugVersion(slug, version) {
		const requestUrl = buildUrl(`/meta/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`);
		const response = await fetch(requestUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch meta for ${slug}@${version}`);
		}

		const payload = await response.json();
		parseJsonResponse(payload, `Invalid meta response for ${slug}@${version}`);
		return payload.data;
	}

	async function fetchMetaVersionsBySlug(slug) {
		const requestUrl = buildUrl(`/meta/${encodeURIComponent(slug)}`);
		const response = await fetch(requestUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch latest meta for ${slug}`);
		}

		const payload = await response.json();
		parseJsonResponse(payload, `Invalid meta list response for ${slug}`);

		const list = Array.isArray(payload.data) ? payload.data : [];
		if (list.length === 0) {
			throw new Error(`No versions found for ${slug}`);
		}

		return [...list].sort((a, b) => compareVersions(b.version, a.version));
	}

	async function resolveWidgetMetadataCandidates(widgetEntry) {
		if (widgetEntry.isLatest) {
			return fetchMetaVersionsBySlug(widgetEntry.fullSlug);
		}

		try {
			const exact = await fetchMetaBySlugVersion(widgetEntry.fullSlug, widgetEntry.versionToken);
			return [exact];
		} catch (error) {
			console.warn(`Falling back to latest for ${widgetEntry.fullSlug}:`, error.message);
			return fetchMetaVersionsBySlug(widgetEntry.fullSlug);
		}
	}

	function buildPluginFileUrl(meta, fileName, loadOptions = {}) {
		const useMinified = loadOptions.useMinified !== false;
		const routeBase = useMinified ? '/plugin' : '/plugin-full';
		return buildUrl(
			`${routeBase}/${encodeURIComponent(meta.slug)}/${encodeURIComponent(meta.version)}/${encodeURIComponent(fileName)}`
		);
	}

	function clearPluginRuntimeState() {
		plugins = {};
		moduleCache.clear();
		loadedStyleHrefs.clear();

		const pluginLinks = document.querySelectorAll('link[data-plugin-style="true"]');
		pluginLinks.forEach((link) => link.remove());
	}

	function loadCssAssets(meta, loadOptions = {}) {
		const forceReload = !!loadOptions.forceReload;
		const cssFiles = getStyleFiles(meta);

		for (const fileName of cssFiles) {
			const href = buildPluginFileUrl(meta, fileName, loadOptions);
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

	async function loadPluginByMetadata(meta, entry, loadOptions = {}) {
		const forceReload = !!loadOptions.forceReload;
		const cacheKey = toCacheKey(meta.slug, meta.version);

		if (!forceReload && moduleCache.has(cacheKey)) {
			const cached = moduleCache.get(cacheKey);
			loadCssAssets(meta, loadOptions);
			plugins[meta.slug] = cached;
			return cached;
		}

		const entryFileName = getEntryJsFile(meta);
		const moduleUrl = buildPluginFileUrl(meta, entryFileName, loadOptions);
		const importUrl = forceReload ? withCacheBuster(moduleUrl) : moduleUrl;

		const loadedModule = await import(/* @vite-ignore */ importUrl);
		const pluginLogic = loadedModule.logic || loadedModule.default || loadedModule.plugin || loadedModule;
		const styleFiles = getStyleFiles(meta);

		loadCssAssets(meta, loadOptions);

		const loaded = {
			entry,
			metadata: meta,
			cacheKey,
			loadedFiles: {
				entryFile: entryFileName,
				styleFiles,
				moduleUrl,
			},
			exports: {
				logic: pluginLogic,
				template: loadedModule.template || null,
				module: loadedModule,
			},
			implementation: pluginLogic,
		};

		moduleCache.set(cacheKey, loaded);
		plugins[meta.slug] = loaded;

		return loaded;
	}

	return {
		getPluginServerUrl,
		setPluginServerUrl,
		clearPluginRuntimeState,
		getPackageWidgetEntries: () => getPackageWidgetEntries(pluginPackage),
		getPackageThemeEntries: () => getPackageThemeEntries(pluginPackage),
		parseThemeEntry,
		resolveWidgetMetadataCandidates,
		loadPluginByMetadata,
		getPlugins: () => plugins,
		getModuleCache: () => moduleCache,
		useMinifiedByDefault: shouldUseMinified(pluginPackage),
		__testing: {
			parseWidgetEntry,
			parseThemeEntry,
			parseWidgetReference,
			parseThemeReference,
			compareVersions,
			shouldUseMinified,
			buildPluginServerUrl,
			normalizeAlias,
		},
	};
}

function createSuperhubRuntime(options) {
	const {
		helper,
		host = window,
		globalName = 'Superhub',
		defaultThemeOrder = ['DarkTheme', 'LightTheme'],
	} = options;

	function ensureGlobal() {
		const existing = host[globalName] && typeof host[globalName] === 'object' ? host[globalName] : {};

		existing.Widgets = existing.Widgets || {};
		existing.Themes = existing.Themes || {};
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

		host[globalName] = existing;
		return existing;
	}

	function createWidgetInvoker(pluginRecord) {
		return (target, opts = {}, dependencyCallback) => {
			const render = pluginRecord?.logic?.render;
			if (typeof render !== 'function') {
				return null;
			}

			const resolver = typeof dependencyCallback === 'function'
				? dependencyCallback
				: host[globalName]?.getDependency;

			return render(target, opts, resolver);
		};
	}

	function createThemeInvoker(pluginRecord, alias) {
		return async (opts = {}, dependencyCallback) => {
			const apply = pluginRecord?.logic?.apply;
			if (typeof apply !== 'function') {
				return null;
			}

			const resolver = typeof dependencyCallback === 'function'
				? dependencyCallback
				: host[globalName]?.getDependency;

			const result = await apply(opts, resolver);
			if (result !== null && result !== false) {
				const superhub = ensureGlobal();
				superhub.activeTheme = alias || pluginRecord.slug;
			}

			return result;
		};
	}

	function registerPlugin(entry, plugin) {
		const slug = plugin.metadata?.slug;
		const version = plugin.metadata?.version;
		const alias = entry.alias;
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

		const superhub = ensureGlobal();
		superhub.cache.byKey[cacheKey] = record;
		superhub.cache.bySlug[slug] = record;
		const isTheme = String(slug || '').startsWith('theme>');

		if (alias) {
			superhub.cache.byAlias[alias] = record;
			if (isTheme) {
				superhub.Themes[alias] = createThemeInvoker(record, alias);
			} else {
				superhub.Widgets[alias] = createWidgetInvoker(record);
			}
		}

		if (isTheme) {
			superhub.Themes[slug] = createThemeInvoker(record, alias);
		} else {
			superhub.Widgets[slug] = createWidgetInvoker(record);
		}

		superhub.getPlugins = getPlugins;
		return record;
	}

	function hasThemeLoaded(themeEntry) {
		const superhub = ensureGlobal();
		const byAlias = superhub.cache.byAlias[themeEntry.alias];
		if (byAlias && byAlias.slug === themeEntry.fullSlug) {
			return true;
		}

		if (themeEntry.versionToken !== 'latest') {
			const key = toCacheKey(themeEntry.fullSlug, themeEntry.versionToken);
			return Boolean(superhub.cache.byKey[key]);
		}

		return Boolean(superhub.cache.bySlug[themeEntry.fullSlug]);
	}

	async function autoLoadThemesForWidget(widgetMeta, loadOptions = {}) {
		const themeRefs = Array.isArray(widgetMeta?.themes) ? widgetMeta.themes : [];
		if (themeRefs.length === 0) {
			return;
		}

		for (const ref of themeRefs) {
			try {
				const themeEntry = helper.parseThemeEntry(ref);
				if (hasThemeLoaded(themeEntry)) {
					continue;
				}

				await loadEntry(themeEntry, {
					...loadOptions,
					forceReload: false,
				});
			} catch (error) {
				console.warn(`Failed to auto-load theme ${ref} for widget ${widgetMeta?.slug || 'unknown'}:`, error);
			}
		}
	}

	async function loadEntry(entry, loadOptions = {}) {
		const candidateMetas = await helper.resolveWidgetMetadataCandidates(entry);
		const useMinified = loadOptions.useMinified ?? helper.useMinifiedByDefault;

		let lastError = null;
		for (const metadata of candidateMetas) {
			try {
				const plugin = await helper.loadPluginByMetadata(metadata, entry, {
					forceReload: !!loadOptions.forceReload,
					useMinified,
				});

				const slug = metadata?.slug || entry.fullSlug;
				const version = metadata?.version || 'unknown';
				const logic = plugin?.exports?.logic || plugin?.implementation || null;
				const isTheme = String(slug).startsWith('theme>');

				if (isTheme) {
					if (typeof logic?.apply !== 'function') {
						throw new Error(`Theme ${slug}@${version} has no apply function.`);
					}
				} else if (typeof logic?.render !== 'function') {
					throw new Error(`Widget ${slug}@${version} has no render function.`);
				}

				registerPlugin(entry, plugin);

				if (!isTheme) {
					await autoLoadThemesForWidget(plugin.metadata, loadOptions);
				}

				return plugin;
			} catch (error) {
				lastError = error;
				console.warn(`Failed widget candidate ${metadata?.slug || entry.fullSlug}@${metadata?.version || 'unknown'}:`, error);
			}
		}

		if (lastError) {
			throw lastError;
		}

		throw new Error(`No plugin candidates available for ${entry.raw}`);
	}

	async function applyDefaultThemeIfAvailable() {
		const superhub = ensureGlobal();

		if (superhub.activeTheme && typeof superhub.Themes?.[superhub.activeTheme] === 'function') {
			return;
		}

		const firstAvailable = defaultThemeOrder.find((alias) => typeof superhub.Themes?.[alias] === 'function')
			|| Object.keys(superhub.Themes || {}).find((key) => typeof superhub.Themes[key] === 'function');

		if (!firstAvailable) {
			return;
		}

		await superhub.Themes[firstAvailable]({}, superhub.getDependency);
	}

	async function loadDefaults(loadOptions = {}) {
		ensureGlobal();
		const widgetEntries = helper.getPackageWidgetEntries();
		const themeEntries = helper.getPackageThemeEntries();
		const useMinified = loadOptions.useMinified ?? helper.useMinifiedByDefault;

		const loaded = [];

		for (const entry of widgetEntries) {
			try {
				const plugin = await loadEntry(entry, {
					forceReload: !!loadOptions.forceReload,
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

		for (const entry of themeEntries) {
			try {
				const plugin = await loadEntry(entry, {
					forceReload: !!loadOptions.forceReload,
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
				console.warn(`Failed to load packaged theme ${entry.raw}:`, error);
			}
		}

		await applyDefaultThemeIfAvailable();

		return {
			count: loaded.length,
			entries: loaded,
		};
	}

	async function reloadPlugins(options = {}) {
		const forceReload = options.forceReload !== false;
		const useMinified = options.useMinified ?? helper.useMinifiedByDefault;

		const superhub = ensureGlobal();
		superhub.Widgets = {};
		superhub.Themes = {};
		superhub.activeTheme = null;
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

	return {
		ensureGlobal,
		loadEntry,
		loadDefaults,
		reloadPlugins,
		getPlugins,
	};
}

export {
	createPluginHelper,
	createSuperhubRuntime,
};
