import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Button, Field, Logo, Spinner, T } from '@/components/ui';
import { api, errorMessage, logout } from '@/lib/api';
import { categoryLabel, dt, percent } from '@/lib/format';
import { storage } from '@/lib/storage';
import { colors, fonts, radius } from '@/lib/theme';
import type { ScanResult, TillSettings } from '@/lib/types';
import { homeOf, useSession } from '@/lib/useSession';

const IDLE_MINUTES = Number(process.env.EXPO_PUBLIC_STAFF_IDLE_MINUTES ?? 5);

const MODE_KEY = 'damascino.scanner-mode';
/** Complete signed code (DP1.<payload>.<43-character signature>): a handheld scanner without Enter suffix is done. */
const FULL_TOKEN = /^DP1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

type Mode = 'camera' | 'handheld';

type Step = { kind: 'scan' } | { kind: 'checking' } | { kind: 'result'; token: string; result: ScanResult };

/** What the cashier must now enter in the "Remise" menu of the till. */
function TillInstructions({ result, settings }: { result: ScanResult; settings: TillSettings | null }) {
  const label = settings?.discountLabel ?? 'Damascino Privilèges';
  const amountKnown = result.discountAmount !== null;
  return (
    <View style={styles.instructions} testID="till-instructions">
      <T variant="small" style={{ fontFamily: fonts.semibold, letterSpacing: 1 }}>
        À SAISIR MAINTENANT DANS LA CAISSE
      </T>
      <T>
        1. Rubrique <T style={styles.strong}>Remise</T> → <T style={styles.strong}>« {label} »</T>
      </T>
      {settings?.applyMode === 'TICKET_AMOUNT' ? (
        <T>
          2. Remise en montant sur le ticket :{' '}
          <T style={styles.strong}>{amountKnown ? `−${dt(result.discountAmount)}` : `${percent(result.discountPercent)} du prix du plat`}</T>
        </T>
      ) : (
        <T>
          2. <T style={styles.strong}>{percent(result.discountPercent)}</T> sur la ligne du plat
          {result.dishPrice !== null ? ` à ${dt(result.dishPrice)}` : ''}
          {amountKnown ? (
            <>
              {' '}(soit <T style={styles.strong}>−{dt(result.discountAmount)}</T>)
            </>
          ) : null}
        </T>
      )}
      {result.validationCode ? (
        <T>
          3. Commentaire du ticket : <T style={[styles.strong, styles.code]}>{result.validationCode}</T>
        </T>
      ) : null}
    </View>
  );
}

function Camera({ onScan }: { onScan: (token: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const locked = useRef(false);

  if (!permission) return <Spinner />;
  if (!permission.granted) {
    return (
      <View style={[styles.camera, styles.cameraPlaceholder]}>
        <T style={{ color: colors.white, textAlign: 'center' }}>L’application a besoin de la caméra pour scanner les QR codes.</T>
        <Button title="Autoriser la caméra" variant="light" onPress={requestPermission} />
      </View>
    );
  }
  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (locked.current || !data) return;
          locked.current = true;
          onScan(data);
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
    </View>
  );
}

/**
 * Handheld QR scanner ("douchette", USB or Bluetooth) paired with the cashier's phone or tablet: it types the code like
 * a keyboard, usually followed by Enter. The field keeps the focus so every scan lands here, without the on-screen
 * keyboard.
 */
function HandheldInput({ onScan, keepFocus, compact = false }: { onScan: (token: string) => void; keepFocus: boolean; compact?: boolean }) {
  const input = useRef<TextInput>(null);
  const [value, setValue] = useState('');

  const submit = (text: string) => {
    const code = text.trim();
    setValue('');
    if (code) onScan(code);
  };

  useEffect(() => {
    if (!keepFocus) return;
    input.current?.focus();
    const timer = setInterval(() => {
      if (!input.current?.isFocused()) input.current?.focus();
    }, 1000);
    return () => clearInterval(timer);
  }, [keepFocus]);

  return (
    <Pressable onPress={() => input.current?.focus()} style={compact ? styles.handheldCompact : styles.handheld}>
      {!compact && (
        <>
          <T style={{ fontSize: 40, textAlign: 'center' }}>▥</T>
          <T variant="title" style={{ textAlign: 'center' }}>
            Prêt : scannez le QR code avec la douchette
          </T>
          <T variant="muted" style={{ textAlign: 'center' }}>
            Le résultat s’affiche ici et sur le téléphone du client.
          </T>
        </>
      )}
      <TextInput
        ref={input}
        testID="handheld-input"
        accessibilityLabel="Code lu par la douchette"
        value={value}
        onChangeText={(text) => (FULL_TOKEN.test(text.trim()) ? submit(text) : setValue(text))}
        onSubmitEditing={() => submit(value)}
        submitBehavior="submit"
        showSoftInputOnFocus={false}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        placeholder={compact ? 'Douchette prête pour le client suivant' : 'En attente du scan…'}
        placeholderTextColor="#9AA3B2"
        style={styles.handheldField}
      />
    </Pressable>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <View style={styles.modes} accessibilityRole="tablist">
      {(
        [
          ['camera', 'Caméra du téléphone'],
          ['handheld', 'Douchette'],
        ] as const
      ).map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          aria-selected={mode === value}
          onPress={() => onChange(value)}
          style={[styles.mode, mode === value && styles.modeActive]}
        >
          <T style={{ fontFamily: fonts.semibold, color: mode === value ? colors.white : colors.navy }}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [price, setPrice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [settings, setSettings] = useState<TillSettings | null>(null);
  const [mode, setMode] = useState<Mode>('camera');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    await logout();
    router.replace({ pathname: '/connexion', params: { espace: 'staff' } });
  }, []);

  // automatic sign-out of the till device after inactivity
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(signOut, IDLE_MINUTES * 60_000);
  }, [signOut]);
  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  useEffect(() => {
    api<TillSettings>('/api/privileges/settings').then(setSettings).catch(() => undefined);
    storage.get(MODE_KEY).then((saved) => saved === 'handheld' && setMode('handheld'));
  }, []);

  const chooseMode = (next: Mode) => {
    setMode(next);
    storage.set(MODE_KEY, next);
  };

  const verify = useCallback(
    async (token: string) => {
      resetIdle();
      setStep({ kind: 'checking' });
      setError(null);
      setPrice('');
      try {
        const result = await api<ScanResult>('/api/privileges/scan/verify', { method: 'POST', body: { token } });
        Vibration.vibrate(result.status === 'VALID' ? 80 : [0, 60, 60, 60]);
        setStep({ kind: 'result', token, result });
      } catch (e) {
        setError(errorMessage(e));
        setStep({ kind: 'scan' });
      }
    },
    [resetIdle],
  );

  if (!session || session.space !== 'staff' || session.mustChangePassword) return <Redirect href={homeOf(session)} />;

  const confirm = async () => {
    if (step.kind !== 'result') return;
    setConfirming(true);
    setError(null);
    try {
      const value = price.trim().replace(',', '.');
      const result = await api<ScanResult>('/api/privileges/scan/confirm', {
        method: 'POST',
        body: { token: step.token, dishPrice: value === '' ? null : Number(value) },
      });
      setStep({ kind: 'result', token: step.token, result });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  };

  const result = step.kind === 'result' ? step.result : null;
  const green = result !== null && result.status !== 'REFUSED';
  const priceValue = Number(price.replace(',', '.'));
  const preview = result?.discountPercent && price && !Number.isNaN(priceValue) ? (priceValue * result.discountPercent) / 100 : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }} onTouchStart={resetIdle} onPointerDown={resetIdle}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Logo size="sm" />
        <View style={{ alignItems: 'flex-end' }}>
          <T style={{ color: colors.white, fontFamily: fonts.semibold }}>{session.displayName}</T>
          <T style={styles.headerLink} accessibilityRole="button" onPress={signOut}>
            Déconnexion
          </T>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]} keyboardShouldPersistTaps="handled">
        {error && <Alert>{error}</Alert>}

        {step.kind === 'scan' && (
          <>
            <T variant="title" accessibilityRole="header">
              Scanner le QR code du client
            </T>
            <ModeSwitch mode={mode} onChange={chooseMode} />
            {mode === 'camera' ? <Camera onScan={verify} /> : <HandheldInput onScan={verify} keepFocus={!showManual} />}
            <T variant="muted" accessibilityRole="button" style={{ textDecorationLine: 'underline' }} onPress={() => setShowManual((v) => !v)}>
              Saisie manuelle du code
            </T>
            {showManual && (
              <View style={{ gap: 8 }}>
                <Field label="Code du QR" placeholder="DP1…" autoCapitalize="none" autoCorrect={false} value={manual} onChangeText={setManual} />
                <Button title="Vérifier" disabled={!manual.trim()} onPress={() => verify(manual.trim())} />
              </View>
            )}
          </>
        )}

        {step.kind === 'checking' && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
            <Spinner />
            <T variant="muted">Vérification…</T>
          </View>
        )}

        {result && (
          <View style={[styles.result, { backgroundColor: green ? colors.success : colors.danger }]} accessibilityRole="summary" accessibilityLiveRegion="assertive">
            <T style={styles.resultIcon}>{green ? '✓' : '✕'}</T>
            <T style={styles.resultTitle} accessibilityRole="header">
              {result.status === 'VALID' ? 'Avantage valide' : result.status === 'CONFIRMED' ? 'Passage validé' : 'Refusé'}
            </T>
            {result.status === 'REFUSED' && <T style={styles.resultText}>{result.message}</T>}
            {result.beneficiaryName && (
              <View style={styles.person}>
                <T style={styles.personName}>{result.beneficiaryName}</T>
                <T style={styles.resultText}>{result.partnerName}</T>
                {green && <T style={[styles.resultText, { fontFamily: fonts.semibold, marginTop: 6 }]}>−{percent(result.discountPercent)} sur 1 plat éligible</T>}
                {green && result.eligibleCategories && (
                  <T style={[styles.resultText, { fontSize: 13 }]}>
                    {result.eligibleCategories.map((c) => categoryLabel(c)).join(', ')}
                    {result.excludedCategories?.length ? ` · hors ${result.excludedCategories.map((c) => categoryLabel(c)).join(', ')}` : ''}
                  </T>
                )}
              </View>
            )}

            {result.status === 'VALID' && (
              <View style={styles.confirmBox}>
                <Field
                  label={settings?.priceRequired ? 'Prix du plat remisé (DT)' : 'Prix du plat remisé (DT) — recommandé'}
                  keyboardType="decimal-pad"
                  placeholder="ex. 40"
                  value={price}
                  onChangeText={setPrice}
                  hint={
                    preview !== null
                      ? `Remise : ${dt(Math.round(preview * 1000) / 1000)}`
                      : settings?.priceRequired
                        ? 'Obligatoire : sert au rapprochement avec la caisse'
                        : 'Facultatif : sert à chiffrer les remises accordées'
                  }
                />
                <Button
                  title="Confirmer le passage"
                  large
                  loading={confirming}
                  disabled={Boolean(settings?.priceRequired) && (price.trim() === '' || Number.isNaN(priceValue))}
                  onPress={confirm}
                />
              </View>
            )}

            {result.status === 'CONFIRMED' && result.discountAmount !== null && (
              <T style={styles.resultText}>
                Remise accordée : <T style={[styles.resultText, { fontFamily: fonts.bold }]}>{dt(result.discountAmount)}</T> sur {dt(result.dishPrice)}
              </T>
            )}
            {result.status === 'CONFIRMED' && <TillInstructions result={result} settings={settings} />}

            {mode === 'handheld' && result.status !== 'VALID' && <HandheldInput onScan={verify} keepFocus compact />}
            <Button
              title={result.status === 'VALID' ? 'Annuler' : 'Scanner un autre client'}
              variant="ghost"
              large
              onPress={() => setStep({ kind: 'scan' })}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLink: { color: 'rgba(255,255,255,0.7)', textDecorationLine: 'underline' },
  content: { flexGrow: 1, padding: 16, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  camera: { width: '100%', aspectRatio: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.navy800 },
  cameraPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  frame: { position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 20 },
  result: { borderRadius: radius.xl, padding: 20, gap: 10 },
  resultIcon: { fontSize: 44, color: colors.white },
  resultTitle: { fontSize: 26, color: colors.white, fontFamily: fonts.bold },
  resultText: { color: colors.white, fontSize: 16 },
  person: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: 16 },
  personName: { color: colors.white, fontSize: 22, fontFamily: fonts.bold },
  confirmBox: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, gap: 12 },
  instructions: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, gap: 6 },
  strong: { fontFamily: fonts.bold, color: colors.ink },
  code: { fontSize: 18, letterSpacing: 3 },
  modes: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.lg, padding: 4, gap: 4 },
  mode: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  modeActive: { backgroundColor: colors.navy },
  handheld: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 24, gap: 10, borderWidth: 2, borderColor: colors.navy, borderStyle: 'dashed' },
  handheldCompact: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 8 },
  handheldField: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink },
});
