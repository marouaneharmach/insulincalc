import { useLocalStorage } from '../hooks/useLocalStorage.js';
import fr from './fr.js';
import ar from './ar.js';

const locales = { fr, ar };

export function useI18n() {
  const [locale, setLocale] = useLocalStorage('locale', 'fr');

  const strings = locales[locale] || fr;

  function t(key, params) {
    let str = strings[key] || fr[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, v);
      });
    }
    return str;
  }

  const isRTL = locale === 'ar';

  return { t, locale, setLocale, isRTL };
}
