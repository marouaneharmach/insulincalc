import { Component } from 'react';

/**
 * ErrorBoundary — écran de secours affiché lorsqu'un composant lève une
 * exception. Il ne dispose pas de `t` (il enveloppe l'application entière) :
 * la langue est lue directement dans localStorage et les textes proviennent
 * d'un petit dictionnaire local FR / AR.
 */
const LOCALE_STORAGE_KEY = 'insulincalc_v4_locale';

const MESSAGES = {
  fr: {
    title: 'Erreur inattendue',
    desc: "L'application a rencontré un problème. Vos données sont en sécurité sur cet appareil.",
    retry: 'Réessayer',
    restart: "Redémarrer l'application",
    restartQuestion: "Redémarrer l'application ? Vos données seront conservées.",
    confirm: 'Confirmer',
    cancel: 'Annuler',
    details: 'Détails techniques',
  },
  ar: {
    title: 'خطأ غير متوقع',
    desc: 'واجه التطبيق مشكلة. بياناتك آمنة على هذا الجهاز.',
    retry: 'إعادة المحاولة',
    restart: 'إعادة تشغيل التطبيق',
    restartQuestion: 'إعادة تشغيل التطبيق؟ سيتم الاحتفاظ ببياناتك.',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    details: 'تفاصيل تقنية',
  },
};

function readStoredLocale() {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : 'fr';
    return value === 'ar' ? 'ar' : 'fr';
  } catch {
    return 'fr';
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, confirmRestart: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[InsulinCalc] Crash:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, confirmRestart: false });
  };

  handleAskRestart = () => {
    this.setState({ confirmRestart: true });
  };

  handleCancelRestart = () => {
    this.setState({ confirmRestart: false });
  };

  handleFullReset = () => {
    this.setState({ hasError: false, error: null, confirmRestart: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const locale = readStoredLocale();
      const m = MESSAGES[locale] || MESSAGES.fr;
      const primaryBtn = 'w-full py-3 rounded-2xl bg-teal-600 text-white font-medium text-sm hover:bg-teal-700 transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2';
      const secondaryBtn = 'w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2';

      return (
        <div
          role="alert"
          lang={locale}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="min-h-screen flex items-center justify-center bg-[#F7FAFB] p-6"
        >
          <div className="max-w-sm w-full text-center space-y-4">
            <p className="text-5xl" aria-hidden="true">⚠️</p>
            <h1 className="text-xl font-bold text-slate-800">{m.title}</h1>
            <p className="text-sm text-slate-600">{m.desc}</p>

            {!this.state.confirmRestart ? (
              <div className="space-y-2">
                <button type="button" onClick={this.handleReset} className={primaryBtn}>
                  {m.retry}
                </button>
                <button type="button" onClick={this.handleAskRestart} className={secondaryBtn}>
                  {m.restart}
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-sm text-slate-700">{m.restartQuestion}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={this.handleCancelRestart} className={secondaryBtn}>
                    {m.cancel}
                  </button>
                  <button type="button" onClick={this.handleFullReset} className={primaryBtn}>
                    {m.confirm}
                  </button>
                </div>
              </div>
            )}

            {this.state.error && (
              <details className="text-left mt-4">
                <summary className="text-xs text-slate-600 cursor-pointer">{m.details}</summary>
                <pre className="mt-2 text-xs text-red-700 bg-red-50 p-3 rounded-xl overflow-auto max-h-32" dir="ltr">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
