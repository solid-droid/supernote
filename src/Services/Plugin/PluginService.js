import defaultPluginPackage from './plugin-package.js';
import { createPluginHelper, createSuperhubRuntime } from './superhub/superhub.js';

const DEFAULT_PLUGIN_SERVER_URL = normalizeDefaultServerUrl(defaultPluginPackage?.superhub);
const PLUGIN_SERVER_OVERRIDE_KEY = 'supernote.pluginServerUrl';

function normalizeDefaultServerUrl(url) {
	const value = String(url || '').trim();
	return value ? value.replace(/\/+$/, '') : 'http://localhost:3005';
}

const helper = createPluginHelper({
	pluginPackage: defaultPluginPackage,
	defaultPluginServerUrl: DEFAULT_PLUGIN_SERVER_URL,
	pluginServerOverrideKey: PLUGIN_SERVER_OVERRIDE_KEY,
});

const runtime = createSuperhubRuntime({
	helper,
	host: window,
	globalName: 'Superhub',
});

const {
	getPluginServerUrl,
	setPluginServerUrl,
} = helper;

function ensureSuperhubGlobal() {
	return runtime.ensureGlobal();
}

async function loadWidget(entry, options = {}) {
	return runtime.loadEntry(entry, options);
}

async function loadDefaults(options = {}) {
	return runtime.loadDefaults(options);
}

async function reloadPlugins(options = {}) {
	return runtime.reloadPlugins(options);
}

function getPlugins() {
	return runtime.getPlugins();
}

const __testing = helper.__testing;

export {
	ensureSuperhubGlobal,
	loadWidget,
	loadDefaults,
	getPlugins,
	reloadPlugins,
	getPluginServerUrl,
	setPluginServerUrl,
	__testing,
};
