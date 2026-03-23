import { useLocalStorage } from '../hooks/useLocalStorage';
import fr from './fr';
import ar from './ar';

const LOCALES = { fr, ar };

export function useI18n() {
  const [locale, setLocale] = useLocalStorage('locale', 'fr');
  const messages = LOCALES[locale] || fr;

  const t = (key, params) => {
    let msg = messages[key] || fr[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        msg = msg.replace(`{${k}}`, v);
      });
    }
    return msg;
  };

  const isRTL = locale === 'ar';
  return { t, locale, setLocale, isRTL };
}
