import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius } from '@/lib/theme';

export function T({ style, variant = 'body', ...props }: TextProps & { variant?: 'body' | 'muted' | 'small' | 'title' | 'display' | 'label' }) {
  return <Text {...props} style={[styles.text, textVariants[variant], style]} />;
}

export function Logo({ light = true, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const width = { sm: 110, md: 150, lg: 210 }[size];
  return (
    <View style={styles.logoRow} accessibilityRole="image" accessibilityLabel="Damascino Privilèges">
      <Image
        source={light ? require('../../assets/brand/logo-white.png') : require('../../assets/brand/logo-navy.png')}
        style={{ width, height: (width * 208) / 582 }}
        resizeMode="contain"
      />
      <View style={[styles.logoLabel, { borderLeftColor: light ? 'rgba(255,255,255,0.3)' : colors.line }]}>
        <Text style={[styles.logoText, { color: light ? colors.sand : colors.sand500, fontSize: size === 'lg' ? 13 : 11 }]}>PRIVILÈGES</Text>
      </View>
    </View>
  );
}

/** Chevron band of the charter, repeated horizontally. */
export function MotifBand({ color = colors.white, opacity = 0.3, tiles = 8 }: { color?: string; opacity?: number; tiles?: number }) {
  return (
    <View style={[styles.motif, { opacity }]} accessible={false}>
      {Array.from({ length: tiles }, (_, i) => (
        <Svg key={i} width={40} height={12.5} viewBox="0 0 64 20">
          <Path d="M0 1.1 H64" stroke={color} strokeWidth={2.2} fill="none" />
          <Path d="M1 1.1 L32 18.5 L63 1.1" stroke={color} strokeWidth={2.2} fill="none" />
          <Path d="M11 1.1 L32 12.9 L53 1.1" stroke={color} strokeWidth={2.2} fill="none" />
          <Path d="M21 1.1 L32 7.3 L43 1.1" stroke={color} strokeWidth={2.2} fill="none" />
        </Svg>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'light' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  large = false,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        buttonVariants[variant],
        large && styles.buttonLarge,
        pressed && !inactive && { opacity: 0.85 },
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.navy} />
      ) : (
        <Text style={[styles.buttonText, { color: buttonText[variant] }, large && { fontSize: 17 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <T variant="label">{label}</T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9AA3B2"
        {...props}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
      />
      {error ? (
        <T variant="small" style={{ color: colors.danger }}>
          {error}
        </T>
      ) : hint ? (
        <T variant="small">{hint}</T>
      ) : null}
    </View>
  );
}

const ALERT_TONES = {
  danger: { bg: colors.dangerSoft, fg: colors.dangerInk },
  success: { bg: colors.successSoft, fg: colors.successInk },
  info: { bg: colors.infoSoft, fg: colors.navy },
  warning: { bg: colors.warningSoft, fg: colors.warningInk },
};

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: keyof typeof ALERT_TONES }) {
  const { bg, fg } = ALERT_TONES[tone];
  return (
    <View style={[styles.alert, { backgroundColor: bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: fg, fontSize: 14 }]}>{children}</Text>
    </View>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const palette = {
    success: ALERT_TONES.success,
    warning: ALERT_TONES.warning,
    danger: ALERT_TONES.danger,
    neutral: { bg: colors.navy50, fg: colors.navy },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

export function Spinner({ color = colors.navy }: { color?: string }) {
  return <ActivityIndicator size="large" color={color} accessibilityLabel="Chargement" />;
}

const textVariants = StyleSheet.create({
  body: { fontSize: 15, color: colors.ink },
  muted: { fontSize: 14, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
  label: { fontSize: 14, color: colors.ink, fontFamily: fonts.medium },
  title: { fontSize: 20, color: colors.ink, fontFamily: fonts.display },
  display: { fontSize: 28, color: colors.ink, fontFamily: fonts.display },
});

const buttonVariants = StyleSheet.create({
  primary: { backgroundColor: colors.navy },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  light: { backgroundColor: colors.white },
  ghost: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
});

const buttonText: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.ink,
  light: colors.navy,
  ghost: colors.white,
};

const styles = StyleSheet.create({
  text: { fontFamily: fonts.regular },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoLabel: { borderLeftWidth: 1, marginLeft: 12, paddingLeft: 12, paddingVertical: 4 },
  logoText: { fontFamily: fonts.displayMedium, letterSpacing: 2 },
  motif: { flexDirection: 'row', justifyContent: 'center', overflow: 'hidden' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    shadowColor: '#0E1728',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  buttonLarge: { minHeight: 56 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  field: { gap: 6 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  alert: { borderRadius: radius.md, padding: 12 },
  badge: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 13 },
});
