import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getAppLockEnabled } from './storage';

/**
 * Gates the app behind Face ID / Touch ID (or the device passcode as a fallback) when the
 * user has turned the lock on in Settings. Re-locks on every background transition, re-reading
 * the setting from storage each time so a change made in Settings takes effect on the very next
 * backgrounding without needing to sync state across the component tree.
 */
export function useAppLock() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setReady(true);
      return;
    }

    getAppLockEnabled().then((enabled) => {
      setLocked(enabled);
      setReady(true);
    });

    const subscription = AppState.addEventListener('change', async (next) => {
      const goingBackground = appState.current === 'active' && /inactive|background/.test(next);
      appState.current = next;
      if (goingBackground) {
        const enabled = await getAppLockEnabled();
        if (enabled) setLocked(true);
      }
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) {
      // Nothing to authenticate against on this device — don't strand the user behind a lock
      // screen that can never succeed.
      setLocked(false);
      return true;
    }
    const result = await LocalAuthentication.authenticateAsync({ disableDeviceFallback: false });
    if (result.success) setLocked(false);
    return result.success;
  }, []);

  return { ready, locked, unlock };
}
