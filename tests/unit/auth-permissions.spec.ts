import { describe, it, expect } from 'vitest';
import { computeCanPermission, computeHasAdminAccess } from '@/lib/auth-context';
import { getVisibleNavGroups } from '@/components/layout/AdminShell';
import type { PositionPermissionKey } from '@/types/api';

describe('Auth Permissions & Role Matrix (01-auth-and-permissions-shell)', () => {
  it('can() grants only keys present in hydrated permissions[]', () => {
    const perms: PositionPermissionKey[] = ['members.verify'];
    expect(computeCanPermission(perms, 'members.verify')).toBe(true);
    expect(computeCanPermission(perms, 'members.edit')).toBe(false);
    expect(computeCanPermission(perms, 'branch.super_admin')).toBe(false);
  });

  it('allows delegated branch leader with >=1 permission into the Admin Shell', () => {
    expect(
      computeHasAdminAccess({
        isHqAdmin: false,
        roles: [],
        permissions: ['members.verify'],
      }),
    ).toBe(true);
  });

  it('blocks regular member with zero roles and zero position permissions', () => {
    expect(
      computeHasAdminAccess({
        isHqAdmin: false,
        roles: [],
        permissions: [],
      }),
    ).toBe(false);
  });

  it('exposes HQ Positions and Audit Logs ONLY to HQ Admin', () => {
    const hqNav = getVisibleNavGroups({
      isHqAdmin: true,
      isChurchAdmin: false,
      isGroupAdmin: false,
      can: () => false,
    });
    const hqLabels = hqNav.flatMap((g) => g.items.map((i) => i.label));
    expect(hqLabels).toContain('HQ Positions');
    expect(hqLabels).toContain('Audit Logs');

    const superAdminNav = getVisibleNavGroups({
      isHqAdmin: false,
      isChurchAdmin: false,
      isGroupAdmin: false,
      can: (k) =>
        ['members.view', 'members.edit', 'members.verify', 'positions.assign', 'branch.super_admin'].includes(k),
    });
    const superLabels = superAdminNav.flatMap((g) => g.items.map((i) => i.label));
    expect(superLabels).not.toContain('HQ Positions');
    expect(superLabels).not.toContain('Audit Logs');
    expect(superLabels).toContain('Branch Positions');
    expect(superLabels).toContain('Position Permissions');
  });

  it('shows only Verification Queue for a Catechism Leader with members.verify', () => {
    const nav = getVisibleNavGroups({
      isHqAdmin: false,
      isChurchAdmin: false,
      isGroupAdmin: false,
      can: (k) => k === 'members.verify',
    });
    const labels = nav.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toEqual(['Verification Queue']);
  });
});
