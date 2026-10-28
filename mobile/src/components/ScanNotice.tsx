import { StyleSheet, View } from 'react-native';
import { T } from '@/components/ui';
import { dt, percent, time } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { LastScan } from '@/lib/types';

const TONE = {
  VALID: { bg: colors.infoSoft, fg: colors.navy, icon: '⏳', title: 'Code scanné en caisse' },
  CONFIRMED: { bg: colors.successSoft, fg: colors.successInk, icon: '✓', title: 'Remise appliquée' },
  REFUSED: { bg: colors.dangerSoft, fg: colors.dangerInk, icon: '✕', title: 'Refusé en caisse' },
} as const;

/** Sentence describing the discount granted, e.g. "−20 % (−8 DT sur 40 DT)". */
export function discountText(scan: LastScan): string {
  const amount = scan.discountAmount !== null ? ` (−${dt(scan.discountAmount)}${scan.dishPrice !== null ? ` sur ${dt(scan.dishPrice)}` : ''})` : '';
  return `−${percent(scan.discountPercent)}${amount}`;
}

/** Result of the last scan of the customer's QR code: by the cashier's phone, a handheld scanner or the till. */
export function ScanNotice({ scan }: { scan: LastScan }) {
  const tone = TONE[scan.status];
  const by = scan.staffName ? ` par ${scan.staffName}` : '';
  return (
    <View
      style={[styles.box, { backgroundColor: tone.bg }]}
      testID="scan-notice"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <T style={[styles.title, { color: tone.fg }]}>
        {tone.icon} {tone.title}
      </T>
      <T style={{ color: tone.fg }}>
        {scan.status === 'VALID'
          ? `Avantage valide (${discountText(scan)}), le caissier finalise votre remise…`
          : scan.status === 'CONFIRMED'
            ? `${discountText(scan)} sur votre plat.`
            : scan.message}
      </T>
      <T variant="small" style={{ color: tone.fg }}>
        {time(scan.scannedAt)}
        {by}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, padding: 14, gap: 4, alignSelf: 'stretch' },
  title: { fontFamily: fonts.bold, fontSize: 17 },
});
