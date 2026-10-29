import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { ScanNotice } from '@/components/ScanNotice';
import { Screen } from '@/components/Screen';
import { Alert, Badge, Button, Card, Logo, Spinner, T } from '@/components/ui';
import { api, errorMessage, logout } from '@/lib/api';
import { categoryLabel, dateTime, dt, longDate, PERIOD_LABEL, percent } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { Availability, Dashboard } from '@/lib/types';
import { homeOf, useSession } from '@/lib/useSession';

const AVAILABILITY_TONE: Record<Availability, 'success' | 'warning' | 'danger' | 'neutral'> = {
  AVAILABLE: 'success',
  USED: 'warning',
  CONVENTION_NOT_STARTED: 'neutral',
  CONVENTION_EXPIRED: 'danger',
  INACTIVE: 'danger',
  PENDING: 'neutral',
};

export default function BeneficiaryHome() {
  const session = useSession();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setDashboard(await api<Dashboard>('/api/privileges/me'));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // on every return to this screen and when the app comes back to the foreground
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && load());
    return () => subscription.remove();
  }, [load]);

  // a freshly imported account may take a few seconds to reach the privilege service; a code being processed at
  // the till is followed until the cashier finishes
  useEffect(() => {
    if (dashboard?.availability !== 'PENDING' && dashboard?.lastScan?.status !== 'VALID') return;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [dashboard, load]);

  if (!session || session.space !== 'beneficiary' || session.mustChangePassword) return <Redirect href={homeOf(session)} />;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      header={
        <View style={{ gap: 28 }}>
          <View style={styles.topRow}>
            <Logo size="sm" />
            <T
              style={styles.link}
              accessibilityRole="button"
              onPress={async () => {
                await logout();
                router.replace('/bienvenue');
              }}
            >
              Déconnexion
            </T>
          </View>
          <View>
            <T style={{ color: 'rgba(255,255,255,0.7)' }}>Bonjour</T>
            <T variant="display" style={{ color: colors.white }}>
              {dashboard?.fullName ?? session.displayName}
            </T>
            {dashboard?.partnerName ? <T style={{ color: colors.sand }}>{dashboard.partnerName}</T> : null}
          </View>
        </View>
      }
    >
      {error && <Alert>{error}</Alert>}
      {!dashboard && !error && (
        <Card style={{ paddingVertical: 40 }}>
          <Spinner />
        </Card>
      )}
      {dashboard && (
        <>
          <Card style={{ alignItems: 'center', gap: 6 }}>
            <Badge tone={AVAILABILITY_TONE[dashboard.availability]}>{dashboard.availabilityMessage}</Badge>
            {dashboard.discountPercent !== null && (
              <>
                <T style={styles.percent}>−{percent(dashboard.discountPercent)}</T>
                <T variant="muted" style={{ textAlign: 'center' }}>
                  sur {dashboard.usagesPerPeriod > 1 ? `${dashboard.usagesPerPeriod} plats` : 'un plat'} éligible par{' '}
                  {PERIOD_LABEL[dashboard.usagePeriod ?? 'DAY']}
                </T>
                <T variant="small" style={{ textAlign: 'center', marginTop: 6 }}>
                  Éligible : {dashboard.eligibleCategories.map((c) => categoryLabel(c)).join(', ')}
                  {dashboard.excludedCategories.length > 0 &&
                    ` · Exclus : ${dashboard.excludedCategories.map((c) => categoryLabel(c)).join(', ')}`}
                </T>
              </>
            )}
            {dashboard.availability === 'AVAILABLE' ? (
              <Button title="Utiliser mon avantage" large style={styles.cta} onPress={() => router.push('/espace/comptoir')} />
            ) : (
              <Button
                large
                disabled
                style={styles.cta}
                title={
                  dashboard.availability === 'USED' && dashboard.nextAvailableOn
                    ? `De nouveau disponible le ${longDate(dashboard.nextAvailableOn)}`
                    : 'Avantage indisponible'
                }
              />
            )}
            {dashboard.conventionEnd && dashboard.availability !== 'CONVENTION_EXPIRED' && (
              <T variant="small" style={{ marginTop: 6 }}>
                Convention valable jusqu’au {longDate(dashboard.conventionEnd)}
              </T>
            )}
          </Card>

          {dashboard.lastScan && (
            <Card style={{ gap: 8 }}>
              <T variant="title" accessibilityRole="header">
                Dernier scan en caisse
              </T>
              <ScanNotice scan={dashboard.lastScan} />
            </Card>
          )}

          <Card style={{ gap: 8 }}>
            <T variant="title" accessibilityRole="header">
              Mes passages
            </T>
            {dashboard.history.length === 0 ? (
              <T variant="muted">Aucun passage pour le moment.</T>
            ) : (
              dashboard.history.map((passage) => (
                <View key={passage.id} style={styles.passage}>
                  <T>{dateTime(passage.validatedAt)}</T>
                  <T style={{ fontFamily: fonts.semibold, color: colors.navy }}>
                    −{percent(passage.discountPercent)}
                    {passage.discountAmount !== null ? `  (${dt(passage.discountAmount)})` : ''}
                  </T>
                </View>
              ))
            )}
          </Card>

          <T variant="small" style={styles.footerLink} accessibilityRole="link" onPress={() => router.push('/mot-de-passe')}>
            Changer mon mot de passe
          </T>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  percent: { fontFamily: fonts.display, fontSize: 48, color: colors.navy, marginTop: 12 },
  cta: { alignSelf: 'stretch', marginTop: 16 },
  passage: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  footerLink: { textAlign: 'center', textDecorationLine: 'underline' },
});
