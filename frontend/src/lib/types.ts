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
  validationCode: string | null;
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
  email: string | null;
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
  channel: 'SCANNER' | 'POS' | 'COUNTER';
  posTerminal: string | null;
  ticketId: string | null;
  dishLabel: string | null;
  validationCode: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
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

export interface PosTerminal {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  counterCode: string;
}

export interface PosTerminalWithKey {
  terminal: PosTerminal;
  apiKey: string;
}

export interface PosProduct {
  sku: string;
  label: string | null;
  category: string;
  updatedAt: string;
}

export type ApplyMode = 'LINE_PERCENT' | 'TICKET_AMOUNT';

export interface TillSettings {
  discountLabel: string;
  applyMode: ApplyMode;
  priceRequired: boolean;
  updatedAt: string;
}

export interface ColumnMapping {
  dateTime: number | null;
  date: number | null;
  time: number | null;
  ticket: number | null;
  amount: number | null;
  label: number | null;
  code: number | null;
  cashier: number | null;
}

export interface SalesInspection {
  headers: string[];
  sample: string[][];
  rowCount: number;
  guessedMapping: ColumnMapping;
}

export interface ReconSale {
  line: number;
  dateTime: string;
  ticket: string | null;
  amount: number;
  label: string | null;
  code: string | null;
  cashier: string | null;
}

export interface ReconPassage {
  id: string;
  dateTime: string;
  beneficiaryName: string;
  partnerName: string;
  staffName: string;
  dishPrice: number | null;
  discountAmount: number | null;
  validationCode: string | null;
  ticketId: string | null;
  channel: string;
}

export interface ReconciliationReport {
  from: string;
  to: string;
  rowsRead: number;
  discountRows: number;
  passages: number;
  tillDiscountTotal: number;
  platformDiscountTotal: number;
  amountGaps: number;
  matched: { sale: ReconSale; passage: ReconPassage; matchedBy: 'CODE' | 'TICKET' | 'TIME_AND_AMOUNT'; amountGap: number | null }[];
  discountsWithoutPassage: ReconSale[];
  passagesWithoutDiscount: ReconPassage[];
  rejectedRows: { line: number; reason: string }[];
}

export interface MailSettings {
  source: 'ADMIN' | 'SERVER' | 'NONE';
  host: string;
  port: number;
  username: string;
  fromAddress: string;
  passwordSet: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}
