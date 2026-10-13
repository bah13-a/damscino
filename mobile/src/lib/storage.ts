import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tokens live in the device keystore (Android Keystore / iOS Keychain). The web build only exists for automated
 * tests, where localStorage stands in.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    } catch {
      // Silently fail on storage errors to prevent blocking the app
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail on removal errors
    }
  },
};
