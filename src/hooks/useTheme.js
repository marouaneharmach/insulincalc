import { useLocalStorage } from './useLocalStorage';

// V4 Health App palette — light-first
const LIGHT = {
  bg: '#F7FAFB',
  card: '#FFFFFF',
  border: '#E8EDF2',
  primary: '#0D9488',
  accent: '#0D9488',
  accentLight: '#5EEAD4',
  accentDim: 'rgba(13,148,136,0.08)',
  text: '#1E293B',
  textSecondary: '#64748B',
  muted: '#94A3B8',
  faint: '#F1F5F9',
  // Semantic
  glucose: '#EC4899',
  insulin: '#3B82F6',
  meal: '#10B981',
  activity: '#F59E0B',
  // Status
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#F97316',
  red: '#EF4444',
  purple: '#8B5CF6',
};

const DARK = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  primary: '#14B8A6',
  accent: '#14B8A6',
  accentLight: '#5EEAD4',
  accentDim: 'rgba(20,184,166,0.12)',
  text: '#E2E8F0',
  textSecondary: '#94A3B8',
  muted: '#64748B',
  faint: '#1E293B',
  // Semantic
  glucose: '#F472B6',
  insulin: '#60A5FA',
  meal: '#34D399',
  activity: '#FBBF24',
  // Status
  green: '#34D399',
  yellow: '#FBBF24',
  orange: '#FB923C',
  red: '#F87171',
  purple: '#A78BFA',
};

export function useTheme() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  const isDark = theme === 'dark';
  const colors = isDark ? DARK : LIGHT;
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
  return { theme, isDark, colors, toggleTheme };
}
