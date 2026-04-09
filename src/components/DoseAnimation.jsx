import { useState, useEffect, useRef } from 'react';

export default function DoseAnimation({ dose, bolusType, isDark }) {
  const [animate, setAnimate] = useState(false);
  const prevDoseRef = useRef(null);

  useEffect(() => {
    if (dose !== prevDoseRef.current) {
      prevDoseRef.current = dose;
      // Use requestAnimationFrame to avoid synchronous setState in effect
      const raf = requestAnimationFrame(() => setAnimate(true));
      const timer = setTimeout(() => setAnimate(false), 1200);
      return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
    }
  }, [dose]);

  return (
    <div className={`relative flex flex-col items-center justify-center py-2 transition-all duration-500 ${animate ? 'scale-110' : 'scale-100'}`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-5xl font-bold tracking-tight transition-all duration-700 ${
          animate ? 'text-teal-400' : 'text-teal-600'
        }`}
          style={animate ? { textShadow: '0 0 20px rgba(13,148,136,0.4)' } : {}}>
          {dose}
        </span>
        <span className={`text-xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>U</span>
      </div>
      <span className={`text-xs px-3 py-1 rounded-full mt-1 ${
        bolusType === 'dual' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
      }`}>
        {bolusType === 'dual' ? '⚡ Dual' : '💉 Standard'}
      </span>
      {animate && (
        <span className="absolute right-1/3 -top-1 w-3 h-3 rounded-full bg-teal-400 animate-ping" />
      )}
    </div>
  );
}
