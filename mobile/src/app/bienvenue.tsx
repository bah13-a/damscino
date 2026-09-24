import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Logo, MotifBand, T } from '@/components/ui';
import { SERVER_CHANGE_ALLOWED, server } from '@/lib/config';
import { colors } from '@/lib/theme';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero}>
        <Logo size="lg" />
        <T style={styles.tagline}>Votre avantage Damascino, avec un QR code personnel renouvelé toutes les 30 secondes.</T>
        <MotifBand opacity={0.3} />
      </View>
      <View style={styles.actions}>
        <Button title="Je suis bénéficiaire" variant="light" large onPress={() => router.push({ pathname: '/connexion', params: { espace: 'beneficiary' } })} />
        <Button title="Personnel Damascino" variant="ghost" large onPress={() => router.push({ pathname: '/connexion', params: { espace: 'staff' } })} />
        {SERVER_CHANGE_ALLOWED && (
          <T variant="small" style={styles.server} onPress={() => router.push('/serveur')} accessibilityRole="link">
            Serveur : {server() || 'non configuré'} · Modifier
          </T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 24, marginTop: 40 },
  tagline: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 16, lineHeight: 24, maxWidth: 320 },
  actions: { gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' },
  server: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, textDecorationLine: 'underline' },
});
