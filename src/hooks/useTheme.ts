import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type ThemePreference = 'light' | 'dark' | 'system';

// Palette (clair d'abord)
const LIGHT = {
  bg: '#F7FAFB', card: '#FFFFFF', border: '#E8EDF2', primary: '#0D9488', accent: '#0D9488', accentLight: '#5EEAD4',
  accentDim: 'rgba(13,148,136,0.08)', text: '#1E293B', textSecondary: '#475569', muted: '#64748B', faint: '#F1F5F9',
  glucose: '#DB2777', insulin: '#2563EB', meal: '#059669', activity: '#D97706',
  green: '#059669', yellow: '#D97706', orange: '#EA580C', red: '#DC2626', purple: '#7C3AED',
};

const DARK = {
  bg: '#0F172A', card: '#1E293B', border: '#334155', primary: '#14B8A6', accent: '#14B8A6', accentLight: '#5EEAD4',
  accentDim: 'rgba(20,184,166,0.12)', text: '#E2E8F0', textSecondary: '#94A3B8', muted: '#94A3B8', faint: '#1E293B',
  glucose: '#F472B6', insulin: '#60A5FA', meal: '#34D399', activity: '#FBBF24',
  green: '#34D399', yellow: '#FBBF24', orange: '#FB923C', red: '#F87171', purple: '#A78BFA',
};

export type ThemeColors = typeof LIGHT;

function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<ThemePreference>('theme', 'system');
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const colors = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0F172A' : '#0D9488');
  }, [isDark]);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
  return { theme, setTheme, isDark, colors, toggleTheme };
}
