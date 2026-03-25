import { useState, useMemo } from 'react';

export default function TrendChart({ journal, targetGMin, targetGMax, isDark, colors }) {
  const [period, setPeriod] = useState(7);

  const data = useMemo(() => {
    const cutoff = Date.now() - period * 86400000;
    const entries = journal.filter(e => new Date(e.date).getTime() >= cutoff);

    // Group by day
    const byDay = {};
    entries.forEach(e => {
      const day = new Date(e.date).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { glycValues: [], doses: 0, carbs: 0 };
      const pre = parseFloat(e.glycPre);
      if (!isNaN(pre) && pre > 0) byDay[day].glycValues.push(pre);
      const post = parseFloat(e.glycPost);
      if (!isNaN(post) && post > 0) byDay[day].glycValues.push(post);
      if (e.doseActual > 0) byDay[day].doses += e.doseActual;
      if (e.totalCarbs > 0) byDay[day].carbs += e.totalCarbs;
    });

    // Compute daily averages
    const days = Object.entries(byDay)
      .map(([day, d]) => ({
        day,
        label: new Date(day + 'T12:00:00').toLocaleDateString('fr', { weekday: 'short', day: 'numeric' }),
        avg: d.glycValues.length ? d.glycValues.reduce((s, v) => s + v, 0) / d.glycValues.length : null,
        min: d.glycValues.length ? Math.min(...d.glycValues) : null,
        max: d.glycValues.length ? Math.max(...d.glycValues) : null,
        inRange: d.glycValues.filter(v => v >= targetGMin && v <= targetGMax).length,
        total: d.glycValues.length,
        doses: d.doses,
        carbs: d.carbs,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Global stats
    const allGlyc = entries.flatMap(e => {
      const vals = [];
      const pre = parseFloat(e.glycPre);
      if (!isNaN(pre) && pre > 0) vals.push(pre);
      const post = parseFloat(e.glycPost);
      if (!isNaN(post) && post > 0) vals.push(post);
      return vals;
    });

    const avg = allGlyc.length ? allGlyc.reduce((s, v) => s + v, 0) / allGlyc.length : 0;
    const inRange = allGlyc.filter(v => v >= targetGMin && v <= targetGMax).length;
    const hypo = allGlyc.filter(v => v < 0.7).length;
    const hyper = allGlyc.filter(v => v > 2.5).length;
    const tir = allGlyc.length ? Math.round((inRange / allGlyc.length) * 100) : 0;

    // Trend: compare first half vs second half averages
    const mid = Math.floor(allGlyc.length / 2);
    const firstHalf = allGlyc.slice(0, mid);
    const secondHalf = allGlyc.slice(mid);
    const avgFirst = firstHalf.length ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
    const trendDiff = avgSecond - avgFirst;
    let trend = 'stable';
    if (trendDiff > 0.1) trend = 'up';
    else if (trendDiff < -0.1) trend = 'down';

    return { days, avg, tir, hypo, hyper, total: allGlyc.length, trend };
  }, [journal, period, targetGMin, targetGMax]);

  if (data.total < 2) return null;

  const trendIcon = data.trend === 'up' ? '↗️' : data.trend === 'down' ? '↘️' : '→';
  const trendColor = data.trend === 'up' ? 'text-red-500' : data.trend === 'down' ? 'text-emerald-500' : 'text-slate-400';

  // SVG chart
  const W = 340, H = 120, pad = { t: 16, b: 24, l: 30, r: 8 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const minV = 0.4, maxV = Math.max(3.0, ...data.days.filter(d => d.max).map(d => d.max));
  const yScale = (v) => pad.t + ch - ((v - minV) / (maxV - minV)) * ch;
  const validDays = data.days.filter(d => d.avg !== null);
  const xStep = validDays.length > 1 ? cw / (validDays.length - 1) : cw;

  const avgPath = validDays.map((d, i) => `${i === 0 ? 'M' : 'L'}${(pad.l + i * xStep).toFixed(1)},${yScale(d.avg).toFixed(1)}`).join(' ');

  const glycColor = (v) => {
    if (v < 0.7) return colors.red;
    if (v < 1.0) return colors.orange;
    if (v <= 1.8) return colors.green;
    if (v <= 2.5) return colors.yellow;
    return colors.red;
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  return (
    <div className={cardClass}>
      {/* Header with period toggle */}
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          📊 Tendances
        </p>
        <div className="flex gap-1">
          {[7, 30].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition ${
                period === p
                  ? 'bg-teal-500 text-white'
                  : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
              }`}>
              {p}j
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className="text-[9px] uppercase text-gray-400">Moy.</p>
          <p className="text-sm font-bold" style={{ color: glycColor(data.avg) }}>{data.avg.toFixed(2)}</p>
        </div>
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className="text-[9px] uppercase text-gray-400">TIR</p>
          <p className="text-sm font-bold text-emerald-500">{data.tir}%</p>
        </div>
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className="text-[9px] uppercase text-gray-400">Hypos</p>
          <p className="text-sm font-bold text-red-500">{data.hypo}</p>
        </div>
        <div className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <p className="text-[9px] uppercase text-gray-400">Tendance</p>
          <p className={`text-sm font-bold ${trendColor}`}>{trendIcon}</p>
        </div>
      </div>

      {/* Chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        {/* Target zone */}
        <rect x={pad.l} y={yScale(targetGMax)} width={cw} height={yScale(targetGMin) - yScale(targetGMax)}
          fill="rgba(16,185,129,0.08)" rx={4} />
        {/* Y-axis labels */}
        {[0.7, 1.0, 1.5, 2.0, 2.5].filter(v => v <= maxV).map(v => (
          <text key={v} x={pad.l - 4} y={yScale(v) + 3} textAnchor="end"
            fill={isDark ? '#475569' : '#94A3B8'} fontSize={8}>{v}</text>
        ))}
        {/* Min-max range per day */}
        {validDays.map((d, i) => d.min !== d.max && (
          <line key={`r${i}`} x1={pad.l + i * xStep} x2={pad.l + i * xStep}
            y1={yScale(d.max)} y2={yScale(d.min)}
            stroke={isDark ? 'rgba(94,234,212,0.15)' : 'rgba(13,148,136,0.12)'} strokeWidth={6} strokeLinecap="round" />
        ))}
        {/* Average line */}
        {validDays.length > 1 && (
          <path d={avgPath} fill="none" stroke={isDark ? '#5eead4' : '#0d9488'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Points */}
        {validDays.map((d, i) => (
          <circle key={i} cx={pad.l + i * xStep} cy={yScale(d.avg)} r={4}
            fill={glycColor(d.avg)} stroke={isDark ? '#1e293b' : '#fff'} strokeWidth={2} />
        ))}
        {/* X-axis labels */}
        {validDays.map((d, i) => (
          <text key={`x${i}`} x={pad.l + i * xStep} y={H - 4} textAnchor="middle"
            fill={isDark ? '#475569' : '#94A3B8'} fontSize={7}>{d.label}</text>
        ))}
      </svg>

      {/* TIR bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Temps dans la cible</span>
          <span className="text-[9px] font-bold text-emerald-500">{data.tir}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex">
          <div className="bg-red-400 h-full" style={{ width: `${data.total ? Math.round((data.hypo / data.total) * 100) : 0}%` }} />
          <div className="bg-emerald-400 h-full" style={{ width: `${data.tir}%` }} />
          <div className="bg-amber-400 h-full flex-1" />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-red-400">Hypo</span>
          <span className="text-[8px] text-emerald-400">Cible</span>
          <span className="text-[8px] text-amber-400">Haut</span>
        </div>
      </div>
    </div>
  );
}
