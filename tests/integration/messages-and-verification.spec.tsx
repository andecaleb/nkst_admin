import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerificationQueuePage from '@/app/(admin)/verification/page';
import MessagesPage from '@/app/(admin)/messages/page';
import { ToastProvider } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import type { DirectMessageRecord } from '@/types/api';

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Integration: Delegated Verification & Flagged Messages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows a Catechism Leader with members.verify to access Verification Queue and unverify a member', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      isHqAdmin: false,
      isPlatformAdmin: false,
      can: (k: string) => k === 'members.verify',
      administeredChurchIds: ['church-ikorodu'],
      scopedChurchId: 'church-ikorodu',
    });

    vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: {} });

    render(
      <ToastProvider>
        <VerificationQueuePage />
      </ToastProvider>,
    );

    expect(await screen.findByText('Verification Queue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /unverify member/i }));

    const memberUuid = '550e8400-e29b-41d4-a716-446655440000';
    await user.type(screen.getByPlaceholderText(/550e8400/i), memberUuid);
    await user.click(screen.getAllByRole('button', { name: /unverify member/i })[1]);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        `/verification/members/${memberUuid}/unverify`,
        { decisionNote: undefined },
      );
    });
  });

  it('renders flagged messages with crimson badges and matchedKeywords in Approval Queue', async () => {
    mockUseAuth.mockReturnValue({
      isPlatformAdmin: false,
      isChurchAdmin: true,
      administeredChurchIds: ['church-ikorodu'],
      scopedChurchId: 'church-ikorodu',
    });

    const flaggedMsg: DirectMessageRecord = {
      id: 'msg-1',
      senderId: 's1',
      recipientId: 'r1',
      churchId: 'church-ikorodu',
      subject: 'Urgent help',
      body: 'Please send a wire transfer today',
      status: 'pending_approval',
      isFlagged: true,
      matchedKeywords: ['wire transfer'],
      createdAt: '2026-11-26T05:00:00Z',
    };

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/messages/approval-queue') {
        return { data: [flaggedMsg], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } };
      }
      return { data: [] };
    });

    render(
      <ToastProvider>
        <MessagesPage />
      </ToastProvider>,
    );

    expect(await screen.findByText('Urgent help')).toBeInTheDocument();
    expect(screen.getByText('Flagged')).toBeInTheDocument();
    expect(screen.getByText('wire transfer')).toBeInTheDocument();
  });
});
