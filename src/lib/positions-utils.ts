import type { BranchPositionHolder, MemberProfile } from '@/types/api';

export type SeatCapacityMode = 'single' | 'limited' | 'unlimited';

export function seatModeFromMaxSeats(maxSeats: number | null | undefined): SeatCapacityMode {
  if (maxSeats === null || maxSeats === undefined) return 'unlimited';
  if (maxSeats === 1) return 'single';
  return 'limited';
}

export function maxSeatsFromMode(mode: SeatCapacityMode, customLimit: number): number | null {
  if (mode === 'single') return 1;
  if (mode === 'unlimited') return null;
  const parsed = Math.floor(Number(customLimit));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function formatBranchCapacityLabel(filled: number, maxSeats: number | null): string {
  if (maxSeats === null) return `${filled} / Unlimited`;
  return `${filled} / ${maxSeats} filled`;
}

export function formatFullCapacityCaption(filled: number, maxSeats: number | null): string {
  return `All seats filled (${filled}/${maxSeats}). Remove a current holder before assigning another member.`;
}

export function filterEligibleAssignees(
  members: MemberProfile[],
  holders: BranchPositionHolder[],
): MemberProfile[] {
  const holderIds = new Set(holders.map((h) => h.memberId));
  return members.filter((m) => !holderIds.has(m.id));
}
