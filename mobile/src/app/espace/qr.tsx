import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Button, Card, MotifBand, Spinner, T } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dt, percent } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { Dashboard, QrCode } from '@/lib/types';
import { homeOf, useSession } from '@/lib/useSession';

const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Tunis' });

/** Screen brightness to the maximum and no screenshot while the code is displayed (native app only). */
function useDisplayProtection() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let previous: number | null = null;
    Brightness.getBrightnessAsync()
      .then((value) => {
        previous = value;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => undefined);
    ScreenCapture.preventScreenCaptureAsync('qr').catch(() => undefined);
    return () => {
      if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => undefined);
      ScreenCapture.allowScreenCaptureAsync('qr').catch(() => undefined);
    };
  }, []);
}

/** QR code of the day: renewed every 30 s, closed automatically once validated at the till. */
export default function QrScreen() {
  useKeepAwake();
  useDisplayProtection();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [qr, setQr] = useState<QrCode | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fetchedAt = useRef(0);

  const refreshQr = useCallback(async () => {
    try {
      const code = await api<QrCode>('/api/privileges/qr', { method: 'POST' });
      fetchedAt.current = Date.now();
      setQr(code);
      setError(null);
    } catch (e) {
      setQr(null);
      if (e instanceof ApiError && e.code === 'QUOTA_REACHED') setValidated(true);
      else setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    refreshQr();
    api<Dashboard>('/api/privileges/me').then(setDashboard).catch(() => undefined);
  }, [refreshQr]);

  // renew the code on the interval announced by the server
  useEffect(() => {
    if (!qr || validated) return;
    const timer = setTimeout(refreshQr, qr.refreshInSeconds * 1000);
    return () => clearTimeout(timer);
  }, [qr, validated, refreshQr]);

  // detect the validation at the till
  useEffect(() => {
    if (validated || error) return;
    const timer = setInterval(async () => {
      try {
        const current = await api<Dashboard>('/api/privileges/me');
        setDashboard(current);
        if (current.availability === 'USED') setValidated(true);
      } catch {
        // keep showing the code; the next renewal surfaces real errors
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [validated, error]);

  // live clock (helps the cashier spot a recording) + a fresh code when the app comes back
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && !validated && refreshQr());
    return () => {
      clearInterval(tick);
      subscription.remove();
    };
  }, [refreshQr, validated]);

  if (!session || session.space !== 'beneficiary' || session.mustChangePassword) return <Redirect href={homeOf(session)} />;

  const remaining = qr ? Math.max(0, qr.refreshInSeconds - Math.floor((now - fetchedAt.current) / 1000)) : 0;
  const lastPassage = dashboard?.history[0];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/espace'));

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.topRow}>
        <T style={styles.link} accessibilityRole="link" onPress={back}>
          ← Retour
        </T>
        <T style={styles.clock}>{clock.format(now)}</T>
      </View>

      <View style={styles.body}>
        {validated ? (
          <Card style={styles.center}>
            <View style={styles.check}>
              <T style={{ fontSize: 40, color: colors.successInk }}>✓</T>
            </View>
            <T variant="display" accessibilityRole="header">
              Avantage utilisé
            </T>
            <T variant="muted" style={{ textAlign: 'center' }}>
              {lastPassage
                ? `Remise de ${percent(lastPassage.discountPercent)}${lastPassage.discountAmount !== null ? ` (${dt(lastPassage.discountAmount)})` : ''} appliquée.`
                : 'Votre passage a bien été enregistré.'}{' '}
              Bon appétit !
            </T>
            <Button title="Terminer" style={{ alignSelf: 'stretch', marginTop: 8 }} onPress={() => router.replace('/espace')} />
          </Card>
        ) : error ? (
          <Card style={{ gap: 16 }}>
            <Alert>{error}</Alert>
            <Button title="Retour à mon espace" onPress={() => router.replace('/espace')} />
          </Card>
        ) : (
          <Card style={styles.center}>
            <T variant="title">{dashboard?.fullName ?? session.displayName}</T>
            {dashboard?.partnerName ? <T variant="muted">{dashboard.partnerName}</T> : null}
            <View style={styles.qr} testID="qr-code" accessibilityLabel="QR code à présenter en caisse">
              {qr ? <QRCode value={qr.token} size={250} ecl="M" color={colors.ink} backgroundColor={colors.white} /> : <Spinner />}
            </View>
            <T variant="muted" style={{ textAlign: 'center' }}>
              Présentez ce code en caisse · nouveau code dans{' '}
              <T style={{ fontFamily: fonts.semibold }} testID="qr-countdown">
                {remaining}s
              </T>
            </T>
            <T variant="small" style={{ textAlign: 'center' }}>
              Valable pour un seul plat éligible. Les captures d’écran sont bloquées et ne fonctionneraient pas.
            </T>
          </Card>
        )}
      </View>
      <MotifBand opacity={0.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: 16, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  clock: { color: colors.sand, fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] },
  body: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: 420, alignSelf: 'center' },
  center: { alignItems: 'center', gap: 10 },
  qr: { width: 270, height: 270, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, marginVertical: 8 },
  check: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
});
