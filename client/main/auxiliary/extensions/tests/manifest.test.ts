// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { getNetworkSources, networkHostToSource, validateAuxExtensionManifest, type AuxExtensionManifest } from '../manifest';
import { withContentSecurityPolicy } from '../csp';

function createManifest(overrides: Partial<AuxExtensionManifest> = {}): AuxExtensionManifest {
    return {
        type: 'jamovi-aux-extension',
        id: 'example-extension',
        name: 'Example',
        version: '1.0.0',
        apiVersion: 'jamovi.aux.v1',
        order: 10,
        entrypoint: 'builtin:example',
        permissions: [],
        ...overrides,
    };
}

describe('networkHostToSource', () => {
    it('converts accepted host forms to https sources', () => {
        expect(networkHostToSource('api.example.org')).toBe('https://api.example.org');
        expect(networkHostToSource('*.example.org')).toBe('https://*.example.org');
        expect(networkHostToSource('https://API.example.org:8443/')).toBe('https://api.example.org:8443');
    });

    it('rejects other schemes, paths and anything that could alter the policy', () => {
        expect(networkHostToSource('http://api.example.org')).toBeNull();
        expect(networkHostToSource('api.example.org/path')).toBeNull();
        expect(networkHostToSource("api.example.org; script-src 'unsafe-eval'")).toBeNull();
        expect(networkHostToSource('*')).toBeNull();
        expect(networkHostToSource('api.example.org:70000')).toBeNull();
        expect(networkHostToSource('')).toBeNull();
    });

    it('collects a manifest\'s sources', () => {
        expect(getNetworkSources(createManifest({ network: { hosts: [ 'a.example.org', 'b.example.org' ] } })))
            .toEqual([ 'https://a.example.org', 'https://b.example.org' ]);
        expect(getNetworkSources(createManifest())).toEqual([]);
    });
});

describe('validateAuxExtensionManifest', () => {
    it('accepts ids that are not built in views', () => {
        expect(() => validateAuxExtensionManifest(createManifest({ id: 'my-extension-2' }))).not.toThrow();
        expect(() => validateAuxExtensionManifest(createManifest({ id: 'org.example.dataset-audit' }))).not.toThrow();
    });

    it('rejects ids that are not lowercase letters, digits and hyphens', () => {
        expect(() => validateAuxExtensionManifest(createManifest({ id: 'My Extension' }))).toThrow();
        expect(() => validateAuxExtensionManifest(createManifest({ id: '2-extension' }))).toThrow();
        expect(() => validateAuxExtensionManifest(createManifest({ id: 'x"]' }))).toThrow();
        expect(() => validateAuxExtensionManifest(createManifest({ id: 'org..example' }))).toThrow();
    });

    it('rejects permissions that are not implemented yet, unless trusted', () => {
        expect(() => validateAuxExtensionManifest(createManifest({ permissions: [ 'read:variables', 'ui:notifications' ] }))).not.toThrow();
        expect(() => validateAuxExtensionManifest(createManifest({ permissions: [ 'action:editDataset' ] }))).toThrow();
        expect(() => validateAuxExtensionManifest(
            createManifest({ permissions: [ 'action:installModule' ], builtIn: true, trusted: true }),
            { trustedRequired: true })).not.toThrow();
    });

    it('rejects invalid network hosts', () => {
        expect(() => validateAuxExtensionManifest(createManifest({ network: { hosts: [ 'http://example.org' ] } }))).toThrow();
    });
});

describe('withContentSecurityPolicy', () => {
    it('places the policy before the document content', () => {
        const html = withContentSecurityPolicy('<!doctype html><html><head><script>x()</script></head></html>', []);

        expect(html.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true);
        expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script>'));
    });

    it('blocks connections unless hosts are declared', () => {
        expect(withContentSecurityPolicy('<p></p>', [])).toContain("connect-src 'none'");
        expect(withContentSecurityPolicy('<p></p>', [ 'https://api.example.org' ])).toContain('connect-src https://api.example.org;');
    });

    it('applies the policy when the document is parsed', () => {
        const parsed = new DOMParser().parseFromString(withContentSecurityPolicy('<html><head><title>t</title></head><body></body></html>', []), 'text/html');
        const meta = parsed.head.querySelector('meta[http-equiv="Content-Security-Policy"]');

        expect(meta).not.toBeNull();
        expect(meta!.getAttribute('content')).toContain("default-src 'none'");
        expect(parsed.head.firstElementChild).toBe(meta);
    });
});
