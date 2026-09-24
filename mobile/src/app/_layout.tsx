import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onSessionExpired } from '@/lib/api';
import { loadServer } from '@/lib/config';
import { getSession, loadSession } from '@/lib/session';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadServer(), loadSession()]).finally(() => setReady(true));
    // a session ended by the server (expired, or the account signed in on another phone) sends back to the login
    onSessionExpired((reason) => {
      const space = getSession()?.space;
      router.replace({ pathname: '/connexion', params: { espace: space ?? 'beneficiary', expire: reason } });
    });
  }, []);

  const loaded = ready && (fontsLoaded || Boolean(fontError));
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }} />
    </SafeAreaProvider>
  );
}
