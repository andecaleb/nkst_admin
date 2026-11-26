import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BranchPositionsPage from '@/app/(admin)/branch/positions/page';
import { ToastProvider } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api-client';
import type { BranchPositionRecord, MemberProfile } from '@/types/api';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const BRANCH_POSITIONS: BranchPositionRecord[] = [
  {
    id: 'pos-elders',
    title: 'Elders',
    description: 'Congregation elders',
    maxSeats: null,
    seatLabel: 'Unlimited',
    filled: 2,
    remaining: null,
    isFull: false,
    permissions: ['members.view'],
    holders: [
      {
        assignmentId: 'asg-1',
        memberId: 'mem-1',
        fullName: 'Terfa Tarka',
        startedAt: '2026-01-10T00:00:00Z',
      },
    ],
  },
  {
    id: 'pos-cat',
    title: 'Catechism Leader',
    description: 'Leads catechism classes',
    maxSeats: 1,
    seatLabel: '1',
    filled: 1,
    remaining: 0,
    isFull: true,
    permissions: ['members.verify'],
    holders: [
      {
        assignmentId: 'asg-2',
        memberId: 'mem-2',
        fullName: 'Dooshima Tarkaa',
        startedAt: '2026-01-12T00:00:00Z',
      },
    ],
  },
];

const BRANCH_MEMBERS = [
  { id: 'mem-1', fullName: 'Terfa Tarka', phone: '+2348011111111' },
  { id: 'mem-3', fullName: 'Aondowase Orngu', phone: '+2348033333333' },
] as MemberProfile[];

describe('Integration: Branch Position Assignments UI', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      can: (k: string) => k === 'positions.assign',
      member: { church: { name: 'NKST Church Ikorodu' } },
    });
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/branch/positions') return { data: BRANCH_POSITIONS };
      if (path === '/members') return { data: BRANCH_MEMBERS };
      return { data: [] };
    });
  });

  it('renders capacity badges and disables Add Member when position is full', async () => {
    render(
      <ToastProvider>
        <BranchPositionsPage />
      </ToastProvider>,
    );

    expect(await screen.findByText('2 / Unlimited')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 filled')).toBeInTheDocument();
    expect(
      screen.getByText(
        'All seats filled (1/1). Remove a current holder before assigning another member.',
      ),
    ).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: /add member/i });
    expect(addButtons[0]).not.toBeDisabled(); // Elders (unlimited)
    expect(addButtons[1]).toBeDisabled(); // Catechism Leader (1/1 filled)
  });

  it('excludes existing holders from picker and sends ONLY { memberId } on assign', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({ data: {} });

    render(
      <ToastProvider>
        <BranchPositionsPage />
      </ToastProvider>,
    );

    await screen.findByText('Elders');
    const addButtons = screen.getAllByRole('button', { name: /add member/i });
    await user.click(addButtons[0]);

    // mem-1 (Terfa Tarka) is already an Elder -> excluded from modal picker
    expect(await screen.findByText('Aondowase Orngu')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Aondowase Orngu/i));
    await user.click(screen.getByRole('button', { name: /confirm assignment/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/branch/positions/pos-elders/assignments', {
        memberId: 'mem-3',
      });
    });
  });

  it('shows inline 400 last-admin protection error when removing a holder fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'delete').mockRejectedValueOnce(
      new ApiError(400, 'Cannot remove the last branch super admin for this church.'),
    );

    render(
      <ToastProvider>
        <BranchPositionsPage />
      </ToastProvider>,
    );

    await screen.findByText('Dooshima Tarkaa');
    const removeButtons = screen.getAllByRole('button', { name: /^remove$/i });
    await user.click(removeButtons[1]);
    await user.click(screen.getByRole('button', { name: /remove holder/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot remove the last branch super admin for this church.',
    );
  });
});
