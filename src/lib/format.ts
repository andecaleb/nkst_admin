export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNgn(amount?: number | string | null): string {
  if (amount === undefined || amount === null || amount === '') return 'Free';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatEnumLabel(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatWaitingTime(acceptedAt?: string | null, fallbackHours?: number): string {
  if (typeof fallbackHours === 'number' && !Number.isNaN(fallbackHours)) {
    if (fallbackHours < 24) return `${Math.round(fallbackHours)}h`;
    const days = Math.floor(fallbackHours / 24);
    const rem = Math.round(fallbackHours % 24);
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
  }
  if (!acceptedAt) return '—';
  const diffMs = Date.now() - new Date(acceptedAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}
