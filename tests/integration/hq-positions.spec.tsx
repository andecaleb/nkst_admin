import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HqPositionsPage from '@/app/(admin)/hq/positions/page';
import { ToastProvider } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api-client';
import type { HqPositionRecord } from '@/types/api';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const SEEDED_POSITIONS: HqPositionRecord[] = [
  {
    id: 'pos-1',
    title: 'Senior Pastor',
    description: 'Head pastor of the local congregation',
    maxSeats: 1,
    seatLabel: '1',
    isActive: true,
    branchesUsingCount: 2,
    activeAssignmentsCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pos-2',
    title: 'Elders',
    description: 'Ordained congregation elders',
    maxSeats: null,
    seatLabel: 'Unlimited',
    isActive: true,
    branchesUsingCount: 1,
    activeAssignmentsCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('Integration: HQ Positions Catalog UI', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isHqAdmin: true });
    vi.spyOn(api, 'get').mockResolvedValue({ data: SEEDED_POSITIONS });
  });

  it('renders positions table with S/No., seatLabel, status, and delete guard', async () => {
    render(
      <ToastProvider>
        <HqPositionsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText('Senior Pastor')).toBeInTheDocument();
    expect(screen.getByText('Elders')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons[0]).toBeDisabled(); // activeAssignmentsCount = 2
    expect(deleteButtons[1]).not.toBeDisabled(); // activeAssignmentsCount = 0
  });

  it('displays inline 409 Conflict error when creating a duplicate title', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'post').mockRejectedValueOnce(
      new ApiError(409, 'Position title "Senior Pastor" already exists'),
    );

    render(
      <ToastProvider>
        <HqPositionsPage />
      </ToastProvider>,
    );

    await screen.findByText('Senior Pastor');
    await user.click(screen.getByRole('button', { name: /new position/i }));
    await user.type(screen.getByPlaceholderText(/Senior Pastor/i), 'senior pastor');
    await user.type(
      screen.getByPlaceholderText(/Describe the responsibilities/i),
      'Duplicate leadership role description',
    );
    await user.click(screen.getByRole('button', { name: /create position/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Position title "Senior Pastor" already exists',
    );
  });

  it('displays verbatim 400 seat-reduction error listing affected branches', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'patch').mockRejectedValueOnce(
      new ApiError(
        400,
        'Cannot lower maxSeats to 1: branches currently exceed this limit — NKST Church Ikorodu (2 active).',
      ),
    );

    render(
      <ToastProvider>
        <HqPositionsPage />
      </ToastProvider>,
    );

    await screen.findByText('Elders');
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editButtons[1]); // Edit Elders
    await user.click(screen.getByLabelText(/Single holder/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot lower maxSeats to 1: branches currently exceed this limit — NKST Church Ikorodu (2 active).',
    );
  });

  it('shows deactivation warning copy before calling deactivate endpoint', async () => {
    const user = userEvent.setup();
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: {} });

    render(
      <ToastProvider>
        <HqPositionsPage />
      </ToastProvider>,
    );

    await screen.findByText('Senior Pastor');
    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
    await user.click(deactivateButtons[0]);

    expect(
      screen.getByText(
        /immediately suspends permissions granted through this position across all branches/i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm deactivate/i }));
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('/hq/positions/pos-1/deactivate');
    });
  });
});
