import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Logo, MotifBand, T } from './ui';

export function AuthHeader({ title, subtitle, back = true }: { title: string; subtitle?: string; back?: boolean }) {
  return (
    <View style={styles.header}>
      {back && (
        <T style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/bienvenue'))} accessibilityRole="link">
          ← Retour
        </T>
      )}
      <View style={styles.logo}>
        <Logo size="lg" />
        <MotifBand opacity={0.3} tiles={5} />
      </View>
      <T variant="display" style={styles.title} accessibilityRole="header">
        {title}
      </T>
      {subtitle ? <T style={styles.subtitle}>{subtitle}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  back: { color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  logo: { alignItems: 'center', gap: 16, marginVertical: 16 },
  title: { color: '#FFFFFF', fontSize: 24, marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.75)', lineHeight: 21 },
});
