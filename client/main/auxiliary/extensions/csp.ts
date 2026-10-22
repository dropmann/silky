/**
 * Adds a Content-Security-Policy to an extension's document, limiting it to
 * its own inline content and connections to its declared network hosts. The
 * policy is placed before anything else in the document, so it applies
 * before any of the extension's own content is parsed.
 */
export function withContentSecurityPolicy(documentHtml: string, networkSources: string[]): string {
    const connectSources = networkSources.length > 0 ? networkSources.join(' ') : "'none'";
    const policy = [
        "default-src 'none'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline'",
        'img-src data: blob:',
        'font-src data:',
        `connect-src ${ connectSources }`,
        "base-uri 'none'",
        "form-action 'none'",
    ].join('; ');
    const meta = `<meta http-equiv="Content-Security-Policy" content="${ policy }">`;

    const doctype = /^\s*<!doctype[^>]*>/i.exec(documentHtml);
    if (doctype !== null)
        return doctype[0] + meta + documentHtml.slice(doctype[0].length);
    return meta + documentHtml;
}
