import { useThemePreference } from '@/lib/theme';

export const useColorScheme = (): 'light' | 'dark' => {
  return useThemePreference().scheme;
};
