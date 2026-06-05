import { describe, expect, it } from 'vitest';

import { I18n } from '../i18n';

describe('I18n language matching', () => {
    it('matches Chinese region codes to script-based language packs', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-CN', ['en', 'zh-Hans'])).toBe('zh-hans');
        expect(i18n.findBestMatchingLanguage('zh-SG', ['en', 'zh-Hans'])).toBe('zh-hans');
        expect(i18n.findBestMatchingLanguage('zh-TW', ['en', 'zh-Hant'])).toBe('zh-hant');
        expect(i18n.findBestMatchingLanguage('zh-HK', ['en', 'zh-Hant'])).toBe('zh-hant');
    });

    it('matches Chinese script codes to region-based language packs', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-Hans', ['en', 'zh-CN'])).toBe('zh-cn');
        expect(i18n.findBestMatchingLanguage('zh-Hant', ['en', 'zh-TW'])).toBe('zh-tw');
    });

    it('does not match Chinese language packs with incompatible scripts', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-Hans', ['zh-Hant'])).toBeNull();
        expect(i18n.findBestMatchingLanguage('zh-Hant', ['zh-CN'])).toBeNull();
    });

    it('prefers a broader script match over a different regional variant', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('zh-HK', ['zh-Hant-TW', 'zh-Hant'])).toBe('zh-hant');
    });

    it('does not return unrelated zero-rank language matches', () => {
        const i18n = new I18n();

        expect(i18n.findBestMatchingLanguage('fr', ['en'])).toBeNull();
    });
});
