import test from 'node:test';
import assert from 'node:assert/strict';

function createStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}

globalThis.localStorage = createStorage();
Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'NodeTest' },
    configurable: true,
});
globalThis.window = {
    location: {
        hostname: 'localhost',
        origin: 'http://localhost:5173',
    },
};

const pluginService = await import('../src/Services/Plugin/PluginService.js');
const { __testing } = pluginService;

test('parseWidgetEntry maps object widget ref with alias to full Superhub slug', () => {
    const parsed = __testing.parseWidgetEntry({
        slug: 'design-system>Atom.button.icon@latest',
        alias: 'IconButton',
    });

    assert.equal(parsed.path, 'design-system>Atom.button.icon');
    assert.equal(parsed.versionToken, 'latest');
    assert.equal(parsed.fullSlug, 'widget>design-system>Atom.button.icon');
    assert.equal(parsed.isLatest, true);
    assert.equal(parsed.alias, 'IconButton');
});

test('compareVersions sorts semantic versions correctly', () => {
    assert.equal(__testing.compareVersions('1.2.0', '1.1.9') > 0, true);
    assert.equal(__testing.compareVersions('2.0.0', '2.0.0'), 0);
    assert.equal(__testing.compareVersions('1.0.0', '1.0.1') < 0, true);
});

test('shouldUseMinified prefers explicit package flag', () => {
    assert.equal(__testing.shouldUseMinified({ minified: false }), false);
    assert.equal(__testing.shouldUseMinified({ minified: true }), true);
    assert.equal(__testing.shouldUseMinified({}), true);
});

test('buildPluginServerUrl composes clean paths', () => {
    const value = __testing.buildPluginServerUrl('http://localhost:3005', '/meta/widget');
    assert.equal(value, 'http://localhost:3005/meta/widget');
});

test('parseThemeEntry accepts full theme-prefixed refs from widget metadata', () => {
    const parsed = __testing.parseThemeEntry('theme>design-system>Color.Dark@1.0.0');

    assert.equal(parsed.path, 'design-system>Color.Dark');
    assert.equal(parsed.versionToken, '1.0.0');
    assert.equal(parsed.fullSlug, 'theme>design-system>Color.Dark');
});
