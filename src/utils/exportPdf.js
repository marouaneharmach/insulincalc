// ─── PDF EXPORT via canvas → blob ───────────────────────────────────────────
// Pure JS approach using canvas to generate a simple PDF-like document.
// Falls back to a printable HTML window if canvas approach is insufficient.

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateJournalPdf(entries, period, stats, patientName) {
  // Build an HTML document that can be printed to PDF
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const name = escapeHtml(patientName || 'Patient');

  const statsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin:16px 0;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:1px;">Moyenne</div>
        <div style="font-size:22px;font-weight:700;color:#15803d;">${stats.moyenne ?? '—'} g/L</div>
      </div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#0c4a6e;text-transform:uppercase;letter-spacing:1px;">Time in Range</div>
        <div style="font-size:22px;font-weight:700;color:#0369a1;">${stats.tir ?? '—'}%</div>
      </div>
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#854d0e;text-transform:uppercase;letter-spacing:1px;">HbA1c estimée</div>
        <div style="font-size:22px;font-weight:700;color:#a16207;">${stats.hba1c ?? '—'}%</div>
      </div>
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#6b21a8;text-transform:uppercase;letter-spacing:1px;">Nb mesures</div>
        <div style="font-size:22px;font-weight:700;color:#7c3aed;">${stats.count ?? entries.length}</div>
      </div>
    </div>
  `;

  const rows = entries.map(e => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(e.date) || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(e.repas) || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;">${e.glycPre ?? '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;">${e.glycPost ?? '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;font-weight:600;color:#0CBAA6;">${e.dose ?? '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(e.aliments) || '—'}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>InsulinCalc — Journal Glycémique</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #1a202c; padding: 32px; max-width: 900px; margin: 0 auto; }
        @media print {
          body { padding: 16px; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0CBAA6;">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#0CBAA6;margin-bottom:4px;">InsulinCalc — Journal Glycémique</h1>
          <div style="font-size:13px;color:#718096;">Période : ${period || 'Toutes les entrées'}</div>
          <div style="font-size:13px;color:#718096;">Patient : ${name}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#718096;">Généré le ${dateStr}</div>
          <button class="no-print" onclick="window.print()" style="margin-top:8px;padding:8px 16px;background:#0CBAA6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Imprimer / PDF</button>
        </div>
      </div>

      ${statsHtml}

      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Date</th>
            <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Repas</th>
            <th style="padding:10px;text-align:center;font-size:11px;letter-spacing:1px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Glyc. pré</th>
            <th style="padding:10px;text-align:center;font-size:11px;letter-spacing:1px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Glyc. post</th>
            <th style="padding:10px;text-align:center;font-size:11px;letter-spacing:1px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Dose (U)</th>
            <th style="padding:10px;text-align:left;font-size:11px;letter-spacing:1px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Aliments</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : '<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">Aucune entrée dans le journal</td></tr>'}
        </tbody>
      </table>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
        Généré par InsulinCalc — À partager avec votre endocrinologue
      </div>
    </body>
    </html>
  `;

  // Open in a new window for print
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
    // Auto-trigger print after a short delay
    setTimeout(() => win.print(), 500);
  }
}

// ─── ENRICHED MEDICAL REPORT (5 pages) ─────────────────────────────────────
// Generates a comprehensive medical report for physician review.

export function generateMedicalReport(entries, patterns, patientName) {
  if (!entries || entries.length < 14) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const name = escapeHtml(patientName || 'Patient');

  // ─── Compute all statistics ───────────────────────────────────────────────
  const allValues = [];
  entries.forEach(e => {
    if (e.preMealGlycemia != null && !isNaN(e.preMealGlycemia)) allValues.push(e.preMealGlycemia);
    if (e.postMealGlycemia != null && !isNaN(e.postMealGlycemia)) allValues.push(e.postMealGlycemia);
  });

  const count = allValues.length;
  const mean = count > 0 ? allValues.reduce((s, v) => s + v, 0) / count : 0;
  const stdDev = count > 1
    ? Math.sqrt(allValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (count - 1))
    : 0;
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
  const inRange = allValues.filter(v => v >= 1.0 && v <= 1.8).length;
  const tir = count > 0 ? Math.round((inRange / count) * 100) : 0;
  const hypos = allValues.filter(v => v < 0.70).length;
  const hypers = allValues.filter(v => v > 2.50).length;

  // HbA1c estimation
  const avgMgDL = mean * 100;
  const hba1c = count >= 30 ? Math.round(((avgMgDL + 46.7) / 28.7) * 10) / 10 : null;

  // Period
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstDate = new Date(sorted[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const lastDate = new Date(sorted[sorted.length - 1].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const periodStr = `${firstDate} — ${lastDate}`;
  const nbDays = Math.max(1, Math.ceil((new Date(sorted[sorted.length - 1].date) - new Date(sorted[0].date)) / 86400000));

  // ─── Page 1: Résumé Exécutif ──────────────────────────────────────────────
  const tirColor = tir >= 70 ? '#15803d' : tir >= 50 ? '#a16207' : '#dc2626';
  const tirBg = tir >= 70 ? '#f0fdf4' : tir >= 50 ? '#fefce8' : '#fef2f2';
  const tirBorder = tir >= 70 ? '#bbf7d0' : tir >= 50 ? '#fde68a' : '#fecaca';
  const cvColor = cv <= 36 ? '#15803d' : '#dc2626';

  const page1 = `
    <div class="page">
      <h2 style="color:#0CBAA6;margin-bottom:20px;font-size:18px;">1. Résumé Exécutif</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:10px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;width:40%;">Patient</td>
          <td style="padding:10px;font-size:14px;font-weight:600;border-bottom:1px solid #e2e8f0;">${name}</td>
        </tr>
        <tr>
          <td style="padding:10px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Période analysée</td>
          <td style="padding:10px;font-size:14px;border-bottom:1px solid #e2e8f0;">${periodStr} (${nbDays} jours)</td>
        </tr>
        <tr>
          <td style="padding:10px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Nombre de mesures</td>
          <td style="padding:10px;font-size:14px;border-bottom:1px solid #e2e8f0;">${count}</td>
        </tr>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:${tirBg};border:1px solid ${tirBorder};border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:${tirColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">TIR (1.0–1.8 g/L)</div>
          <div style="font-size:32px;font-weight:700;color:${tirColor};">${tir}%</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Objectif &gt; 70%</div>
        </div>
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#6b21a8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">HbA1c estimée</div>
          <div style="font-size:32px;font-weight:700;color:#7c3aed;">${hba1c != null ? hba1c + '%' : 'N/A'}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">${hba1c != null ? (hba1c <= 7.0 ? 'Dans la cible' : 'Au-dessus de la cible') : 'Min. 30 mesures requises'}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">CV%</div>
          <div style="font-size:24px;font-weight:700;color:${cvColor};">${cv.toFixed(1)}%</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">Cible &le; 36%</div>
        </div>
        <div style="background:${hypos > 0 ? '#fef2f2' : '#f0fdf4'};border:1px solid ${hypos > 0 ? '#fecaca' : '#bbf7d0'};border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Hypos (&lt; 0.70)</div>
          <div style="font-size:24px;font-weight:700;color:${hypos > 0 ? '#dc2626' : '#15803d'};">${hypos}</div>
        </div>
        <div style="background:${hypers > 0 ? '#fef2f2' : '#f0fdf4'};border:1px solid ${hypers > 0 ? '#fecaca' : '#bbf7d0'};border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Hypers (&gt; 2.50)</div>
          <div style="font-size:24px;font-weight:700;color:${hypers > 0 ? '#dc2626' : '#15803d'};">${hypers}</div>
        </div>
      </div>
    </div>
  `;

  // ─── Page 2: Profil Glycémique par créneau ────────────────────────────────
  const slots = {
    'Matin (6h-10h)': { values: [], label: 'matin' },
    'Midi (10h-14h)': { values: [], label: 'midi' },
    'Goûter (14h-18h)': { values: [], label: 'gouter' },
    'Soir (18h-22h)': { values: [], label: 'soir' },
    'Nuit (22h-6h)': { values: [], label: 'nuit' },
  };

  entries.forEach(e => {
    const hour = new Date(e.date).getHours();
    let slotKey;
    if (hour >= 6 && hour < 10) slotKey = 'Matin (6h-10h)';
    else if (hour >= 10 && hour < 14) slotKey = 'Midi (10h-14h)';
    else if (hour >= 14 && hour < 18) slotKey = 'Goûter (14h-18h)';
    else if (hour >= 18 && hour < 22) slotKey = 'Soir (18h-22h)';
    else slotKey = 'Nuit (22h-6h)';

    if (e.preMealGlycemia != null) slots[slotKey].values.push(e.preMealGlycemia);
    if (e.postMealGlycemia != null) slots[slotKey].values.push(e.postMealGlycemia);
  });

  const slotRows = Object.entries(slots).map(([slotName, data]) => {
    const vals = data.values;
    if (vals.length === 0) {
      return `<tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;">${slotName}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">—</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">—</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">—</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">0</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;">—</td>
      </tr>`;
    }
    const avg = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
    const min = Math.min(...vals).toFixed(2);
    const max = Math.max(...vals).toFixed(2);
    const avgNum = parseFloat(avg);
    const avgColor = avgNum >= 1.0 && avgNum <= 1.8 ? '#15803d' : avgNum < 1.0 ? '#dc2626' : '#a16207';

    // Simple bar representation
    const barWidth = Math.min(100, Math.round((avgNum / 3.0) * 100));
    const barColor = avgNum >= 1.0 && avgNum <= 1.8 ? '#22c55e' : avgNum < 1.0 ? '#ef4444' : '#f59e0b';
    const bar = `<div style="background:#f1f5f9;border-radius:4px;height:14px;position:relative;">
      <div style="background:${barColor};height:14px;border-radius:4px;width:${barWidth}%;"></div>
    </div>`;

    return `<tr>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:500;">${slotName}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${avgColor};">${avg}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:12px;">${min}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:12px;">${max}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:12px;">${vals.length}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;min-width:100px;">${bar}</td>
    </tr>`;
  }).join('');

  const page2 = `
    <div class="page">
      <h2 style="color:#0CBAA6;margin-bottom:20px;font-size:18px;">2. Profil Glycémique</h2>
      <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Distribution des valeurs glycémiques par créneau horaire.</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Créneau</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Moy.</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Min</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Max</th>
            <th style="padding:10px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">N</th>
            <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Distribution</th>
          </tr>
        </thead>
        <tbody>
          ${slotRows}
        </tbody>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:12px;color:#0c4a6e;">
        <strong>Légende :</strong> Vert = dans la cible (1.0–1.8), Jaune = au-dessus, Rouge = en dessous.
        Moyenne pondérée : ${mean.toFixed(2)} g/L | Écart-type : ${stdDev.toFixed(2)} g/L
      </div>
    </div>
  `;

  // ─── Page 3: Patterns & Alertes ───────────────────────────────────────────
  const severityColors = {
    warning: { bg: '#fef3c7', border: '#fde68a', color: '#92400e' },
    info: { bg: '#f0f9ff', border: '#bae6fd', color: '#0c4a6e' },
    danger: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
  };

  const patternRows = (patterns && patterns.length > 0)
    ? patterns.map(p => {
        const s = severityColors[p.severity] || severityColors.info;
        return `
          <div style="background:${s.bg};border:1px solid ${s.border};border-radius:10px;padding:14px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:14px;font-weight:600;color:${s.color};">
                ${escapeHtml(p.icon) || ''} ${escapeHtml(p.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
              </span>
              <span style="font-size:12px;color:${s.color};background:rgba(0,0,0,0.05);padding:3px 10px;border-radius:20px;">
                ${p.severity === 'warning' ? 'Attention' : p.severity === 'danger' ? 'Critique' : 'Info'}
                ${p.count ? ` · ${p.count}x` : ''}
              </span>
            </div>
            <div style="font-size:13px;color:${s.color};">${escapeHtml(p.message)}</div>
          </div>
        `;
      }).join('')
    : '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;">Aucun pattern détecté sur cette période.</div>';

  const page3 = `
    <div class="page">
      <h2 style="color:#0CBAA6;margin-bottom:20px;font-size:18px;">3. Patterns & Alertes</h2>
      <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Analyse automatique des tendances détectées sur ${nbDays} jours.</p>
      ${patternRows}
    </div>
  `;

  // ─── Page 4: Données Insuliniques ─────────────────────────────────────────
  const entriesWithDose = entries.filter(e => (e.doseInjected || e.doseCalculated) > 0);

  // Group by day for TDD
  const dailyDoses = {};
  entriesWithDose.forEach(e => {
    const day = new Date(e.date).toISOString().slice(0, 10);
    if (!dailyDoses[day]) dailyDoses[day] = { total: 0, bolus: 0, correction: 0 };
    const dose = e.doseInjected || e.doseCalculated || 0;
    dailyDoses[day].total += dose;
    // Split bolus from correction if available
    if (e.correction != null && e.correction > 0) {
      dailyDoses[day].correction += e.correction;
      dailyDoses[day].bolus += Math.max(0, dose - e.correction);
    } else {
      dailyDoses[day].bolus += dose;
    }
  });

  const dayKeys = Object.keys(dailyDoses);
  const avgTDD = dayKeys.length > 0
    ? (dayKeys.reduce((s, d) => s + dailyDoses[d].total, 0) / dayKeys.length).toFixed(1)
    : '—';
  const avgBolus = dayKeys.length > 0
    ? (dayKeys.reduce((s, d) => s + dailyDoses[d].bolus, 0) / dayKeys.length).toFixed(1)
    : '—';
  const avgCorrection = dayKeys.length > 0
    ? (dayKeys.reduce((s, d) => s + dailyDoses[d].correction, 0) / dayKeys.length).toFixed(1)
    : '—';

  // Ratio by meal type
  const mealRatios = {};
  entries.forEach(e => {
    if (e.mealType && e.totalCarbs > 0 && (e.doseInjected || e.doseCalculated) > 0) {
      if (!mealRatios[e.mealType]) mealRatios[e.mealType] = [];
      const dose = e.doseInjected || e.doseCalculated;
      mealRatios[e.mealType].push(e.totalCarbs / dose);
    }
  });

  const ratioRows = Object.entries(mealRatios).map(([meal, ratios]) => {
    const avgRatio = ratios.length >= 3
      ? (ratios.reduce((s, v) => s + v, 0) / ratios.length).toFixed(1)
      : null;
    const mealLabels = {
      'petit-déjeuner': 'Petit-déjeuner',
      'déjeuner': 'Déjeuner',
      'dîner': 'Dîner',
      'collation': 'Collation',
    };
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;">${mealLabels[meal] || meal}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">${ratios.length}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;font-weight:600;">
        ${avgRatio != null ? `1U : ${avgRatio}g` : 'Données insuffisantes'}
      </td>
    </tr>`;
  }).join('');

  const page4 = `
    <div class="page">
      <h2 style="color:#0CBAA6;margin-bottom:20px;font-size:18px;">4. Données Insuliniques</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#0c4a6e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">TDD moyen</div>
          <div style="font-size:28px;font-weight:700;color:#0369a1;">${avgTDD} U</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">sur ${dayKeys.length} jours</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Bolus repas/j</div>
          <div style="font-size:28px;font-weight:700;color:#15803d;">${avgBolus} U</div>
        </div>
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#6b21a8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Corrections/j</div>
          <div style="font-size:28px;font-weight:700;color:#7c3aed;">${avgCorrection} U</div>
        </div>
      </div>

      ${ratioRows.length > 0 ? `
        <h3 style="font-size:14px;color:#334155;margin-bottom:12px;">Ratio effectif par période</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Repas</th>
              <th style="padding:10px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Mesures</th>
              <th style="padding:10px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Ratio observé</th>
            </tr>
          </thead>
          <tbody>${ratioRows}</tbody>
        </table>
      ` : '<p style="font-size:13px;color:#94a3b8;">Pas assez de données pour calculer les ratios effectifs.</p>'}
    </div>
  `;

  // ─── Page 5: Recommandations ──────────────────────────────────────────────
  const recommendations = [];

  if (tir < 50) {
    recommendations.push({
      icon: '🎯',
      text: 'TIR inférieur à 50%. Une révision globale des ratios et de la basale est recommandée.',
      priority: 'high',
    });
  } else if (tir < 70) {
    recommendations.push({
      icon: '🎯',
      text: 'TIR entre 50% et 70%. Ajustements ciblés recommandés pour les créneaux problématiques.',
      priority: 'medium',
    });
  }

  if (cv > 36) {
    recommendations.push({
      icon: '📊',
      text: `Variabilité glycémique élevée (CV ${cv.toFixed(1)}%). Envisager une analyse des facteurs de variabilité (repas, activité, stress).`,
      priority: 'medium',
    });
  }

  if (hypos >= 3) {
    recommendations.push({
      icon: '⚠️',
      text: `${hypos} épisodes hypoglycémiques détectés. Réviser les doses à la baisse et/ou adapter les collations.`,
      priority: 'high',
    });
  }

  if (hypers >= 5) {
    recommendations.push({
      icon: '📈',
      text: `${hypers} épisodes d'hyperglycémie sévère (> 2.50 g/L). Vérifier l'adéquation des ratios et/ou de la basale.`,
      priority: 'high',
    });
  }

  // Pattern-based recommendations
  if (patterns) {
    patterns.forEach(p => {
      if (p.type === 'dawn_phenomenon') {
        recommendations.push({
          icon: '🌅',
          text: 'Phénomène de l\'aube détecté. Envisager un ajustement de la basale nocturne ou un décalage de l\'heure d\'injection.',
          priority: 'medium',
        });
      }
      if (p.type === 'morning_hypo') {
        recommendations.push({
          icon: '🌙',
          text: 'Hypoglycémies matinales récurrentes. Réduire la basale nocturne et/ou la correction du soir.',
          priority: 'high',
        });
      }
      if (p.type === 'over_correction') {
        recommendations.push({
          icon: '💉',
          text: 'Tendance à sur-doser. Encourager le respect des doses calculées pour réduire le risque hypoglycémique.',
          priority: 'medium',
        });
      }
      if (p.type === 'recurring_stacking') {
        recommendations.push({
          icon: '⚡',
          text: 'Empilements d\'insuline fréquents. Respecter un délai minimum de 3h entre corrections successives.',
          priority: 'medium',
        });
      }
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      icon: '✅',
      text: 'Profil glycémique satisfaisant. Continuer le suivi actuel.',
      priority: 'low',
    });
  }

  const priorityStyles = {
    high: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', label: 'Priorité haute' },
    medium: { bg: '#fefce8', border: '#fde68a', color: '#92400e', label: 'Priorité moyenne' },
    low: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', label: 'Information' },
  };

  const recoHtml = recommendations.map(r => {
    const s = priorityStyles[r.priority] || priorityStyles.low;
    return `
      <div style="background:${s.bg};border:1px solid ${s.border};border-radius:10px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
        <span style="font-size:20px;">${r.icon}</span>
        <div style="flex:1;">
          <div style="font-size:13px;color:${s.color};line-height:1.5;">${r.text}</div>
          <div style="font-size:10px;color:${s.color};opacity:0.7;margin-top:4px;">${s.label}</div>
        </div>
      </div>
    `;
  }).join('');

  const page5 = `
    <div class="page">
      <h2 style="color:#0CBAA6;margin-bottom:20px;font-size:18px;">5. Recommandations</h2>
      ${recoHtml}
      <div style="margin-top:24px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <p style="font-size:12px;color:#64748b;font-style:italic;text-align:center;line-height:1.6;">
          ⚕️ <strong>Suggestions à discuter avec votre médecin.</strong><br/>
          Ces recommandations sont générées automatiquement à partir des données du journal
          et ne constituent pas un avis médical. Toute modification de traitement doit être
          validée par votre endocrinologue.
        </p>
      </div>
    </div>
  `;

  // ─── Assemble full HTML ───────────────────────────────────────────────────
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>InsulinCalc — Rapport Médical</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, 'Segoe UI', sans-serif;
          color: #1a202c;
          padding: 32px;
          max-width: 900px;
          margin: 0 auto;
        }
        .page {
          page-break-after: always;
          min-height: 600px;
          padding-bottom: 32px;
          margin-bottom: 32px;
          border-bottom: 1px dashed #e2e8f0;
        }
        .page:last-child {
          page-break-after: avoid;
          border-bottom: none;
        }
        @media print {
          body { padding: 16px; }
          .no-print { display: none !important; }
          .page { border-bottom: none; margin-bottom: 0; }
        }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0CBAA6;">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:#0CBAA6;margin-bottom:4px;">InsulinCalc — Rapport Médical</h1>
          <div style="font-size:13px;color:#718096;">Patient : ${name} | ${periodStr}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#718096;">Généré le ${dateStr}</div>
          <button class="no-print" onclick="window.print()" style="margin-top:8px;padding:8px 16px;background:#0CBAA6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Imprimer / PDF</button>
        </div>
      </div>

      ${page1}
      ${page2}
      ${page3}
      ${page4}
      ${page5}

      <div style="margin-top:16px;text-align:center;font-size:11px;color:#94a3b8;">
        Rapport généré par InsulinCalc — À partager avec votre endocrinologue
      </div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
