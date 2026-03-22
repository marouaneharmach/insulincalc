import { useLocalStorage } from './useLocalStorage.js';
import { C, C_LIGHT } from '../utils/colors.js';

export function useTheme() {
  const [theme, setTheme] = useLocalStorage('theme', 'dark');

  const colors = theme === 'light' ? C_LIGHT : C;

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, colors, toggleTheme };
}
