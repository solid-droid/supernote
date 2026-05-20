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
globalThis.navigator = { userAgent: 'NodeTest' };
globalThis.window = {
    location: {
        hostname: 'localhost',
        origin: 'http://localhost:5173',
    },
};

const pluginService = await import('../src/Services/Plugin/PluginService.js');
const { __testing } = pluginService;

test('buildVariantsQuery builds encoded variants query string', () => {
    const query = __testing.buildVariantsQuery(['primary', 'secondary']);
    assert.equal(query, 'variants=primary%2Csecondary');
});

test('resolveModuleSpecifier keeps absolute http url', () => {
    const resolved = __testing.resolveModuleSpecifier('https://example.com/plugin.js');
    assert.equal(resolved, 'https://example.com/plugin.js');
});

test('resolveStyleAssets maps style entries from metadata exports', () => {
    const styles = __testing.resolveStyleAssets({
        exports: {
            styles: [
                { path: '/plugin-assets/button/Button.css' },
                { url: 'https://cdn.example.com/base.css' },
            ],
        },
    });

    assert.deepEqual(styles, ['/plugin-assets/button/Button.css', 'https://cdn.example.com/base.css']);
});
