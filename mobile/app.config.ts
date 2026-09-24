import type { ExpoConfig } from 'expo/config';

const NAVY = '#131F35';

/**
 * Damascino Privilèges: the beneficiary and staff app. The API address is fixed at build time
 * (EXPO_PUBLIC_API_URL); test builds may let the user change it (EXPO_PUBLIC_ALLOW_SERVER_CHANGE=1).
 */
const config: ExpoConfig = {
  name: 'Damascino Privilèges',
  slug: 'damascino-privileges',
  scheme: 'damascino',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: NAVY,
  ios: {
    bundleIdentifier: 'tn.damascino.privileges',
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'tn.damascino.privileges',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: NAVY,
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'La caméra sert à scanner le QR code des bénéficiaires en caisse.',
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      'expo-splash-screen',
      { image: './assets/splash-logo.png', backgroundColor: NAVY, imageWidth: 240 },
    ],
  ],
  experiments: { typedRoutes: false },
};

export default config;
