import { useMemo } from 'react';

export default function GlycemiaChart({ entries, targetGMin, targetGMax, isDark, colors }) {
  const points = useMemo(() => {
    const pts = [];
    entries.forEach(e => {
      const t = new Date(e.date).getTime();
      const pre = parseFloat(e.glycPre ?? e.preMealGlycemia);
      if (!isNaN(pre)) pts.push({ t, v: pre, type: 'pre' });
      const post = parseFloat(e.glycPost ?? e.postMealGlycemia);
      if (!isNaN(post) && post > 0) pts.push({ t: t + 120*60000, v: post, type: 'post' });
    });
    return pts.sort((a, b) => a.t - b.t).slice(-30);
  }, [entries]);

  if (points.length < 2) return null;

  const width = 340, height = 100;
  const pad = { top: 12, bottom: 16, left: 8, right: 8 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const minT = points[0].t, maxT = points[points.length - 1].t;
  const rangeT = maxT - minT || 1;
  const minV = 0.4, maxV = Math.max(3.0, ...points.map(p => p.v));

  const x = (t) => pad.left + ((t - minT) / rangeT) * w;
  const y = (v) => pad.top + h - ((v - minV) / (maxV - minV)) * h;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  const glycColor = (v) => {
    if (v < 0.7) return colors.red;
    if (v < 1.0) return colors.orange;
    if (v <= 1.8) return colors.green;
    if (v <= 2.5) return colors.yellow;
    return colors.red;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
      {/* Target zone */}
      <rect x={pad.left} y={y(targetGMax)} width={w} height={y(targetGMin) - y(targetGMax)}
        fill={isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.08)'} rx={4} />
      <line x1={pad.left} x2={width-pad.right} y1={y(targetGMin)} y2={y(targetGMin)}
        stroke="rgba(16,185,129,0.15)" strokeDasharray="4,4" />
      <line x1={pad.left} x2={width-pad.right} y1={y(targetGMax)} y2={y(targetGMax)}
        stroke="rgba(16,185,129,0.15)" strokeDasharray="4,4" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={isDark ? 'rgba(94,234,212,0.3)' : 'rgba(13,148,136,0.25)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r={4}
          fill={glycColor(p.v)} stroke={isDark ? '#1e293b' : '#fff'} strokeWidth={2} />
      ))}
      {/* Labels */}
      <text x={pad.left+2} y={y(targetGMin)+12} fill={isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.5)'} fontSize={9} fontFamily="sans-serif">{targetGMin}</text>
      <text x={pad.left+2} y={y(targetGMax)-4} fill={isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.5)'} fontSize={9} fontFamily="sans-serif">{targetGMax}</text>
    </svg>
  );
}
