import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Button, Card, MotifBand, Spinner, T } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { percent } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { CounterResult } from '@/lib/types';
import { homeOf, useSession } from '@/lib/useSession';

/** Counter QR code: https://<site>/comptoir/<code> (printed from Administration → Caisses). */
const COUNTER_LINK = /\/comptoir\/([A-Za-z0-9_-]{8,40})(?:[/?#]|$)/;
const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Tunis' });

type Step = { kind: 'scan' } | { kind: 'checking' } | { kind: 'result'; result: CounterResult };

/**
 * Validation screen shown to the cashier: live clock and a pulsing badge, so that a screenshot or a recording of an
 * earlier validation is easy to spot.
 */
function Validated({ result }: { result: CounterResult }) {
  const [now, setNow] = useState(() => Date.now());
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      clearInterval(tick);
      loop.stop();
    };
  }, [pulse]);

  return (
    <View style={[styles.result, { backgroundColor: colors.success }]} testID="counter-result" accessibilityLiveRegion="assertive">
      <Animated.View style={[styles.badge, { transform: [{ scale: pulse }] }]}>
        <T style={styles.badgeText}>−{percent(result.discountPercent)}</T>
      </Animated.View>
      <T style={styles.title} accessibilityRole="header">
        Remise validée
      </T>
      <T style={styles.text}>
        Caissier : appliquez la remise <T style={[styles.text, styles.strong]}>« {result.discountName} »</T>
      </T>
      <View style={styles.box}>
        <T style={[styles.text, styles.strong]}>{result.beneficiaryName}</T>
        {result.partnerName ? <T style={styles.text}>{result.partnerName}</T> : null}
        <T style={styles.text}>{result.tillName}</T>
        {result.validationCode ? <T style={styles.text}>Code : {result.validationCode}</T> : null}
      </View>
      <T style={styles.clock} testID="counter-clock">
        {clock.format(now)}
      </T>
    </View>
  );
}

function Refused({ result }: { result: CounterResult }) {
  return (
    <View style={[styles.result, { backgroundColor: colors.danger }]} testID="counter-result" accessibilityLiveRegion="assertive">
      <T style={styles.icon}>✕</T>
      <T style={styles.title} accessibilityRole="header">
        Remise refusée
      </T>
      <T style={styles.text}>{result.message}</T>
      {result.tillName ? <T style={styles.text}>{result.tillName}</T> : null}
    </View>
  );
}

/** "Utiliser mon avantage": the customer scans the QR code stuck on the counter and shows the result to the cashier. */
export default function CounterScanScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);

  if (!session || session.space !== 'beneficiary' || session.mustChangePassword) return <Redirect href={homeOf(session)} />;

  const scanned = async (data: string) => {
    if (locked.current) return;
    const code = COUNTER_LINK.exec(data)?.[1];
    if (!code) {
      setError('Ce n’est pas le QR code d’une caisse Damascino Privilèges. Scannez l’étiquette collée sur la caisse.');
      return;
    }
    locked.current = true;
    setError(null);
    setStep({ kind: 'checking' });
    try {
      const result = await api<CounterResult>(`/api/privileges/counter/${code}/use`, { method: 'POST' });
      Vibration.vibrate(result.status === 'CONFIRMED' ? 120 : [0, 60, 60, 60]);
      setStep({ kind: 'result', result });
    } catch (e) {
      setError(errorMessage(e));
      setStep({ kind: 'scan' });
      locked.current = false;
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/espace'));

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <T style={styles.link} accessibilityRole="link" onPress={back}>
        ← Retour
      </T>

      <View style={styles.body}>
        {step.kind === 'result' ? (
          <>
            {step.result.status === 'CONFIRMED' ? <Validated result={step.result} /> : <Refused result={step.result} />}
            <Button title="Terminer" variant="light" large onPress={() => router.replace('/espace')} />
          </>
        ) : step.kind === 'checking' ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
            <Spinner />
            <T variant="muted">Validation…</T>
          </Card>
        ) : (
          <>
            <T variant="title" style={{ color: colors.white, textAlign: 'center' }} accessibilityRole="header">
              Scannez le QR code de la caisse
            </T>
            {error && <Alert>{error}</Alert>}
            {!permission ? (
              <Spinner color={colors.white} />
            ) : !permission.granted ? (
              <Card style={{ gap: 12 }}>
                <T>L’application a besoin de l’appareil photo pour scanner le QR code de la caisse.</T>
                <Button title="Autoriser l’appareil photo" onPress={requestPermission} />
              </Card>
            ) : (
              <View style={styles.camera}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => data && scanned(data)}
                />
                <View style={styles.frame} pointerEvents="none" />
              </View>
            )}
            <T style={styles.hint}>L’étiquette « Damascino Privilèges » est collée sur la caisse.</T>
            <T style={styles.link} accessibilityRole="link" onPress={() => router.push('/espace/qr')}>
              Le caissier scanne mon QR code
            </T>
          </>
        )}
      </View>
      <MotifBand opacity={0.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: 16, gap: 12 },
  body: { flex: 1, justifyContent: 'center', gap: 16, width: '100%', maxWidth: 420, alignSelf: 'center' },
  link: { color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline', textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  camera: { width: '100%', aspectRatio: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.navy800 },
  frame: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 20 },
  result: { borderRadius: radius.xl, padding: 24, gap: 10, alignItems: 'center' },
  badge: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 },
  badgeText: { fontFamily: fonts.display, fontSize: 44, color: colors.successInk },
  icon: { fontSize: 48, color: colors.white },
  title: { fontSize: 30, color: colors.white, fontFamily: fonts.bold, textAlign: 'center' },
  text: { color: colors.white, fontSize: 17, textAlign: 'center' },
  strong: { fontFamily: fonts.bold },
  box: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: 14, gap: 2, alignItems: 'center' },
  clock: { color: colors.white, fontSize: 28, fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] },
});
