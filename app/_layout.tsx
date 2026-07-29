import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { getHasOnboarded } from '@/lib/storage';
import { ThemePreferenceProvider } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';
import { PremiumProvider } from '@/lib/premium';
import { useAppLock } from '@/lib/appLock';
import { AppLockScreen } from '@/components/AppLockScreen';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    getHasOnboarded().then((done) => {
      setNeedsOnboarding(!done);
      setOnboardingChecked(true);
    });
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const ready = loaded && onboardingChecked;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ThemePreferenceProvider>
      <I18nProvider>
        <PremiumProvider>
          <RootLayoutNav needsOnboarding={needsOnboarding} />
        </PremiumProvider>
      </I18nProvider>
    </ThemePreferenceProvider>
  );
}

function RootLayoutNav({ needsOnboarding }: { needsOnboarding: boolean }) {
  const colorScheme = useColorScheme();
  const { ready: lockReady, locked, unlock } = useAppLock();

  useEffect(() => {
    if (needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [needsOnboarding]);

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  if (lockReady && locked && !needsOnboarding) {
    return (
      <ThemeProvider value={navTheme}>
        <AppLockScreen onUnlock={unlock} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="how-it-works" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="categories" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="notifications" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </ThemeProvider>
  );
}
