import { useThemePreference } from '@/lib/theme';

export function useColorScheme(): 'light' | 'dark' {
  return useThemePreference().scheme;
}
