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

function parseWidgetReference(ref) {
	const raw = String(ref || '').trim();
	const atIndex = raw.lastIndexOf('@');
	if (atIndex <= 0 || atIndex === raw.length - 1) {
		throw new Error(`Invalid widget entry: ${raw}`);
	}

	const path = raw.slice(0, atIndex).trim();
	const versionToken = raw.slice(atIndex + 1).trim();
	if (!path || !versionToken || !path.includes('>')) {
		throw new Error(`Invalid widget entry: ${raw}`);
	}

	return {
		raw,
		path,
		versionToken,
		fullSlug: `widget>${path}`,
		isLatest: versionToken.toLowerCase() === 'latest',
	};
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

function getPackageWidgetEntries(pluginPackage) {
	const widgetEntries = Array.isArray(pluginPackage?.widgets) ? pluginPackage.widgets : [];
	return widgetEntries.map(parseWidgetEntry);
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

	async function fetchLatestMetaBySlug(slug) {
		const list = await fetchMetaVersionsBySlug(slug);
		return list[0];
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

	async function loadPluginByMetadata(meta, widgetEntry, loadOptions = {}) {
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
			widget: widgetEntry,
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

	function getPlugins() {
		return plugins;
	}

	function getWidgetEntries() {
		return getPackageWidgetEntries(pluginPackage);
	}

	return {
		getPluginServerUrl,
		setPluginServerUrl,
		clearPluginRuntimeState,
		getPackageWidgetEntries: getWidgetEntries,
		resolveWidgetMetadataCandidates,
		loadPluginByMetadata,
		getPlugins,
		getModuleCache: () => moduleCache,
		useMinifiedByDefault: shouldUseMinified(pluginPackage),
		__testing: {
			parseWidgetEntry,
			parseWidgetReference,
			compareVersions,
			shouldUseMinified,
			buildPluginServerUrl,
			normalizeAlias,
		},
	};
}

export {
	createPluginHelper,
};
