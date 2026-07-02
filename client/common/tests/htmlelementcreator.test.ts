// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { attrs, h, htmlTrusted, rich, richLinksOptions, richParagraphs, richTableOptions, setAttrsSafely, setSafeAttrs, setRich, setText, text, url } from '../htmlelementcreator';

function renderFragment(fragment: DocumentFragment): string {
    const container = document.createElement('div');
    container.append(fragment);
    return container.innerHTML;
}

function renderNodes(nodes: Node[]): string {
    const container = document.createElement('div');
    container.append(...nodes);
    return container.innerHTML;
}

describe('h', () => {
    it('appends sanitized fragments as child nodes', () => {
        const fragment = rich('Hello <strong>there</strong> <span>friend</span>');
        const element = h('div', {}, fragment);

        expect(element.innerHTML).toBe('Hello <strong>there</strong> friend');
    });

    it('accepts explicit text nodes', () => {
        const element = h('div', {}, text('<strong>hello</strong>'));

        expect(element.innerHTML).toBe('&lt;strong&gt;hello&lt;/strong&gt;');
    });

    it('accepts filtered attribute objects', () => {
        const element = h('a', attrs({
            href: 'https://example.com',
            onclick: 'alert(1)',
            title: 'Example',
        }), 'Open');

        expect(element.getAttribute('href')).toBe('https://example.com');
        expect(element.hasAttribute('onclick')).toBe(false);
        expect(element.getAttribute('title')).toBe('Example');
    });
});

describe('htmlTrusted', () => {
    it('parses trusted html into an element', () => {
        const element = htmlTrusted<HTMLDivElement>('<div class="status"></div>');

        expect(element.tagName).toBe('DIV');
        expect(element.className).toBe('status');
    });
});

describe('rich', () => {
    it('returns a fragment that preserves text without reparsing it as html', () => {
        const fragment = rich('a < b && c > d');
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('a &lt; b &amp;&amp; c &gt; d');
    });

    it('preserves only allowed tags', () => {
        const fragment = rich('<p>Hello <strong>there</strong> <span>friend</span></p>');
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('Hello <strong>there</strong> friend');
    });

    it('strips attributes from allowed tags', () => {
        const fragment = rich('<strong class="x" onclick="alert(1)">safe</strong>');
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('<strong>safe</strong>');
    });

    it('drops script and style elements entirely', () => {
        const fragment = rich('<p>safe<script>alert(1)</script><style>p{color:red;}</style>text</p>');
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('safetext');
    });

    it('preserves sub and sup because they are explicitly whitelisted', () => {
        const fragment = rich('x<sub>1</sub> + y<sup>2</sup>');
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('x<sub>1</sub> + y<sup>2</sup>');
    });

    it('supports a table preset for italics, subscript, and superscript only', () => {
        const fragment = rich('<i>i</i><em>em</em><sub>1</sub><sup>2</sup><b>b</b><strong>strong</strong><a href="https://example.com">link</a>', richTableOptions);

        expect(renderFragment(fragment)).toBe('<i>i</i><em>em</em><sub>1</sub><sup>2</sup>bstronglink');
    });

    it('strips links by default', () => {
        const fragment = rich('See <a href="https://example.com">docs</a>');
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('See docs');
    });

    it('preserves safe links when link options are supplied', () => {
        const fragment = rich('See <a href="https://example.com" title="Docs" class="x" onclick="alert(1)">docs</a>', richLinksOptions);
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('See <a href="https://example.com" title="Docs">docs</a>');
    });

    it('can force safe links to open in a new tab', () => {
        const fragment = rich('<a href="https://example.com" target="_self" rel="opener">docs</a>', {
            ...richLinksOptions,
            linkTarget: '_blank',
        });

        expect(renderFragment(fragment)).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a>');
    });

    it('unwraps links without safe href values', () => {
        const fragment = rich('See <a href="javascript:alert(1)" title="Docs">docs</a>', richLinksOptions);
        const container = document.createElement('div');

        container.append(fragment);

        expect(container.innerHTML).toBe('See docs');
    });

    it('preserves safe relative, fragment, mailto, and tel links', () => {
        expect(renderFragment(rich('<a href="/docs">docs</a>', richLinksOptions))).toBe('<a href="/docs">docs</a>');
        expect(renderFragment(rich('<a href="#section">section</a>', richLinksOptions))).toBe('<a href="#section">section</a>');
        expect(renderFragment(rich('<a href="mailto:test@example.com">email</a>', richLinksOptions))).toBe('<a href="mailto:test@example.com">email</a>');
        expect(renderFragment(rich('<a href="tel:+61255550000">phone</a>', richLinksOptions))).toBe('<a href="tel:+61255550000">phone</a>');
    });

    it('preserves allowed rich content inside safe links', () => {
        const fragment = rich('<a href="https://example.com"><strong>docs</strong> <em>now</em></a>', richLinksOptions);

        expect(renderFragment(fragment)).toBe('<a href="https://example.com"><strong>docs</strong> <em>now</em></a>');
    });

    it('drops unsafe nested content inside safe links', () => {
        const fragment = rich('<a href="https://example.com">ok<script>alert(1)</script><style>a{color:red;}</style>text</a>', richLinksOptions);

        expect(renderFragment(fragment)).toBe('<a href="https://example.com">oktext</a>');
    });

    it('scopes allowed attributes to their tag', () => {
        const fragment = rich('<strong title="Docs">safe</strong><a href="https://example.com" title="Docs">docs</a>', richLinksOptions);

        expect(renderFragment(fragment)).toBe('<strong>safe</strong><a href="https://example.com" title="Docs">docs</a>');
    });

    it('sanitizes uppercase link tags and attributes', () => {
        const fragment = rich('<A HREF="https://example.com" ONCLICK="alert(1)">docs</A>', richLinksOptions);

        expect(renderFragment(fragment)).toBe('<a href="https://example.com">docs</a>');
    });

    it('unwraps links with missing or empty href values', () => {
        expect(renderFragment(rich('<a title="Docs">docs</a>', richLinksOptions))).toBe('docs');
        expect(renderFragment(rich('<a href="">docs</a>', richLinksOptions))).toBe('docs');
    });
});

describe('url', () => {
    it('returns safe absolute, relative, and fragment urls', () => {
        expect(url('https://example.com')).toBe('https://example.com');
        expect(url('mailto:test@example.com')).toBe('mailto:test@example.com');
        expect(url('/files/report.omv')).toBe('/files/report.omv');
        expect(url('./local/file')).toBe('./local/file');
        expect(url('#section')).toBe('#section');
        expect(url('   /trimmed/path   ')).toBe('/trimmed/path');
    });

    it('returns the fallback for dangerous or unsupported urls', () => {
        expect(url('javascript:alert(1)', '#')).toBe('#');
        expect(url('data:text/html,<script>alert(1)</script>', '#')).toBe('#');
        expect(url('ftp://example.com/file.txt', '#')).toBe('#');
    });

    it('returns the fallback for an empty url', () => {
        expect(url('')).toBe('');
        expect(url('   ')).toBe('');
        expect(url('   ', '#')).toBe('#');
    });
});

describe('richParagraphs', () => {
    it('splits text into sanitized paragraphs', () => {
        const paragraphs = richParagraphs('First <strong>note</strong>\n\nSecond <span>note</span>');

        expect(renderNodes(paragraphs)).toBe('<p>First <strong>note</strong></p><p>Second note</p>');
    });

    it('omits blank paragraphs', () => {
        const paragraphs = richParagraphs('\n\n First \n\n\n Second \n\n');

        expect(renderNodes(paragraphs)).toBe('<p>First</p><p>Second</p>');
    });

    it('passes options through to rich paragraph content', () => {
        const paragraphs = richParagraphs('See <a href="https://example.com">docs</a>', richLinksOptions);

        expect(renderNodes(paragraphs)).toBe('<p>See <a href="https://example.com">docs</a></p>');
    });
});

describe('attrs', () => {
    it('passes through normal text attributes', () => {
        expect(attrs({ class: 'note', title: 'hello', 'data-id': '7' })).toEqual({
            class: 'note',
            title: 'hello',
            'data-id': '7',
        });
    });

    it('drops event, style, and unsafe url attributes', () => {
        expect(attrs({
            onclick: 'alert(1)',
            style: 'color:red',
            href: 'javascript:alert(1)',
            srcdoc: '<p>x</p>',
            title: 'safe',
        })).toEqual({
            title: 'safe',
        });
    });

    it('keeps safe url attributes', () => {
        expect(attrs({
            href: 'https://example.com',
            src: '/images/icon.png',
            action: './submit',
        })).toEqual({
            href: 'https://example.com',
            src: '/images/icon.png',
            action: './submit',
        });
    });
});

describe('update helpers', () => {
    it('sets already-safe attributes directly', () => {
        const element = document.createElement('div');

        setSafeAttrs(element, attrs({
            class: 'note',
            title: 'Trusted',
        }));

        expect(element.getAttribute('class')).toBe('note');
        expect(element.getAttribute('title')).toBe('Trusted');
    });

    it('filters and applies a raw attribute bag safely', () => {
        const element = document.createElement('a');

        setAttrsSafely(element, {
            href: 'javascript:alert(1)',
            onclick: 'alert(1)',
            title: 'safe',
        });

        expect(element.hasAttribute('href')).toBe(false);
        expect(element.hasAttribute('onclick')).toBe(false);
        expect(element.getAttribute('title')).toBe('safe');
    });

    it('replaces content with safe plain text', () => {
        const element = document.createElement('div');

        setText(element, '<strong>hello</strong>');

        expect(element.innerHTML).toBe('&lt;strong&gt;hello&lt;/strong&gt;');
    });

    it('replaces content with safe whitelist-rich text', () => {
        const element = document.createElement('div');

        setRich(element, 'Hi <strong>there</strong> <span>friend</span>');

        expect(element.innerHTML).toBe('Hi <strong>there</strong> friend');
    });

    it('replaces content with rich text using supplied options', () => {
        const element = document.createElement('div');

        setRich(element, 'See <a href="https://example.com">docs</a>', richLinksOptions);

        expect(element.innerHTML).toBe('See <a href="https://example.com">docs</a>');
    });
});
