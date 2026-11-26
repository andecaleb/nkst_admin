import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HqPositionsPage from '@/app/(admin)/hq/positions/page';
import BranchPositionsPage from '@/app/(admin)/branch/positions/page';
import BranchPermissionsPage from '@/app/(admin)/branch/permissions/page';
import MembersRbacPage from '@/app/(admin)/members/page';
import { ToastProvider } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import type { BranchPositionRecord, MemberProfile, PermissionCatalogItem } from '@/types/api';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Security: RBAC Isolation, Least Privilege & Branch Payload Guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks Church Admin and branch.super_admin from /hq/positions with zero HQ API calls', async () => {
    const getSpy = vi.spyOn(api, 'get');
    mockUseAuth.mockReturnValue({
      isHqAdmin: false,
      isPlatformAdmin: false,
      isChurchAdmin: true,
      can: () => true, // even with branch.super_admin
    });

    render(
      <ToastProvider>
        <HqPositionsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText(/403 Forbidden — HQ Platform Admin Only/i)).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('blocks a user with ONLY positions.assign from accessing /branch/permissions', async () => {
    const getSpy = vi.spyOn(api, 'get');
    mockUseAuth.mockReturnValue({
      isHqAdmin: false,
      can: (k: string) => k === 'positions.assign',
      member: { church: { name: 'NKST Church Ikorodu' } },
      refreshPermissions: vi.fn(),
    });

    render(
      <ToastProvider>
        <BranchPermissionsPage />
      </ToastProvider>,
    );

    expect(
      await screen.findByText(/403 Forbidden — Branch Super Admin Required/i),
    ).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('blocks Catechism Leader (members.verify only) from /members directory and Edit Member', async () => {
    const getSpy = vi.spyOn(api, 'get');
    mockUseAuth.mockReturnValue({
      isHqAdmin: false,
      isPlatformAdmin: false,
      isChurchAdmin: false,
      can: (k: string) => k === 'members.verify',
      member: { id: 'cat-1', churchId: 'church-ikorodu' },
      administeredChurchIds: ['church-ikorodu'],
      scopedChurchId: 'church-ikorodu',
    });

    render(
      <ToastProvider>
        <MembersRbacPage />
      </ToastProvider>,
    );

    expect(
      await screen.findByText(/403 Forbidden — Members View Permission Required/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit member/i })).not.toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('strictly omits branchId and churchId from branch assignment and permission mutation bodies', async () => {
    const user = userEvent.setup();
    const positions: BranchPositionRecord[] = [
      {
        id: 'pos-1',
        title: 'Elders',
        description: 'Elders',
        maxSeats: null,
        seatLabel: 'Unlimited',
        filled: 0,
        remaining: null,
        isFull: false,
        permissions: [],
        holders: [],
      },
    ];
    const catalog: PermissionCatalogItem[] = [
      { key: 'members.view', label: 'View Members', description: 'View branch directory' },
    ];

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/branch/positions') return { data: positions };
      if (path === '/members') {
        return { data: [{ id: 'mem-9', fullName: 'Orngu Test' }] as MemberProfile[] };
      }
      if (path === '/branch/positions/permission-catalog') return { data: catalog };
      if (path === '/branch/positions/pos-1/permissions') {
        return { data: { churchId: 'c1', positionId: 'pos-1', positionTitle: 'Elders', permissions: [] } };
      }
      return { data: [] };
    });

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });

    mockUseAuth.mockReturnValue({
      can: () => true,
      member: { church: { name: 'NKST Church Ikorodu' } },
      refreshPermissions: vi.fn().mockResolvedValue([]),
    });

    // 1. Check POST /branch/positions/:id/assignments payload
    const { unmount } = render(
      <ToastProvider>
        <BranchPositionsPage />
      </ToastProvider>,
    );
    await user.click(await screen.findByRole('button', { name: /add member/i }));
    await user.click(await screen.findByLabelText(/Orngu Test/i));
    await user.click(screen.getByRole('button', { name: /confirm assignment/i }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const assignPayload = postSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(assignPayload).toEqual({ memberId: 'mem-9' });
    expect(assignPayload).not.toHaveProperty('branchId');
    expect(assignPayload).not.toHaveProperty('churchId');
    unmount();

    // 2. Check PUT /branch/positions/:id/permissions payload
    render(
      <ToastProvider>
        <BranchPermissionsPage />
      </ToastProvider>,
    );
    await user.click(await screen.findByLabelText(/View Members/i));
    await user.click(screen.getByRole('button', { name: /save permissions/i }));

    await waitFor(() => expect(putSpy).toHaveBeenCalled());
    const permPayload = putSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(permPayload).toEqual({ permissions: ['members.view'] });
    expect(permPayload).not.toHaveProperty('branchId');
    expect(permPayload).not.toHaveProperty('churchId');
  });

  it('immediately revokes /branch/permissions access when branch.super_admin is removed', async () => {
    mockUseAuth.mockReturnValue({
      can: () => false, // branch.super_admin revoked
      member: { church: { name: 'NKST Church Ikorodu' } },
      refreshPermissions: vi.fn(),
    });

    render(
      <ToastProvider>
        <BranchPermissionsPage />
      </ToastProvider>,
    );

    expect(
      await screen.findByText(/403 Forbidden — Branch Super Admin Required/i),
    ).toBeInTheDocument();
  });
});
