// ─── PDF EXPORT via canvas → blob ───────────────────────────────────────────
// Pure JS approach using canvas to generate a simple PDF-like document.
// Falls back to a printable HTML window if canvas approach is insufficient.

export function generateJournalPdf(entries, period, stats, patientName) {
  // Build an HTML document that can be printed to PDF
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const name = patientName || 'Patient';

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
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${e.date || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${e.repas || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;">${e.glycPre ?? '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;">${e.glycPost ?? '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;font-weight:600;color:#0CBAA6;">${e.dose ?? '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${e.aliments || '—'}</td>
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
