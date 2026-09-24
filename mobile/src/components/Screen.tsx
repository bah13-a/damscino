import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

/** Page with a navy header (logo, greeting…) and scrollable content overlapping it, as on the web. */
export function Screen({
  header,
  children,
  overlap = 40,
  refreshing,
  onRefresh,
  background = colors.canvas,
}: {
  header: ReactNode;
  children: ReactNode;
  overlap?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  background?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.white} /> : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16, paddingBottom: overlap + 24 }]}>{header}</View>
        <View style={[styles.content, { marginTop: -overlap }]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.navy, paddingHorizontal: 20 },
  content: { paddingHorizontal: 16, gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
});
