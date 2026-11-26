import { describe, it, expect } from 'vitest';
import { normalizePhone } from '@/lib/member-import';

describe('member-import phone normalization', () => {
  it('normalizes local 080, 234, and formatted Nigerian numbers to +234 format', () => {
    expect(normalizePhone('0803 123 4567')).toBe('+2348031234567');
    expect(normalizePhone('2348031234567')).toBe('+2348031234567');
    expect(normalizePhone('+234-803-123-4567')).toBe('+2348031234567');
    expect(normalizePhone('8031234567')).toBe('+2348031234567');
  });

  it('returns empty string for blank inputs', () => {
    expect(normalizePhone('   ')).toBe('');
  });
});
