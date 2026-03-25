export default function OverdoseDialog({ dose, maxDose, onConfirm, onCancel, isDark }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div className={`max-w-sm w-full rounded-2xl p-5 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
        <div className="text-center">
          <p className="text-5xl mb-3">🚨</p>
          <h2 className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            Dose élevée détectée
          </h2>
          <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            La dose calculée de <strong className="text-red-500">{dose} U</strong> dépasse votre seuil de sécurité de <strong>{maxDose} U</strong>.
          </p>
        </div>

        <div className={`p-3 rounded-xl ${isDark ? 'bg-red-900/20 border border-red-800/40' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>
            ⚕️ Vérifiez vos paramètres (ratio, ISF) et les aliments sélectionnés. En cas de doute, consultez votre endocrinologue.
          </p>
        </div>

        <div className="space-y-2">
          <button onClick={onConfirm}
            className="w-full py-3 rounded-2xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition">
            ⚠️ Confirmer et enregistrer {dose} U
          </button>
          <button onClick={onCancel}
            className={`w-full py-3 rounded-2xl font-medium text-sm transition ${
              isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            Annuler et vérifier
          </button>
        </div>
      </div>
    </div>
  );
}
