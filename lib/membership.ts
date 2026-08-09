export type MembershipStatusType =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'DEACTIVATED'
  | 'NOT_YET_ACTIVE';

export interface MembershipStatusResult {
  status: MembershipStatusType;
  label: string;
  badgeColor: string; // Tailored color or Hex
  badgeBg: string;
  diffDays: number;
  effectiveExpiryStr: string | null;
}

export function parseLocalDate(dateStr?: string | Date | null): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = parseLocalDate(date);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = parseLocalDate(date);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function calculateEffectiveExpiry(
  rawExpiryDate?: string | Date | null,
  adjustments?: Array<{ days_added?: number }> | null
): Date | null {
  const baseDate = parseLocalDate(rawExpiryDate);
  if (!baseDate) return null;

  const totalExtraDays = (adjustments ?? []).reduce((acc, adj) => acc + Number(adj?.days_added || 0), 0);
  
  const effectiveDate = new Date(baseDate);
  effectiveDate.setDate(effectiveDate.getDate() + totalExtraDays);
  return effectiveDate;
}

export function calculateMembershipStatus(
  member: {
    status?: string | null;
    start_date?: string | Date | null;
    expiry_date?: string | Date | null;
    [key: string]: any;
  },
  adjustments?: Array<{ days_added?: number }> | null
): MembershipStatusResult {
  const rawStatus = (member?.status || '').toLowerCase();
  
  if (rawStatus === 'deactivated' || rawStatus === 'inactive') {
    return {
      status: 'DEACTIVATED',
      label: 'Deactivated',
      badgeColor: 'text-red-700 dark:text-red-400',
      badgeBg: 'bg-red-50 border border-red-200 dark:bg-red-950/60 dark:border-red-800',
      diffDays: -9999,
      effectiveExpiryStr: formatDateDisplay(member?.expiry_date),
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = parseLocalDate(member?.start_date);
  if (startDate) {
    startDate.setHours(0, 0, 0, 0);
    if (today < startDate) {
      return {
        status: 'NOT_YET_ACTIVE',
        label: 'Not Yet Active',
        badgeColor: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800',
        diffDays: Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        effectiveExpiryStr: formatDateDisplay(member?.expiry_date),
      };
    }
  }

  const effectiveExpiry = calculateEffectiveExpiry(member?.expiry_date, adjustments);
  if (!effectiveExpiry) {
    return {
      status: 'NOT_YET_ACTIVE',
      label: 'Pending Setup',
      badgeColor: 'text-slate-700 dark:text-slate-400',
      badgeBg: 'bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700',
      diffDays: 0,
      effectiveExpiryStr: 'N/A',
    };
  }

  effectiveExpiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((effectiveExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const effectiveExpiryStr = formatDateDisplay(effectiveExpiry);

  if (diffDays < 0) {
    return {
      status: 'EXPIRED',
      label: 'Expired',
      badgeColor: 'text-red-700 dark:text-red-400',
      badgeBg: 'bg-red-50 border border-red-200 dark:bg-red-950/60 dark:border-red-800',
      diffDays,
      effectiveExpiryStr,
    };
  }

  if (diffDays <= 7) {
    return {
      status: 'EXPIRING_SOON',
      label: `Expiring Soon (${diffDays}d)`,
      badgeColor: 'text-amber-700 dark:text-amber-400',
      badgeBg: 'bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800',
      diffDays,
      effectiveExpiryStr,
    };
  }

  return {
    status: 'ACTIVE',
    label: 'Active',
    badgeColor: 'text-emerald-700 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800',
    diffDays,
    effectiveExpiryStr,
  };
}

export function canMemberEnter(
  member: {
    status?: string | null;
    start_date?: string | Date | null;
    expiry_date?: string | Date | null;
    [key: string]: any;
  },
  adjustments?: Array<{ days_added?: number }> | null
): boolean {
  const result = calculateMembershipStatus(member, adjustments);
  return result.status === 'ACTIVE' || result.status === 'EXPIRING_SOON';
}

export function cleanIndianPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function formatWhatsAppReminderUrl(
  member: { full_name?: string | null; phone?: string | null },
  planName?: string | null,
  effectiveExpiryStr?: string | null
): string {
  const phone = cleanIndianPhoneNumber(member?.phone);
  const name = member?.full_name || 'Member';
  const plan = planName || 'Gym Membership';
  const expiry = effectiveExpiryStr || 'soon';

  const message = `Hello ${name},\n\nYour RR Fitness membership expires on ${expiry}.\n\nCurrent plan:\n${plan}\n\nPlease contact RR Fitness for renewal.\n\nThank you,\nRR Fitness`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
