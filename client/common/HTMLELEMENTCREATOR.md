# HTML Element Creator v2

This module provides a small DOM API with explicit trust boundaries.

Typical import:

```ts
import {
    h,
    text,
    htmlTrusted,
    rich,
    richLinksOptions,
    richParagraphs,
    richTableOptions,
    url,
    attrs,
    setSafeAttrs,
    setAttrsSafely,
    setText,
    setRich,
} from '../common/htmlelementcreator';
```

## Main Idea

- `h()` builds trusted DOM structure.
- `htmlTrusted()` parses already-trusted HTML.
- `text()` creates an explicit text node.
- `rich()` sanitizes untrusted text into limited inline markup.
- `richLinksOptions` enables the standard inline tags plus safe links.
- `richTableOptions` enables italics, subscript, and superscript only.
- `richParagraphs()` splits untrusted text into sanitized paragraphs.
- `url()` reduces an untrusted URL to an allowed value or fallback.
- `attrs()` filters a partially untrusted attribute object.
- `setSafeAttrs()` applies an already-safe attribute object.
- `setAttrsSafely()` filters a raw attribute object and applies it safely.
- `setText()` and `setRich()` safely replace existing content.

## API

### `h(tag, attrs?, ...children)`

Builds an element.

- string children become text nodes
- `Node` children are appended as-is
- attrs are trusted

Example:

```ts
const button = h('button', { class: 'save' }, 'Save');
```

### `htmlTrusted(html)`

Parses a trusted HTML string into an element.

Use this only for:

- fixed internal markup
- trusted generated HTML

Do not use it for user input.

Example:

```ts
const el = htmlTrusted<HTMLDivElement>('<div class="status"></div>');
```

### `text(input)`

Creates a text node explicitly.

This is optional. Plain string children are already treated as text by `h()`.

Use `text()` when you want that intent to be explicit in the code.

Example:

```ts
const el = h('div', {}, text(userText));
```

### `rich(text, options?)`

Sanitizes text into a `DocumentFragment`.

Default allowed inline tags:

- `b`
- `em`
- `i`
- `strong`
- `sub`
- `sup`

Example:

```ts
const el = h('p', {}, rich(userDescription));
```

Use `richLinksOptions` when descriptions should allow links:

```ts
const el = h('p', {}, rich(userDescription, richLinksOptions));
```

With `richLinksOptions`, `<a>` is allowed with safe `href` and `title`
attributes only. Unsafe links are unwrapped so their text remains visible.

Use `linkTarget: '_blank'` to force sanitized links to open in a new tab:

```ts
const el = h('p', {}, rich(userDescription, {
    ...richLinksOptions,
    linkTarget: '_blank',
}));
```

This adds `target="_blank"` and `rel="noopener noreferrer"` to safe links.
The source HTML is not trusted to provide `target` or `rel`.

Use `richTableOptions` for table headings and cells:

```ts
const cell = h('td', {}, rich(cellText, richTableOptions));
```

This allows `<i>`, `<em>`, `<sub>`, and `<sup>`.

### `richParagraphs(text, options?)`

Splits text on blank lines and returns sanitized paragraph elements.

Example:

```ts
const paragraphs = richParagraphs(userDescription);
container.append(...paragraphs);
```

Options are passed through to `rich()`:

```ts
container.append(...richParagraphs(userDescription, richLinksOptions));
```

### `url(value, fallback = '')`

Returns a safe URL, or the fallback.

Allowed:

- `http:`
- `https:`
- `mailto:`
- `tel:`
- relative paths
- fragments

Example:

```ts
const href = url(userUrl, '#');
```

### `attrs(input)`

Filters an attribute object and returns a safe attribute bag.

It removes:

- `on*`
- `style`
- `srcdoc`
- `srcset`
- unsafe URL values

Example:

```ts
const a = h('a', attrs({
    href: url(userUrl, '#'),
    target: '_blank',
    rel: 'noopener noreferrer',
    ...maybeUntrustedAttrs,
}), 'Open');
```

### `setSafeAttrs(element, attrs)`

Applies attributes that are already safe.

Use this with the result of `attrs(...)`.

Example:

```ts
setSafeAttrs(link, attrs({
    href: url(userUrl, '#'),
    ...maybeUntrustedAttrs,
}));
```

### `setAttrsSafely(element, attrs)`

Takes a raw attribute object, filters it, and applies the safe result.

Example:

```ts
setAttrsSafely(link, {
    href: url(userUrl, '#'),
    ...maybeUntrustedAttrs,
});
```

### `setText(element, text)`

Replaces existing content with plain text.

Example:

```ts
setText(label, userText);
```

### `setRich(element, text, options?)`

Replaces existing content with sanitized whitelist-rich content.

Example:

```ts
setRich(panel, userDescription);
```

## Common Patterns

### Plain text

```ts
const el = h('div', { class: 'note' }, userText);
```

or explicitly:

```ts
const el = h('div', { class: 'note' }, text(userText));
```

### Rich text

```ts
const el = h('div', { class: 'desc' }, rich(userDescription));
```

### Rich text with links

```ts
const el = h('div', { class: 'desc' }, rich(userDescription, richLinksOptions));
```

### Rich text with new-tab links

```ts
const el = h('div', { class: 'desc' }, rich(userDescription, {
    ...richLinksOptions,
    linkTarget: '_blank',
}));
```

### Rich paragraph text

```ts
const el = h('div', { class: 'desc' }, ...richParagraphs(userDescription));
```

### Safe link

```ts
const link = h('a', attrs({
    href: url(userUrl, '#'),
    target: '_blank',
    rel: 'noopener noreferrer',
    ...maybeUntrustedAttrs,
}), 'Open');
```

### Trusted HTML

```ts
const loading = htmlTrusted('<div class="loading-indicator"></div>');
```

### Update existing content

```ts
setText(title, userTitle);
setRich(body, userDescription);
setRich(body, userDescription, richLinksOptions);
```
