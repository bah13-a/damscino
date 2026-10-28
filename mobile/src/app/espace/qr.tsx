import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Vibration, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { discountText, ScanNotice } from '@/components/ScanNotice';
import { Alert, Button, Card, MotifBand, Spinner, T } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dt, percent, time } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { Dashboard, LastScan, QrCode } from '@/lib/types';
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

/** QR code of the day, closed automatically once validated at the till; every scan of it is shown live. */
export default function QrScreen() {
  useKeepAwake();
  useDisplayProtection();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [qr, setQr] = useState<QrCode | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [scan, setScan] = useState<LastScan | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fetchedAt = useRef(0);
  // scan already known when the screen opened: only the scans made while the code is displayed are announced
  const knownScan = useRef<string | null | undefined>(undefined);

  const receive = useCallback((current: Dashboard) => {
    setDashboard(current);
    const last = current.lastScan;
    if (knownScan.current === undefined) {
      knownScan.current = last?.scannedAt ?? null;
    } else if (last && last.scannedAt !== knownScan.current) {
      knownScan.current = last.scannedAt;
      setScan(last);
      Vibration.vibrate(last.status === 'REFUSED' ? [0, 60, 60, 60] : 80);
      if (last.status === 'CONFIRMED') setValidated(true);
    }
    if (current.availability === 'USED') setValidated(true);
  }, []);

  const refreshQr = useCallback(async () => {
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const response = await api<{ qrCode: string }>('/api/privileges/qr/daily');
          fetchedAt.current = Date.now();
          // Calculate seconds until midnight (Tunisia timezone)
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          const secondsUntilMidnight = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

          setQr({
            token: response.qrCode,
            expiresAt: new Date(fetchedAt.current + 24 * 60 * 60 * 1000).toISOString(),
            refreshInSeconds: secondsUntilMidnight,
            serverTime: new Date(fetchedAt.current).toISOString(),
          });
          setError(null);
          return;
        } catch (e) {
          lastError = e;
          if (e instanceof ApiError && e.code === 'QUOTA_REACHED') throw e;
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) throw e;
          if (attempt < 29) {
            const delay = Math.min(1000 + attempt * 200, 5000);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      throw lastError;
    } catch (e) {
      setQr(null);
      if (e instanceof ApiError && e.code === 'QUOTA_REACHED') setValidated(true);
      else setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    refreshQr();
    // Load dashboard data without blocking QR display
    api<Dashboard>('/api/privileges/me')
      .then(receive)
      .catch(() => {
        // Dashboard is optional - proceed without it
      });
  }, [refreshQr, receive]);

  // renew the code on the interval announced by the server
  useEffect(() => {
    if (!qr || validated) return;
    const timer = setTimeout(refreshQr, qr.refreshInSeconds * 1000);
    return () => clearTimeout(timer);
  }, [qr, validated, refreshQr]);

  // follow the scans at the till (cashier's phone, handheld scanner or till) and detect the validation
  useEffect(() => {
    if (validated || error) return;
    const timer = setInterval(async () => {
      try {
        receive(await api<Dashboard>('/api/privileges/me'));
      } catch {
        // keep showing the code; the next renewal surfaces real errors
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [validated, error, receive]);

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
            <T variant="muted" style={{ textAlign: 'center' }} testID="validated-detail">
              {scan?.status === 'CONFIRMED'
                ? `Remise de ${discountText(scan)} appliquée à ${time(scan.scannedAt)}${scan.staffName ? ` par ${scan.staffName}` : ''}.`
                : lastPassage
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
            {scan && <ScanNotice scan={scan} />}
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
