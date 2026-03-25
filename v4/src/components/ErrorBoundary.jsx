import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[InsulinCalc] Crash:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleFullReset = () => {
    if (window.confirm('Réinitialiser l\'application ? Vos données seront conservées.')) {
      this.setState({ hasError: false, error: null });
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7FAFB] p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <p className="text-5xl">⚠️</p>
            <h1 className="text-xl font-bold text-slate-800">Erreur inattendue</h1>
            <p className="text-sm text-slate-500">
              L'application a rencontré un problème. Vos données sont en sécurité dans le stockage local.
            </p>
            <div className="space-y-2">
              <button onClick={this.handleReset}
                className="w-full py-3 rounded-2xl bg-teal-500 text-white font-medium text-sm hover:bg-teal-600 transition">
                Réessayer
              </button>
              <button onClick={this.handleFullReset}
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition">
                Redémarrer l'application
              </button>
            </div>
            {this.state.error && (
              <details className="text-left mt-4">
                <summary className="text-xs text-slate-400 cursor-pointer">Détails techniques</summary>
                <pre className="mt-2 text-[10px] text-red-400 bg-red-50 p-3 rounded-xl overflow-auto max-h-32">
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
