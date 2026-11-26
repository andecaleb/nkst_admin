import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BranchPermissionsPage from '@/app/(admin)/branch/permissions/page';
import { ToastProvider } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api-client';
import type { BranchPositionRecord, PermissionCatalogItem } from '@/types/api';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const CATALOG: PermissionCatalogItem[] = [
  {
    key: 'members.verify',
    label: 'Verify Members',
    description: 'Approve, reject, direct-validate, and unverify branch members.',
  },
  {
    key: 'branch.super_admin',
    label: 'Branch Super Admin',
    description: 'Full control of this branch.',
    warning: "Holders get full control of this church's settings and members.",
  },
];

const POSITIONS: BranchPositionRecord[] = [
  {
    id: 'pos-sp',
    title: 'Senior Pastor',
    description: 'Congregation head pastor',
    maxSeats: 1,
    seatLabel: '1',
    filled: 1,
    remaining: 0,
    isFull: true,
    permissions: [],
    holders: [],
  },
];

describe('Integration: Per-Position Permissions Checklist UI', () => {
  const refreshPermissions = vi.fn().mockResolvedValue(['branch.super_admin']);

  beforeEach(() => {
    refreshPermissions.mockClear();
    mockUseAuth.mockReturnValue({
      can: (k: string) => k === 'branch.super_admin',
      member: { church: { name: 'NKST Church Ikorodu' } },
      refreshPermissions,
    });
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/branch/positions/permission-catalog') return { data: CATALOG };
      if (path === '/branch/positions') return { data: POSITIONS };
      if (path === '/branch/positions/pos-sp/permissions') {
        return {
          data: {
            churchId: 'church-1',
            positionId: 'pos-sp',
            positionTitle: 'Senior Pastor',
            permissions: ['members.verify'],
          },
        };
      }
      return { data: [] };
    });
  });

  it('renders catalog dynamically, shows branch.super_admin warning, saves via PUT, and refreshes my-permissions', async () => {
    const user = userEvent.setup();
    const putSpy = vi.spyOn(api, 'put').mockResolvedValueOnce({ data: {} });

    render(
      <ToastProvider>
        <BranchPermissionsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText('Verify Members')).toBeInTheDocument();
    expect(screen.getByText('Branch Super Admin')).toBeInTheDocument();

    const superAdminCheckbox = screen.getByLabelText(/Branch Super Admin/i);
    await user.click(superAdminCheckbox);

    // Warning callout appears when checked
    expect(
      screen.getByText("Holders get full control of this church's settings and members."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save permissions/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/branch/positions/pos-sp/permissions', {
        permissions: ['members.verify', 'branch.super_admin'],
      });
      expect(refreshPermissions).toHaveBeenCalledTimes(1);
    });
  });

  it('displays inline 400 error if backend blocks revoking last branch.super_admin', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'put').mockRejectedValueOnce(
      new ApiError(400, 'Cannot revoke branch.super_admin: church must retain at least one admin.'),
    );

    render(
      <ToastProvider>
        <BranchPermissionsPage />
      </ToastProvider>,
    );

    await screen.findByText('Verify Members');
    await user.click(screen.getByRole('button', { name: /save permissions/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot revoke branch.super_admin: church must retain at least one admin.',
    );
  });
});
