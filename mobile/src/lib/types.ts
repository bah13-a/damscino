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
