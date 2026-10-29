export type Role = 'ADMIN' | 'STAFF' | 'BENEFICIARY';
export type UsagePeriod = 'DAY' | 'WEEK' | 'MONTH';

/** The two spaces of the app; the administration stays on the web. */
export type Space = 'beneficiary' | 'staff';

export const SPACE_ROLE: Record<Space, Role> = { beneficiary: 'BENEFICIARY', staff: 'STAFF' };

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountId: string;
  role: Role;
  displayName: string;
  mustChangePassword: boolean;
}

export interface Passage {
  id: string;
  validatedAt: string;
  discountPercent: number;
  dishPrice: number | null;
  discountAmount: number | null;
}

export type Availability = 'AVAILABLE' | 'USED' | 'CONVENTION_NOT_STARTED' | 'CONVENTION_EXPIRED' | 'INACTIVE' | 'PENDING';

/** What happened to the QR code at the till today, shown live on the customer's phone. */
export interface LastScan {
  status: 'VALID' | 'CONFIRMED' | 'REFUSED';
  reason: string | null;
  message: string;
  staffName: string | null;
  discountPercent: number | null;
  dishPrice: number | null;
  discountAmount: number | null;
  scannedAt: string;
}

export interface Dashboard {
  fullName: string;
  partnerName: string | null;
  discountPercent: number | null;
  eligibleCategories: string[];
  excludedCategories: string[];
  usagesPerPeriod: number;
  usagePeriod: UsagePeriod | null;
  usedInPeriod: number;
  availability: Availability;
  availabilityMessage: string;
  nextAvailableOn: string | null;
  conventionEnd: string | null;
  history: Passage[];
  lastScan: LastScan | null;
}

export interface QrCode {
  token: string;
  expiresAt: string;
  refreshInSeconds: number;
  serverTime: string;
}

export interface ScanResult {
  status: 'VALID' | 'CONFIRMED' | 'REFUSED';
  reason: string | null;
  message: string;
  beneficiaryName: string | null;
  partnerName: string | null;
  discountPercent: number | null;
  eligibleCategories: string[] | null;
  excludedCategories: string[] | null;
  remainingInPeriod: number | null;
  redemptionId: string | null;
  dishPrice: number | null;
  discountAmount: number | null;
  validatedAt: string | null;
  validationCode: string | null;
}

export type ApplyMode = 'LINE_PERCENT' | 'TICKET_AMOUNT';

export interface TillSettings {
  discountLabel: string;
  applyMode: ApplyMode;
  priceRequired: boolean;
}

/** Result of the scan of the QR code stuck on the counter (screen the customer shows to the cashier). */
export interface CounterResult {
  status: 'CONFIRMED' | 'REFUSED';
  reason: string | null;
  message: string;
  tillName: string | null;
  beneficiaryName: string | null;
  partnerName: string | null;
  discountName: string;
  discountPercent: number | null;
  validatedAt: string;
  validationCode: string | null;
}
