import { useState } from 'react';

const getGlycemiaColor = (value, targetMin, targetMax) => {
  const v = parseFloat(value);
  if (v < 0.8) return { bg: '#FFE5E5', text: '#CC0000', label: 'Hypo' };
  if (v < targetMin) return { bg: '#FFF4CC', text: '#CC6600', label: 'Bas' };
  if (v <= targetMax) return { bg: '#E5F5E5', text: '#00AA00', label: 'Cible' };
  if (v < 2.0) return { bg: '#FFE5B5', text: '#FF8C00', label: 'Élevé' };
  return { bg: '#FFB3B3', text: '#CC0000', label: 'Hyper' };
};

export default function PdfExport({ journal, patientName, ratio, isf, targetGMin, targetGMax, t, colors, isDark }) {
  const [showPrintView, setShowPrintView] = useState(false);

  const computeStats = () => {
    // Accessor functions for backwards compatibility (v5 field names with v4 fallbacks)
    const getGlycPre = (e) => e.glycPre ?? e.preMealGlycemia;
    const getGlycPost = (e) => e.glycPost ?? e.postMealGlycemia;
    const getTotalCarbs = (e) => e.totalGlucides ?? e.totalCarbs;
    const getDoseSuggested = (e) => e.doseSuggeree ?? e.doseCalculated ?? e.doseSuggested;
    const getDoseActual = (e) => e.doseReelle ?? e.doseInjected ?? e.doseActual;

    if (!journal || journal.length === 0) {
      return {
        entries: [],
        avgGlycemia: 0,
        timeInRange: 0,
        estimatedHbA1c: 0,
        totalEntries: 0,
        dateRange: 'Aucune donnée',
        getGlycPre, getGlycPost, getTotalCarbs, getDoseSuggested, getDoseActual,
      };
    }

    // Get last 30 days of data
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentEntries = journal.filter(e => e.id >= thirtyDaysAgo);

    const validGlycPreEntries = recentEntries.filter(e => getGlycPre(e) && !isNaN(parseFloat(getGlycPre(e))));

    if (validGlycPreEntries.length === 0) {
      return {
        entries: recentEntries,
        avgGlycemia: 0,
        timeInRange: 0,
        estimatedHbA1c: 0,
        totalEntries: recentEntries.length,
        dateRange: 'Aucune donnée',
        getGlycPre, getGlycPost, getTotalCarbs, getDoseSuggested, getDoseActual,
      };
    }

    // Average glycemia
    const glycValues = validGlycPreEntries.map(e => parseFloat(getGlycPre(e)));
    const avgGlycemia = (glycValues.reduce((s, v) => s + v, 0) / glycValues.length).toFixed(2);

    // Time in range %
    const inRangeCount = glycValues.filter(v => v >= targetGMin && v <= targetGMax).length;
    const timeInRange = Math.round((inRangeCount / glycValues.length) * 100);

    // Estimated HbA1c using eAG formula: eAG (mg/dL) = 28.7 × A1C − 46.7 → A1C = (eAG + 46.7) / 28.7
    // Convert g/L to mg/dL: g/L * 100
    const avgGlycMgDl = parseFloat(avgGlycemia) * 100;
    const estimatedHbA1c = ((avgGlycMgDl + 46.7) / 28.7).toFixed(1);

    // Date range
    const firstDate = new Date(recentEntries[recentEntries.length - 1]?.date || Date.now());
    const lastDate = new Date(recentEntries[0]?.date || Date.now());
    const dateRange = `${firstDate.toLocaleDateString('fr-FR')} à ${lastDate.toLocaleDateString('fr-FR')}`;

    return {
      entries: recentEntries,
      avgGlycemia: parseFloat(avgGlycemia),
      timeInRange,
      estimatedHbA1c: parseFloat(estimatedHbA1c),
      totalEntries: recentEntries.length,
      dateRange,
      getGlycPre, getGlycPost, getTotalCarbs, getDoseSuggested, getDoseActual,
    };
  };

  const stats = computeStats();
  const formattedDate = new Date().toLocaleDateString('fr-FR');

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Export button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setShowPrintView(true)}
          className={`w-full py-3 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 border transition ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'
          }`}
        >
          📄 {t('exporterPdf') || 'Exporter PDF'}
        </button>
      </div>

      {/* Full-screen print view overlay */}
      {showPrintView && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#fff',
            color: '#000',
            zIndex: 9999,
            overflowY: 'auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Print-friendly report container */}
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              padding: '40px 20px',
              backgroundColor: '#fff',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
              <h1 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                InsulinCalc — Rapport de suivi glycémique
              </h1>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                Généré le {formattedDate}
              </p>
            </div>

            {/* Patient Info Section */}
            <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
                Informations du patient
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <tbody>
                  {patientName && (
                    <tr>
                      <td style={{ paddingRight: '20px', fontWeight: 'bold', color: '#000' }}>Nom:</td>
                      <td style={{ color: '#333' }}>{patientName}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ paddingRight: '20px', fontWeight: 'bold', color: '#000' }}>Période:</td>
                    <td style={{ color: '#333' }}>{stats.dateRange}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: '20px', fontWeight: 'bold', color: '#000' }}>Ratio (ICR):</td>
                    <td style={{ color: '#333' }}>1 U pour {ratio}g de glucides</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: '20px', fontWeight: 'bold', color: '#000' }}>ISF:</td>
                    <td style={{ color: '#333' }}>{isf} mg/dL par unité</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: '20px', fontWeight: 'bold', color: '#000' }}>Cible:</td>
                    <td style={{ color: '#333' }}>
                      {targetGMin.toFixed(2)} — {targetGMax.toFixed(2)} g/L
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Stats Summary */}
            {stats.totalEntries > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
                  Récapitulatif des statistiques
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                  <div style={{ padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                      Moyenne glycémie
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                      {stats.avgGlycemia.toFixed(2)} g/L
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                      Temps en cible
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                      {stats.timeInRange}%
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                      HbA1c estimée
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                      {stats.estimatedHbA1c}%
                    </div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                      Nombre d'entrées
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                      {stats.totalEntries}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Journal Entries Table */}
            {stats.totalEntries > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
                  Journal des entrées (30 derniers jours)
                </h2>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Date/Heure
                      </th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Glyc. pré
                      </th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Glucides (g)
                      </th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Dose calc.
                      </th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Dose prise
                      </th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Glyc. post
                      </th>
                      <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Tendance
                      </th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Aliments
                      </th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000' }}>
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.entries.map((entry) => {
                      const glycPre = stats.getGlycPre(entry);
                      const glycPost = stats.getGlycPost(entry);
                      const totalCarbs = stats.getTotalCarbs(entry);
                      const doseSuggested = stats.getDoseSuggested(entry);
                      const doseActual = stats.getDoseActual(entry);
                      const preColor = getGlycemiaColor(glycPre, targetGMin, targetGMax);
                      const postColor = getGlycemiaColor(glycPost, targetGMin, targetGMax);
                      const entryDate = new Date(entry.date);
                      const dateStr = entryDate.toLocaleDateString('fr-FR');
                      const timeStr = entryDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                      // Build tendance display with optional activity/bolus info
                      const tendanceParts = [];
                      if (entry.tendance) tendanceParts.push(entry.tendance);
                      if (entry.activitePhysique && entry.activitePhysique !== 'aucune') tendanceParts.push(`Act: ${entry.activitePhysique}`);
                      if (entry.bolusType && entry.bolusType !== 'unique') tendanceParts.push(`Bolus: ${entry.bolusType}`);
                      const tendanceStr = tendanceParts.join(' / ') || '—';

                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px', color: '#000' }}>
                            {dateStr}
                            <br />
                            {timeStr}
                          </td>
                          <td
                            style={{
                              padding: '8px',
                              textAlign: 'center',
                              backgroundColor: preColor.bg,
                              color: preColor.text,
                              fontWeight: 'bold',
                            }}
                          >
                            {glycPre} g/L
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#000' }}>
                            {totalCarbs}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#000' }}>
                            {doseSuggested ? parseFloat(doseSuggested).toFixed(1) : '—'} U
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#000' }}>
                            {doseActual ? parseFloat(doseActual).toFixed(1) : '—'} U
                          </td>
                          <td
                            style={{
                              padding: '8px',
                              textAlign: 'center',
                              backgroundColor: glycPost ? postColor.bg : '#fff',
                              color: glycPost ? postColor.text : '#999',
                              fontWeight: glycPost ? 'bold' : 'normal',
                            }}
                          >
                            {glycPost ? `${glycPost} g/L` : '—'}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#000', fontSize: '11px' }}>
                            {tendanceStr}
                          </td>
                          <td style={{ padding: '8px', color: '#000', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.aliments || '—'}
                          </td>
                          <td style={{ padding: '8px', color: '#666', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                            {entry.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {stats.totalEntries === 0 && (
              <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px', textAlign: 'center', color: '#666' }}>
                Aucune donnée disponible pour la période.
              </div>
            )}

            {/* Footer disclaimer */}
            <div
              style={{
                marginTop: '40px',
                paddingTop: '20px',
                borderTop: '1px solid #ddd',
                fontSize: '11px',
                color: '#666',
                lineHeight: '1.6',
              }}
            >
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>⚕️ Avertissement médical:</strong>
              </p>
              <p style={{ margin: '0' }}>
                Les doses et mesures affichées dans ce rapport sont strictement à titre indicatif et ne constituent en aucun cas un avis médical. L'utilisateur est seul responsable de l'utilisation de ces informations. En cas de doute, contactez immédiatement votre médecin ou votre équipe soignante. Ne modifiez jamais votre traitement sans l'accord de votre endocrinologue.
              </p>
            </div>

            {/* Control buttons (hidden in print) */}
            <div
              style={{
                marginTop: '30px',
                display: 'flex',
                gap: '10px',
                justifyContent: 'center',
                printHidden: true,
              }}
              className="no-print"
            >
              <button
                onClick={handlePrint}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#3B82F6',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                🖨 Imprimer / Exporter PDF
              </button>
              <button
                onClick={() => setShowPrintView(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  color: '#000',
                  cursor: 'pointer',
                }}
              >
                ✕ Fermer
              </button>
            </div>
          </div>

          {/* Print-only CSS */}
          <style>{`
            @media print {
              body {
                margin: 0;
                padding: 0;
                background: #fff;
                color: #000;
              }
              div[class*="no-print"],
              .no-print {
                display: none !important;
              }
              div {
                color: #000 !important;
              }
              table {
                page-break-inside: avoid;
              }
              tr {
                page-break-inside: avoid;
              }
              h2 {
                page-break-after: avoid;
              }
              button {
                display: none !important;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
