import type { ConfigContext, ExpoConfig } from 'expo/config';

const NAVY = '#131F35';
/** test = app "Privilèges TEST" installable next to the production app, pointing to the test server. */
const TEST = (process.env.APP_ENV ?? 'test') !== 'prod';
const PACKAGE = TEST ? 'tn.damascino.privileges.test' : 'tn.damascino.privileges';

/**
 * Damascino Privilèges: the beneficiary and staff app. The API address is fixed at build time
 * (EXPO_PUBLIC_API_URL); test builds may let the user change it (EXPO_PUBLIC_ALLOW_SERVER_CHANGE=1).
 */
const app: ExpoConfig = {
  name: TEST ? 'Privilèges TEST' : 'Damascino Privilèges',
  slug: 'damascino-privileges',
  scheme: TEST ? 'damascino-test' : 'damascino',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: NAVY,
  ios: {
    bundleIdentifier: PACKAGE,
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: PACKAGE,
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
        cameraPermission: 'La caméra sert à scanner les QR codes Damascino Privilèges (étiquette de la caisse, QR code des clients).',
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

/**
 * app.json only carries what EAS Build writes itself (extra.eas.projectId, owner) when the app is linked to an Expo
 * project by infra/build-apk.sh: it is merged here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...app,
  ...(config.owner ? { owner: config.owner } : {}),
  extra: { ...config.extra },
});
