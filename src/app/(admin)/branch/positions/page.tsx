'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  UserMinus,
  RefreshCw,
  ShieldAlert,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  LoadingRows,
  Modal,
  PageHeader,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';
import {
  filterEligibleAssignees,
  formatBranchCapacityLabel,
  formatFullCapacityCaption,
} from '@/lib/positions-utils';
import type {
  BranchPositionHolder,
  BranchPositionRecord,
  MemberProfile,
} from '@/types/api';

export default function BranchPositionsPage() {
  const { can, member } = useAuth();
  const canAssign = can('positions.assign');
  const toast = useToast();

  const [positions, setPositions] = useState<BranchPositionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Picker modal
  const [assignPosition, setAssignPosition] = useState<BranchPositionRecord | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [candidates, setCandidates] = useState<MemberProfile[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Remove Holder Confirmation modal
  const [removeTarget, setRemoveTarget] = useState<{
    positionTitle: string;
    holder: BranchPositionHolder;
  } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    if (!canAssign) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<BranchPositionRecord[]>('/branch/positions');
      setPositions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(
        'Failed to load branch positions',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [canAssign, toast]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const loadCandidates = useCallback(
    async (query: string) => {
      setLoadingCandidates(true);
      try {
        const res = await api.get<MemberProfile[]>('/members', {
          search: query.trim() || undefined,
          page: 1,
          limit: 50,
        });
        setCandidates(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        toast.error(
          'Failed to search branch members',
          err instanceof ApiError ? err.message : undefined,
        );
      } finally {
        setLoadingCandidates(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (assignPosition) {
      loadCandidates(memberSearch);
    }
  }, [assignPosition, memberSearch, loadCandidates]);

  if (!canAssign) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6 text-[#b83227]" />}
        title="403 Forbidden — Permission Required"
        description="You need the positions.assign permission in your congregation to assign or remove church position holders."
      />
    );
  }

  const openAssignModal = (pos: BranchPositionRecord) => {
    setAssignPosition(pos);
    setMemberSearch('');
    setSelectedMemberId('');
    setAssignError(null);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignPosition || !selectedMemberId) return;
    setAssignError(null);
    setSubmitting(true);
    try {
      // Strict Branch Isolation: NEVER send branchId or churchId in body
      await api.post(`/branch/positions/${assignPosition.id}/assignments`, {
        memberId: selectedMemberId,
      });
      toast.success('Member assigned', `Assigned to ${assignPosition.title}.`);
      setAssignPosition(null);
      loadPositions();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to assign member.';
      setAssignError(msg);
      // On 409 Conflict (race condition / duplicate), refresh positions immediately
      if (err instanceof ApiError && err.status === 409) {
        loadPositions();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveHolder = async () => {
    if (!removeTarget) return;
    setRemoveError(null);
    setSubmitting(true);
    try {
      await api.delete(`/branch/positions/assignments/${removeTarget.holder.assignmentId}`);
      toast.success(
        'Holder removed',
        `${removeTarget.holder.fullName} was unassigned from ${removeTarget.positionTitle}.`,
      );
      setRemoveTarget(null);
      loadPositions();
    } catch (err) {
      // Display 400 Bad Request (e.g. last-admin protection) inline
      setRemoveError(err instanceof ApiError ? err.message : 'Unable to remove holder.');
    } finally {
      setSubmitting(false);
    }
  };

  const eligibleCandidates = assignPosition
    ? filterEligibleAssignees(candidates, assignPosition.holders)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Position Assignments"
        description={`Assign members of ${member?.church?.name || 'your congregation'} to active HQ-defined leadership positions.`}
        badge={<Badge tone="gold">{positions.length} Active Positions</Badge>}
        actions={
          <Button variant="secondary" size="sm" onClick={loadPositions} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <LoadingRows count={4} />
      ) : positions.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-6 w-6" />}
          title="No active HQ positions available"
          description="HQ Platform Admin must define and activate church positions before local branches can assign members."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {positions.map((pos) => (
            <Card key={pos.id} className="p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#063b20]">{pos.title}</h2>
                    <p className="mt-0.5 text-xs text-[#56635a]">{pos.description}</p>
                  </div>
                  <Badge tone={pos.isFull ? 'amber' : 'emerald'}>
                    {formatBranchCapacityLabel(pos.filled, pos.maxSeats)}
                  </Badge>
                </div>

                {/* Active permissions preview */}
                {pos.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pos.permissions.map((perm) => (
                      <Badge
                        key={perm}
                        tone={perm === 'branch.super_admin' ? 'danger' : 'gold'}
                      >
                        {perm}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Current holders list */}
                <div className="space-y-2 border-t border-[#ece7dc] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#56635a]">
                    Current Holders ({pos.holders.length})
                  </p>
                  {pos.holders.length === 0 ? (
                    <p className="text-xs italic text-[#869189]">No member currently assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {pos.holders.map((holder) => (
                        <li
                          key={holder.assignmentId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {holder.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={holder.photoUrl}
                                alt={holder.fullName}
                                className="h-8 w-8 rounded-full object-cover border border-[#e4dfd3]"
                              />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0a542d] text-xs font-semibold text-white">
                                {holder.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-[#16241b]">
                                {holder.fullName}
                              </p>
                              <p className="text-[11px] text-[#56635a]">
                                Since {formatDate(holder.startedAt)}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setRemoveError(null);
                              setRemoveTarget({ positionTitle: pos.title, holder });
                            }}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="border-t border-[#ece7dc] pt-3 space-y-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={pos.isFull}
                  title={
                    pos.isFull
                      ? formatFullCapacityCaption(pos.filled, pos.maxSeats)
                      : `Assign a member to ${pos.title}`
                  }
                  onClick={() => openAssignModal(pos)}
                  className="w-full"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </Button>
                {pos.isFull && (
                  <p className="text-[11px] text-[#a96910]">
                    {formatFullCapacityCaption(pos.filled, pos.maxSeats)}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Member Picker Modal */}
      <Modal
        open={Boolean(assignPosition)}
        onClose={() => setAssignPosition(null)}
        title={`Assign Member to ${assignPosition?.title || ''}`}
        description="Search members of your congregation. Current holders are automatically excluded."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          {assignError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#b83227]/40 bg-[#fdeceb] px-4 py-3 text-xs text-[#9c261d]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          <div>
            <FieldLabel>Search Congregation Members</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Type member name, email, or phone..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-xl border border-[#e4dfd3] bg-[#faf7f0] p-2">
            {loadingCandidates ? (
              <p className="p-3 text-center text-xs text-[#56635a]">Searching members...</p>
            ) : eligibleCandidates.length === 0 ? (
              <p className="p-3 text-center text-xs text-[#56635a]">
                No eligible members found.
              </p>
            ) : (
              eligibleCandidates.map((cand) => (
                <label
                  key={cand.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                    selectedMemberId === cand.id
                      ? 'border-[#0a542d] bg-[#eaf6ee] text-[#063b20]'
                      : 'border-transparent bg-white hover:border-[#e4dfd3]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="radio"
                      name="assignMember"
                      value={cand.id}
                      checked={selectedMemberId === cand.id}
                      onChange={() => setSelectedMemberId(cand.id)}
                      className="accent-[#0a542d]"
                    />
                    <span className="truncate font-semibold text-[#16241b]">
                      {cand.fullName}
                    </span>
                  </span>
                  <span className="text-[11px] text-[#56635a] truncate">
                    {cand.phone || cand.email}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAssignPosition(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!selectedMemberId}
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Holder Confirmation Modal */}
      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Remove Position Holder"
        description={`End ${removeTarget?.holder.fullName}'s active assignment as ${removeTarget?.positionTitle}? Historical records are preserved and permissions granted through this position are revoked immediately.`}
      >
        <div className="space-y-4">
          {removeError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#b83227]/40 bg-[#fdeceb] px-4 py-3 text-xs text-[#9c261d]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{removeError}</span>
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={submitting} onClick={handleRemoveHolder}>
              Remove Holder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
