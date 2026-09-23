export type Role = 'ADMIN' | 'STAFF' | 'BENEFICIARY';
export type UsagePeriod = 'DAY' | 'WEEK' | 'MONTH';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountId: string;
  role: Role;
  displayName: string;
  mustChangePassword: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
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
}

export interface Partner {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  active: boolean;
  conventionStart: string;
  conventionEnd: string;
  conventionRunning: boolean;
  discountPercent: number;
  eligibleCategories: string[];
  excludedCategories: string[];
  usagesPerPeriod: number;
  usagePeriod: UsagePeriod;
  beneficiaryCount: number;
  activatedCount: number;
}

export interface Beneficiary {
  id: string;
  partnerId: string;
  partnerName: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  active: boolean;
  accountActivated: boolean;
  credentialsIssuedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface IssuedCredentials {
  beneficiaryId: string;
  firstName: string;
  lastName: string;
  phone: string;
  temporaryPassword: string;
}

export interface ImportReport {
  totalRows: number;
  created: IssuedCredentials[];
  skipped: { line: number; lastName: string; firstName: string; phone: string; reason: string }[];
}

export interface Category {
  code: string;
  label: string;
}

export interface Account {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UsageRow {
  id: string;
  validatedAt: string;
  beneficiaryId: string;
  beneficiaryName: string;
  partnerId: string;
  partnerName: string;
  staffName: string;
  dishPrice: number | null;
  discountPercent: number;
  discountAmount: number | null;
}

export interface RejectionRow {
  id: string;
  occurredAt: string;
  beneficiaryName: string | null;
  partnerName: string | null;
  staffName: string | null;
  reason: string;
  stage: string;
}

export interface AuditRow {
  id: string;
  occurredAt: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  source: string | null;
}

export interface Statistics {
  totals: {
    authorized: number;
    activated: number;
    activeUsers: number;
    redemptions: number;
    refusals: number;
    dishTotal: number;
    discountTotal: number;
  };
  byPartner: {
    partnerId: string;
    partnerName: string;
    active: boolean;
    authorized: number;
    activated: number;
    activeUsers: number;
    redemptions: number;
    discountTotal: number;
  }[];
  byDay: { day: string; redemptions: number; activeUsers: number; discountTotal: number }[];
}
