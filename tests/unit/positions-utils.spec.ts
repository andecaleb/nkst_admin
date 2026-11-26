import { describe, it, expect } from 'vitest';
import {
  filterEligibleAssignees,
  formatBranchCapacityLabel,
  formatFullCapacityCaption,
  maxSeatsFromMode,
  seatModeFromMaxSeats,
} from '@/lib/positions-utils';
import type { BranchPositionHolder, MemberProfile } from '@/types/api';

describe('positions-utils', () => {
  it('maps maxSeats to seat capacity modes accurately', () => {
    expect(seatModeFromMaxSeats(1)).toBe('single');
    expect(seatModeFromMaxSeats(5)).toBe('limited');
    expect(seatModeFromMaxSeats(null)).toBe('unlimited');
    expect(seatModeFromMaxSeats(undefined)).toBe('unlimited');
  });

  it('maps seat capacity modes back to API maxSeats payload values', () => {
    expect(maxSeatsFromMode('single', 5)).toBe(1);
    expect(maxSeatsFromMode('limited', 4)).toBe(4);
    expect(maxSeatsFromMode('limited', 0)).toBe(1);
    expect(maxSeatsFromMode('unlimited', 10)).toBeNull();
  });

  it('formats branch capacity badges and full captions', () => {
    expect(formatBranchCapacityLabel(2, null)).toBe('2 / Unlimited');
    expect(formatBranchCapacityLabel(1, 1)).toBe('1 / 1 filled');
    expect(formatFullCapacityCaption(1, 1)).toBe(
      'All seats filled (1/1). Remove a current holder before assigning another member.',
    );
  });

  it('excludes existing holders from eligible assignee candidates', () => {
    const members = [
      { id: 'm1', fullName: 'Aondowase Orngu' },
      { id: 'm2', fullName: 'Dooshima Tarkaa' },
      { id: 'm3', fullName: 'Terfa Tarka' },
    ] as MemberProfile[];

    const holders: BranchPositionHolder[] = [
      {
        assignmentId: 'a1',
        memberId: 'm2',
        fullName: 'Dooshima Tarkaa',
        startedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const eligible = filterEligibleAssignees(members, holders);
    expect(eligible.map((m) => m.id)).toEqual(['m1', 'm3']);
  });
});
