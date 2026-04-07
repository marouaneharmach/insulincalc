import { useState } from 'react';

export default function DataExport({ isDark }) {
  const [importResult, setImportResult] = useState(null);

  const PREFIX = 'insulincalc_v4_';

  const exportData = () => {
    const data = { version: '4.3.0', exportDate: new Date().toISOString(), profile: {}, journal: [] };

    // Export all localStorage keys with our prefix
    const profileKeys = ['patientName', 'age', 'sex', 'height', 'weight', 'ratio', 'isf',
      'targetGMin', 'targetGMax', 'digestion', 'maxDose', 'theme', 'locale', 'notifEnabled',
      'favorites', 'custom_foods', 'timeProfiles'];

    profileKeys.forEach(key => {
      const val = localStorage.getItem(PREFIX + key);
      if (val !== null) {
        try { data.profile[key] = JSON.parse(val); }
        catch { data.profile[key] = val; }
      }
    });

    // Export journal
    try {
      const j = localStorage.getItem(PREFIX + 'journal');
      if (j) data.journal = JSON.parse(j);
    } catch { /* no-op */ }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insulincalc_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);

        // Validate structure
        if (!data.version || !data.profile) {
          setImportResult({ ok: false, msg: 'Format de fichier invalide' });
          return;
        }

        // Import profile
        Object.entries(data.profile).forEach(([key, val]) => {
          localStorage.setItem(PREFIX + key, typeof val === 'string' ? val : JSON.stringify(val));
        });

        // Import journal (merge with existing, deduplicate by id)
        if (data.journal?.length) {
          const existing = JSON.parse(localStorage.getItem(PREFIX + 'journal') || '[]');
          const existingIds = new Set(existing.map(e => e.id));
          const newEntries = data.journal.filter(e => !existingIds.has(e.id));
          const merged = [...newEntries, ...existing].sort((a, b) => b.id - a.id).slice(0, 200);
          localStorage.setItem(PREFIX + 'journal', JSON.stringify(merged));
        }

        setImportResult({ ok: true, msg: `Import réussi : ${Object.keys(data.profile).length} paramètres, ${data.journal?.length || 0} entrées` });
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        setImportResult({ ok: false, msg: 'Fichier corrompu : ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  return (
    <div className={cardClass}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        💾 Sauvegarde & Restauration
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={exportData}
          className={`p-3 rounded-xl border text-center transition hover:scale-105 active:scale-95 ${
            isDark ? 'border-teal-700 bg-teal-900/20 text-teal-400' : 'border-teal-200 bg-teal-50 text-teal-700'
          }`}>
          <span className="text-lg block">📤</span>
          <span className="text-xs font-medium">Exporter</span>
        </button>
        <label className={`p-3 rounded-xl border text-center transition cursor-pointer hover:scale-105 active:scale-95 ${
          isDark ? 'border-blue-700 bg-blue-900/20 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          <span className="text-lg block">📥</span>
          <span className="text-xs font-medium">Importer</span>
          <input type="file" accept=".json" onChange={importData} className="hidden" />
        </label>
      </div>
      {importResult && (
        <p className={`text-xs mt-2 p-2 rounded-xl ${
          importResult.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}>
          {importResult.ok ? '✅' : '❌'} {importResult.msg}
        </p>
      )}
    </div>
  );
}
