import { useMemo } from 'react';

function glycColor(v) {
  if (v < 0.7) return '#EF4444';
  if (v < 1.0) return '#F97316';
  if (v <= 1.8) return '#10B981';
  if (v <= 2.5) return '#F59E0B';
  return '#EF4444';
}

export default function GlycEvolutionChart({ journal, targetGMin, targetGMax, isDark, t }) {
  const chartEntries = useMemo(() => {
    return journal
      .filter(e => e.glycPre && parseFloat(e.glycPre) > 0)
      .slice(0, 30)
      .reverse();
  }, [journal]);

  const stats = useMemo(() => {
    const glycVals = chartEntries.map(e => parseFloat(e.glycPre)).filter(v => !isNaN(v));
    const postVals = chartEntries.map(e => parseFloat(e.glycPost)).filter(v => !isNaN(v) && v > 0);
    const doseVals = chartEntries.map(e => e.doseActual).filter(v => v != null && !isNaN(v) && v > 0);
    const avg = glycVals.length > 0 ? (glycVals.reduce((a, b) => a + b, 0) / glycVals.length) : 0;
    const inRange = glycVals.filter(v => v >= targetGMin && v <= targetGMax).length;
    const tirPct = glycVals.length > 0 ? Math.round((inRange / glycVals.length) * 100) : 0;
    const avgDose = doseVals.length > 0 ? (doseVals.reduce((a, b) => a + b, 0) / doseVals.length) : 0;
    return { avg, tirPct, avgDose, count: glycVals.length, postCount: postVals.length };
  }, [chartEntries, targetGMin, targetGMax]);

  if (chartEntries.length < 2) return null;

  // Chart dimensions
  const w = 360, h = 200;
  const padL = 35, padR = 10, padT = 15, padB = 25;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const glycPrePts = chartEntries.map(e => parseFloat(e.glycPre)).map(v => isNaN(v) ? null : v);
  const glycPostPts = chartEntries.map(e => e.glycPost ? parseFloat(e.glycPost) : null).map(v => isNaN(v) ? null : v);
  const allGlyc = [...glycPrePts, ...glycPostPts].filter(v => v != null);
  const minG = Math.min(0.4, ...allGlyc);
  const maxG = Math.max(2.5, ...allGlyc);

  const dosePts = chartEntries.map(e => {
    const d = e.doseActual != null ? e.doseActual : e.doseSuggested;
    return d != null && !isNaN(Number(d)) ? Number(d) : null;
  });
  const allDose = dosePts.filter(v => v != null);
  const maxD = allDose.length > 0 ? Math.max(5, ...allDose) : 10;

  const xStep = chartEntries.length > 1 ? chartW / (chartEntries.length - 1) : chartW;
  const yG = (v) => padT + chartH - ((v - minG) / (maxG - minG)) * chartH;

  const buildPath = (pts, yFn) => {
    let d = '';
    pts.forEach((v, i) => {
      if (v == null) return;
      const x = padL + i * xStep;
      const y = yFn(v);
      d += d === '' ? `M${x},${y}` : `L${x},${y}`;
    });
    return d;
  };

  const pathPre = buildPath(glycPrePts, yG);
  const pathPost = buildPath(glycPostPts, yG);

  const yTargetMin = yG(targetGMin);
  const yTargetMax = yG(targetGMax);
  const targetH = yTargetMin - yTargetMax;

  // Date labels
  const dateLabels = chartEntries.map(e => {
    const d = e.date || '';
    try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
    catch { return ''; }
  });

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  return (
    <div className={cardClass}>
      <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
        📊 {t('resumeEvolution') || 'Évolution glycémique'}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className={`text-[9px] uppercase ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Moyenne</p>
          <p className="text-sm font-bold" style={{ color: glycColor(stats.avg) }}>{stats.avg.toFixed(2)}</p>
          <p className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>g/L</p>
        </div>
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className={`text-[9px] uppercase ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Dans cible</p>
          <p className={`text-sm font-bold ${stats.tirPct >= 70 ? 'text-emerald-500' : stats.tirPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{stats.tirPct}%</p>
          <p className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>{stats.count} mes.</p>
        </div>
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className={`text-[9px] uppercase ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Dose moy.</p>
          <p className="text-sm font-bold text-blue-500">{stats.avgDose.toFixed(1)}</p>
          <p className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>U/repas</p>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 300 }}>
          {/* Target range band */}
          <rect x={padL} y={yTargetMax} width={chartW} height={targetH}
            fill={isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.1)'}
            stroke={isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)'}
            strokeDasharray="4 4" rx="3" />

          {/* Y-axis grid lines */}
          {[0.5, 1.0, 1.5, 2.0, 2.5].filter(v => v >= minG && v <= maxG).map(v => (
            <g key={v}>
              <line x1={padL} y1={yG(v)} x2={w - padR} y2={yG(v)}
                stroke={isDark ? '#1e293b' : '#e2e8f0'} strokeWidth="0.5" />
              <text x={padL - 4} y={yG(v) + 3} textAnchor="end"
                fill={isDark ? '#475569' : '#94a3b8'} fontSize="8">{v.toFixed(1)}</text>
            </g>
          ))}

          {/* Dose bars */}
          {dosePts.map((d, i) => {
            if (d == null) return null;
            const x = padL + i * xStep;
            const barH = (d / maxD) * chartH;
            return (
              <rect key={`d${i}`} x={x - 3} y={padT + chartH - barH} width={6} height={barH}
                fill={isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)'}
                rx="2" />
            );
          })}

          {/* Glyc pre line */}
          {pathPre && <path d={pathPre} fill="none" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />}
          {/* Glyc post line (dashed) */}
          {pathPost && <path d={pathPost} fill="none" stroke="#F97316" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />}

          {/* Dots */}
          {glycPrePts.map((v, i) => {
            if (v == null) return null;
            return <circle key={`pre${i}`} cx={padL + i * xStep} cy={yG(v)} r="3"
              fill={glycColor(v)} stroke={isDark ? '#1e293b' : '#fff'} strokeWidth="1.5" />;
          })}
          {glycPostPts.map((v, i) => {
            if (v == null) return null;
            return <circle key={`post${i}`} cx={padL + i * xStep} cy={yG(v)} r="2.5"
              fill="#F97316" stroke={isDark ? '#1e293b' : '#fff'} strokeWidth="1" />;
          })}

          {/* X-axis date labels (first, middle, last) */}
          {[0, Math.floor(chartEntries.length / 2), chartEntries.length - 1].map(idx => (
            <text key={`lbl${idx}`} x={padL + idx * xStep} y={h - 4}
              textAnchor="middle" fill={isDark ? '#475569' : '#94a3b8'} fontSize="7">
              {dateLabels[idx]}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Pré-repas</span>
        </span>
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-3 h-0.5 bg-orange-500 rounded inline-block" style={{ borderBottom: '1px dashed' }} />
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Post-repas</span>
        </span>
        <span className="flex items-center gap-1 text-[10px]">
          <span className="w-2 h-2 bg-purple-400/40 rounded-sm inline-block" />
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Doses</span>
        </span>
      </div>
    </div>
  );
}
