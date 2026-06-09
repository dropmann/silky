'use strict';

import Jed from 'jed';

export function s6e(input: string): string {

    // Temporarily protect allowed HTML tags
    const allowedTags = ["i", "em", "b", "strong", "sub", "sup"] as const;

    for (const tag of allowedTags) {
        const openTag = new RegExp(`<${tag}>`, "gi");
        const closeTag = new RegExp(`</${tag}>`, "gi");

        input = input
            .replace(openTag,  `@@@OPEN_${tag.toUpperCase()}@@@`)
            .replace(closeTag, `@@@CLOSE_${tag.toUpperCase()}@@@`);
    }

    // Escape all other HTML brackets
    input = input
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Restore the allowed tags safely
    for (const tag of allowedTags) {
        input = input
            .replace(new RegExp(`@@@OPEN_${tag.toUpperCase()}@@@`, "g"), `<${tag}>`)
            .replace(new RegExp(`@@@CLOSE_${tag.toUpperCase()}@@@`, "g"), `</${tag}>`);
    }

    return input;
}

export function stringToParagraphs(input: string): string {
    return input
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${p}</p>`)
        .join("");
}


// Represents the header entry ("")
interface JedLocaleHeaders {
    domain?: string;
    lang?: string;
    plural_forms?: string;
    [key: string]: string | undefined;
}

// Represents a single translation entry (array of plural forms)
type JedTranslationEntry = string[];

// The full locale_data domain dictionary
interface JedLocaleDomain {
    "": JedLocaleHeaders;
    [msgid: string]: JedTranslationEntry | JedLocaleHeaders;
}

// All domains (usually only "messages", but Jed supports multiple)
interface JedLocaleData {
    [domain: string]: JedLocaleDomain;
}

// The object passed to Jed constructor
export interface I18nData {
    code: string;
    domain?: string; // default domain
    locale_data: JedLocaleData;
}

export type translateFunction = (key: string, formats?: string | (string | number)[] | { [key: string]: string | number }, options?: { prefix: string, postfix: string }) => string;
export type translateNFunction = (key: string, plural: string, count: number, formats?: { [key: string]: (string|number), n?: (string|number) }) => string;

export const isI18nData = function (obj: unknown): obj is I18nData {
    if (typeof obj !== "object" || obj === null) return false;

    const data = obj as Partial<I18nData>;

    return (
        typeof data.code === "string" &&
        typeof data.domain === "string" &&
        typeof data.locale_data === "object" &&
        data.locale_data !== null &&
        typeof (data.locale_data as any).messages === "object" &&
        (data.locale_data as any).messages !== null &&
        Object.values((data.locale_data as any).messages).every(
            val => Array.isArray(val) && val.every(s => typeof s === "string")
        )
    );
}

export class I18n {
    _availableLanguages: Array<string>;
    language: string;
    jed: Jed;
    localeData: I18nData;

    constructor() {
        this._ = this._.bind(this);
        this._c = this._c.bind(this);
        this._nc = this._nc.bind(this);
        this._n = this._n.bind(this);
        this.findBestMatchingLanguage = this.findBestMatchingLanguage.bind(this);

        this._availableLanguages = ['en'];
        this.language = 'en';
    }

    initialise(code: string, localeData: I18nData) {
        this.language = code;
        this.jed = new Jed(localeData);
        this.localeData = localeData;
    }

    setAvailableLanguages(available: string[]) {
        this._availableLanguages = available;
    }

    availableLanguages() {
        return this._availableLanguages;
    }

    // extracts the value if it includes square bracket [context] as well
    extractContext(key: string): { key: string, context: string | null } {
        const m = key.match(/^(.+) \[([a-z]+)\]$/)
        if (m)
            return { key:m[1], context: m[2] };
        return { key: key, context: undefined };
    }

    _(key: string, formats?: { [key: string]: (string|number) } | (string|number)[] | string, options: { prefix: string, postfix: string } = { prefix: '', postfix: '' }): string {
        let value = null;

        const extracted = this.extractContext(key);

        key = extracted.key;

        if ( ! this.jed)
            value = key;
        else
            value = this.jed.dcnpgettext(undefined, extracted.context, key);

        value = s6e(value);

        if (formats)
            value = this.format(value, formats, options);

        return value;
    }

    _c(context: string, key: string, formats?: { [key: string]: (string|number) } | (string|number)[] | string): string {
        let value = null;
        if (!this.jed)
            value = key;
        else
            value = this.jed.dcnpgettext(undefined, context, key);

        if (formats)
            value = this.format(value, formats);

        value = s6e(value);

        return value;
    }

    _nc(context: string, key: string, plural: string, count: number, formats?: { [key: string]: (string|number), n?: (string|number) }): string {
        let value = null;
        if (!this.jed) {
            if (count != 1)
                value = plural;
            else
                value = key;
        }
        else
            value = this.jed.dcnpgettext(undefined, context, key, plural, count);

        if (count > 1) {
            if (!formats)
                formats = {};
            if (formats.n === undefined)
                formats.n = count.toString();
        }
        if (formats)
            value = this.format(value, formats);

        value = s6e(value);

        return value;
    }

    _n(key: string, plural: string, count: number, formats?: { [key: string]: (string|number), n?: (string|number) }): string {
        let value = null;

        const extracted = this.extractContext(key);
        key = extracted.key;

        if (!this.jed) {
            if (count != 1)
                value = plural;
            else
                value = key;
        }
        else
            value = this.jed.dcnpgettext(undefined, extracted.context, key, plural, count);

        if (count > 1) {
            if (!formats)
                formats = {};
            if (formats.n === undefined)
                formats.n = count.toString();
        }
        if (formats)
            value = this.format(value, formats);

        value = s6e(value);

        return value;
    }

    __(compound: string, options = { prefix: '', postfix: '' }): string {
        const parts = compound.split('\u0004');
        if (parts.length < 2 || parts[1] === '') {
            return this._(parts[0]);
        }
        else {
            const key = parts[0];
            const values = JSON.parse(parts[1]);
            return this._(key, values, options);
        }
    }

    format(fstring: string, values: { [key: string]: (string|number) } | (string|number)[] | string, options: { prefix: string, postfix: string } = { prefix: '', postfix: '' }): string {
        const { prefix, postfix } = options;
        if (typeof values === 'string') {
            return fstring.replace('{}', `${prefix}${values}${postfix}`);
        }
        else {
            let value = fstring;
            for (let name in values)
                value = value.replace(`{${name}}`, `${prefix}${values[name]}${postfix}`);
            return value;
        }
    }

    isRTL(code?: string) {
        if (code === undefined)
            code = this.language;

        let rtlLangs = ['ar', 'arc', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'ur', 'yi'];

        return rtlLangs.find((item) => {
            return code === item || code.startsWith(item + '-');
        });
    }

    systemLanguage() {

        let languages = navigator.languages;

        if (!languages) {
            let lang = navigator.language || navigator.userLanguage || navigator.systemLanguage || navigator.browserLanguage;
            if (lang)
                languages = [lang];
        }

        if (languages) {
            for (let lang of languages) {
                if (this.parseLangCode(lang).isValid)
                    return lang.toLowerCase();
            }
        }

        return 'en';
    }

    createLangCodeParts(code: string) {
        let parts = {
            language: null,
            extlang: null,
            script: null,
            region: null,
            variant: null,
            code: null,
            originalCode: code,
            isValid: true,
            scriptWasInferred: false
        };

        return parts;
    }

    posixScriptModifiers(): { [key: string]: string } {
        return {
            latin: 'latn',
            latn: 'latn',
            cyrillic: 'cyrl',
            cyrl: 'cyrl',
            arabic: 'arab',
            arab: 'arab',
            devanagari: 'deva',
            deva: 'deva',
            gujarati: 'gujr',
            gujr: 'gujr',
            gurmukhi: 'guru',
            guru: 'guru',
            simplified: 'hans',
            hans: 'hans',
            traditional: 'hant',
            hant: 'hant'
        };
    }

    normalizeLocaleCode(code: string) {
        let normalizedCode = code.trim().toLowerCase();
        let posixModifier = null;

        let modifierIndex = normalizedCode.indexOf('@');
        if (modifierIndex !== -1) {
            posixModifier = normalizedCode.substring(modifierIndex + 1);
            normalizedCode = normalizedCode.substring(0, modifierIndex);
        }

        let codesetIndex = normalizedCode.indexOf('.');
        if (codesetIndex !== -1)
            normalizedCode = normalizedCode.substring(0, codesetIndex);

        normalizedCode = normalizedCode.replace(/_/g, '-');

        let script = null;
        let variant = null;
        if (posixModifier) {
            const scriptModifiers = this.posixScriptModifiers();
            if (scriptModifiers[posixModifier])
                script = scriptModifiers[posixModifier];
            else if (/^[a-zA-Z0-9]{4,8}$/.test(posixModifier))
                variant = posixModifier;
        }

        if (script || variant) {
            const sections = normalizedCode.split('-');
            let insertIndex = 1;

            if (sections.length > 1 && /^[a-z]{3}$/.test(sections[1]))
                insertIndex = 2;

            if (script && !(sections.length > insertIndex && /^[a-z]{4}$/.test(sections[insertIndex])))
                sections.splice(insertIndex, 0, script);

            if (variant)
                sections.push(variant);

            normalizedCode = sections.join('-');
        }

        return {
            code: normalizedCode,
            posixModifier: posixModifier
        };
    }

    parseLangCodeFallback(code: string, originalCode: string) {
        let parts = this.createLangCodeParts(originalCode);
        parts.code = code;

        let sections = code.split('-');
        let partIndex = 0;
        for (let i = 0; i < sections.length && partIndex < 5 && parts.isValid; i++) {
            let value = sections[i];
            if (partIndex === 0 && /^[a-zA-Z]{2,3}$/.test(value)) {  // language code of length 2 or 3 characters
                parts.language = value.toLowerCase();
                partIndex = 1;
            }
            else if (partIndex > 0 && partIndex <= 1 && /^[a-zA-Z]{3}$/.test(value)) {  // language extension code of length 3 characters
                parts.extlang = value.toLowerCase();
                partIndex = 2;
            }
            else if (partIndex > 0 && partIndex <= 2 && /^[a-zA-Z]{4}$/.test(value)) {  // language script code of length 4 characters
                parts.script = value.toLowerCase();
                partIndex = 3;
            }
            else if (partIndex > 0 && partIndex <= 3 && /^(\d{3}|[a-zA-Z]{2})$/.test(value)) {  // region code of length 2 characters or 3 digits
                parts.region = value.toLowerCase();
                partIndex = 4;
            }
            else if (partIndex > 0 && partIndex <= 4 && (/^(\d{4}|[a-zA-Z0-9]{5,8})$/.test(value))) {  // variant code of length 5 to 8 characters or 4 digits
                parts.variant = value.toLowerCase();
                partIndex = 5;
            }
            else
                parts.isValid = false;
        }

        this.inferScript(parts);

        return parts;
    }

    inferScript(parts) {
        if (parts.isValid && parts.language === 'zh' && parts.script === null) {
            if (parts.region === 'cn' || parts.region === 'sg' || parts.region === 'my') {
                parts.script = 'hans';
                parts.scriptWasInferred = true;
            }
            else if (parts.region === 'tw' || parts.region === 'hk' || parts.region === 'mo') {
                parts.script = 'hant';
                parts.scriptWasInferred = true;
            }
        }
    }

    // for information about language codes
    // https://www.w3.org/International/articles/language-tags/
    parseLangCode(code: string) {

        if (!code) {
            let parts = this.createLangCodeParts(code);
            parts.isValid = false;
            parts.code = code;
            return parts;
        }

        const normalized = this.normalizeLocaleCode(code);

        try {
            const Locale = (Intl as any).Locale;
            if (Locale) {
                const locale = new Locale(normalized.code);
                const baseName = locale.baseName ? locale.baseName : locale.toString();
                let parts = this.parseLangCodeFallback(baseName.toLowerCase(), code);
                parts.language = locale.language ? locale.language.toLowerCase() : parts.language;
                parts.script = locale.script ? locale.script.toLowerCase() : parts.script;
                parts.region = locale.region ? locale.region.toLowerCase() : parts.region;
                parts.code = locale.toString().toLowerCase();
                this.inferScript(parts);
                return parts;
            }
        }
        catch (e) {
            // Fall through to the small parser below for older or less common tags.
        }

        return this.parseLangCodeFallback(normalized.code, code);
    }

    findBestMatchingLanguage(code: string, codes: string[], options?: { excludeDev?: boolean }) {

        options = options || {};

        if (options.excludeDev) {
            let inDevSeparatorIndex = codes.indexOf('---');
            if (inDevSeparatorIndex !== -1)
                codes = codes.slice(0, inDevSeparatorIndex);
        }
        else {
            codes = codes.filter(code => code !== '---');
        }

        if (codes.includes(code))
            return code;

        let desiredLanguage = this.parseLangCode(code);
        if (desiredLanguage.isValid === false)
            return null;

        let languages = codes.map(code => this.parseLangCode(code));

        // compares the tags of the two languages. Every matching tag increases the ranking.
        // Script mismatches disqualify the compare, because they usually mean different written forms.
        // Region mismatches are allowed, so region-based and script-based language packs can match.
        let compare = (desired, target) => {
            if (target.isValid === false)
                return 0;

            let rank = 0;
            if (desired.language === target.language)
                rank += 5;
            else
                return 0;

            if (desired.extlang === target.extlang)
                rank += desired.extlang !== null ? 4 : 0;
            else if (desired.extlang !== null && target.extlang !== null)
                return 0;

            if (desired.script === target.script)
                rank += desired.script !== null ? 3 : 0;
            else if (desired.script !== null && target.script !== null)
                return 0;

            if (desired.region === target.region)
                rank += desired.region !== null ? 2 : 0;

            if (desired.variant === target.variant)
                rank += desired.variant !== null ? 1 : 0;

            return rank;
        };

        let bestLanguage = null;
        let currentRank = 0;
        for (let language of languages) {
            let rank = compare(desiredLanguage, language);

            // If two languages have the same best rank then the shortest code is used.
            if (rank > 0 && (rank > currentRank || (rank === currentRank && (bestLanguage === null || bestLanguage.code.length > language.code.length)))) {
                currentRank = rank;
                bestLanguage = language;
            }
        }

        return bestLanguage ? bestLanguage.originalCode : null;
    }
}



class I18ns {
    _i18ns: Map<string, I18n> = new Map<string, I18n>();

    get(name: string) {
        let i18n = this._i18ns.get(name);
        if (i18n === undefined) {
            i18n = new I18n();
            this._i18ns.set(name, i18n);
        }
        return i18n;
    }

    create(name: string, code: string, data: I18nData) {
        if (this._i18ns.has(name))
            throw 'Translations already exist.';

        let i18n = new I18n();
        i18n.initialise(code, data);
        this._i18ns.set(name, i18n);
        return i18n;
    }
}

const _i18ns: I18ns = new I18ns();

export default _i18ns;
