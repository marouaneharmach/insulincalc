import { useState, useEffect } from 'react';

export default function DoseAnimation({ dose, bolusType, isDark }) {
  const [animate, setAnimate] = useState(false);
  const [prevDose, setPrevDose] = useState(null);

  useEffect(() => {
    if (dose !== prevDose) {
      setAnimate(true);
      setPrevDose(dose);
      const timer = setTimeout(() => setAnimate(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [dose, prevDose]);

  return (
    <div className={`flex items-end gap-2 mb-3 transition-all duration-500 ${animate ? 'scale-110' : 'scale-100'}`}>
      <span className={`text-4xl font-bold tracking-tight transition-all duration-700 ${
        animate ? 'text-teal-400' : 'text-teal-600'
      }`}
        style={animate ? { textShadow: '0 0 20px rgba(13,148,136,0.4)' } : {}}>
        {dose}
      </span>
      <span className={`text-lg mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>U</span>
      <span className={`text-xs px-2 py-0.5 rounded-full mb-2 ${
        bolusType === 'dual' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
      }`}>
        {bolusType === 'dual' ? '⚡ Dual' : '💉 Standard'}
      </span>
      {animate && (
        <span className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-teal-400 animate-ping" />
      )}
    </div>
  );
}
