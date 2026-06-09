import { describe, expect, it } from 'vitest';

import { I18n } from '../i18n';

describe('I18n language matching', () => {
    it('matches Chinese region codes to script-based language packs', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-CN', ['en', 'zh-Hans'])).toBe('zh-Hans');
        expect(i18n.findBestMatchingLanguage('zh-SG', ['en', 'zh-Hans'])).toBe('zh-Hans');
        expect(i18n.findBestMatchingLanguage('zh-TW', ['en', 'zh-Hant'])).toBe('zh-Hant');
        expect(i18n.findBestMatchingLanguage('zh-HK', ['en', 'zh-Hant'])).toBe('zh-Hant');
    });

    it('matches Chinese script codes to region-based language packs', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-Hans', ['en', 'zh-CN'])).toBe('zh-CN');
        expect(i18n.findBestMatchingLanguage('zh-Hant', ['en', 'zh-TW'])).toBe('zh-TW');
    });

    it('does not match Chinese language packs with incompatible scripts', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-Hans', ['zh-Hant'])).toBeNull();
        expect(i18n.findBestMatchingLanguage('zh-Hant', ['zh-CN'])).toBeNull();
    });

    it('prefers a broader script match over a different regional variant', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-HK', ['zh-Hant-TW', 'zh-Hant'])).toBe('zh-Hant');
    });

    it('normalizes underscores for matching but returns the original language pack code', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-CN', ['en', 'zh_Hans'])).toBe('zh_Hans');
        expect(i18n.findBestMatchingLanguage('zh_Hant', ['en', 'zh_TW'])).toBe('zh_TW');
        expect(i18n.findBestMatchingLanguage('pt-BR', ['en', 'pt_BR'])).toBe('pt_BR');
    });

    it('normalizes POSIX locale codes for matching but returns the original language pack code', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('pt-BR', ['en', 'pt_BR.UTF-8'])).toBe('pt_BR.UTF-8');
        expect(i18n.findBestMatchingLanguage('pt_BR.UTF-8', ['en', 'pt-BR'])).toBe('pt-BR');
    });

    it('matches POSIX script modifiers to BCP 47 script subtags', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('sr-Cyrl-RS', ['en', 'sr_RS'])).toBe('sr_RS');
        expect(i18n.findBestMatchingLanguage('sr-Latn-RS', ['en', 'sr_RS@latin'])).toBe('sr_RS@latin');
        expect(i18n.findBestMatchingLanguage('sr_RS@latin', ['en', 'sr-Latn-RS'])).toBe('sr-Latn-RS');
    });

    it('treats non-script POSIX modifiers as variants', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('ca-ES-valencia', ['en', 'ca_ES@valencia'])).toBe('ca_ES@valencia');
    });

    it('ignores BCP 47 extensions when matching', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('en-US-u-ca-gregory', ['en', 'en_US'])).toBe('en_US');
    });

    it('does not return unrelated zero-rank language matches', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('fr', ['en'])).toBeNull();
    });
});
