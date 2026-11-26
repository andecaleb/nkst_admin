'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Users,
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
  ReasonModal,
  Select,
  Textarea,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime, formatEnumLabel, isValidUuid } from '@/lib/format';
import type { ChurchRecord, VerificationRequestRecord } from '@/types/api';

const REQUIRED_ACKNOWLEDGEMENTS = 10;

export default function VerificationQueuePage() {
  const { isPlatformAdmin, administeredChurchIds, scopedChurchId } = useAuth();
  const toast = useToast();

  const [requests, setRequests] = useState<VerificationRequestRecord[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState('');
  const [loading, setLoading] = useState(true);

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<VerificationRequestRecord | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<VerificationRequestRecord | null>(null);

  // Direct validate modal (Pathway C / D)
  const [directOpen, setDirectOpen] = useState(false);
  const [directMemberId, setDirectMemberId] = useState('');
  const [directNote, setDirectNote] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, churchesRes] = await Promise.all([
        api.get<VerificationRequestRecord[]>('/verification/queue', {
          churchId: isPlatformAdmin ? selectedChurchId || undefined : scopedChurchId,
        }),
        isPlatformAdmin
          ? api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 })
          : Promise.resolve({ data: [] as ChurchRecord[] }),
      ]);
      const rawRequests = Array.isArray(queueRes.data) ? queueRes.data : [];
      setRequests(
        isPlatformAdmin
          ? rawRequests
          : rawRequests.filter((r) => administeredChurchIds.includes(r.churchId)),
      );
      if (Array.isArray(churchesRes.data)) {
        setChurches(churchesRes.data);
      }
    } catch (err) {
      toast.error(
        'Failed to load verification queue',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [selectedChurchId, isPlatformAdmin, administeredChurchIds, scopedChurchId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;
    setSubmitting(true);
    try {
      await api.patch(`/verification/requests/${approveTarget.id}/approve`, {
        decisionNote: decisionNote.trim() || undefined,
        completionDate: completionDate || undefined,
      });
      toast.success(
        'Verification approved',
        'Member is now verified and any held content has been released.',
      );
      setApproveTarget(null);
      setDecisionNote('');
      setCompletionDate('');
      loadData();
    } catch (err) {
      toast.error('Approval failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await api.patch(`/verification/requests/${rejectTarget.id}/reject`, { reason });
      toast.success('Verification rejected', 'The member has been notified with your reason.');
      loadData();
    } catch (err) {
      toast.error('Rejection failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleDirectValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUuid(directMemberId)) {
      toast.warning('Invalid Member UUID', 'Please enter a valid member UUID.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/verification/direct-validate', {
        memberId: directMemberId.trim(),
        decisionNote: directNote.trim() || undefined,
      });
      toast.success(
        'Member directly validated',
        isPlatformAdmin
          ? 'Verified via Platform Validation (Pathway D).'
          : 'Verified via Church Validation (Pathway C).',
      );
      setDirectOpen(false);
      setDirectMemberId('');
      setDirectNote('');
      loadData();
    } catch (err) {
      toast.error('Direct validation failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification Queue"
        description="Review 4-pathway membership verification requests (Catechism, 10 Peer Acknowledgements, Church & Platform validation). Approving releases held content automatically."
        badge={<Badge tone="amber">{requests.length} Pending</Badge>}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={loadData} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setDirectOpen(true)}>
              <UserCheck className="h-3.5 w-3.5" />
              Direct Validate ({isPlatformAdmin ? 'Pathway D' : 'Pathway C'})
            </Button>
          </>
        }
      />

      {isPlatformAdmin && churches.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#56635a]">Filter queue by congregation:</p>
            <div className="w-full sm:w-80">
              <Select
                value={selectedChurchId}
                onChange={(e) => setSelectedChurchId(e.target.value)}
              >
                <option value="">All Congregations</option>
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.lga}, {c.state})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingRows count={4} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Verification queue is clear"
          description="There are no pending or ready-for-review membership verification requests in your scope."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const ackCount =
              req.acknowledgements?.length ?? req._count?.acknowledgements ?? 0;
            const memberName = req.member?.fullName || req.memberId;
            return (
              <Card key={req.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[#16241b]">{memberName}</h3>
                      <Badge tone={statusTone(req.status)}>{formatEnumLabel(req.status)}</Badge>
                      <Badge tone="gold">Pathway: {formatEnumLabel(req.pathway)}</Badge>
                      {req.pathway === 'acknowledgement' && (
                        <Badge tone={ackCount >= REQUIRED_ACKNOWLEDGEMENTS ? 'emerald' : 'amber'}>
                          <Users className="h-3 w-3" />
                          {ackCount} / {REQUIRED_ACKNOWLEDGEMENTS} Acknowledgements
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#56635a]">
                      <span>
                        Church: <strong className="text-[#16241b]">{req.church?.name || req.churchId}</strong>
                      </span>
                      <span>Submitted: {formatDateTime(req.createdAt)}</span>
                      {req.programme && <span>Programme: {req.programme}</span>}
                      {req.completionDate && (
                        <span>Completion: {formatDate(req.completionDate)}</span>
                      )}
                    </div>

                    {req.evidenceText && (
                      <div className="rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3 text-xs text-[#3e4c42] leading-relaxed">
                        {req.evidenceText}
                      </div>
                    )}

                    {req.evidenceFileUrl && (
                      <a
                        href={req.evidenceFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#0a542d] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View uploaded certificate / evidence file
                      </a>
                    )}

                    {req.acknowledgements && req.acknowledgements.length > 0 && (
                      <div className="pt-1">
                        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#56635a]">
                          Verified Peer Acknowledgements ({req.acknowledgements.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {req.acknowledgements.map((ack) => (
                            <span
                              key={ack.id}
                              className="rounded-md border border-[#e4dfd3] bg-[#faf7f0] px-2 py-1 text-[11px] text-[#3e4c42]"
                              title={ack.note || undefined}
                            >
                              {ack.acknowledger?.fullName || ack.acknowledgerId.slice(0, 8)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={() => {
                        setApproveTarget(req);
                        setDecisionNote('');
                        setCompletionDate(
                          req.completionDate ? req.completionDate.slice(0, 10) : '',
                        );
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRejectTarget(req)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Verification Modal */}
      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Approve Verification Request"
        description={`Confirm verification for ${approveTarget?.member?.fullName || 'this member'}. Held posts, comments, photos, and join requests will be released.`}
      >
        <form onSubmit={handleApprove} className="space-y-4">
          {approveTarget?.pathway === 'catechism' && (
            <div>
              <FieldLabel hint="Optional for catechism register">
                Catechism Completion Date
              </FieldLabel>
              <Input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            </div>
          )}
          <div>
            <FieldLabel hint="Optional">Decision Note</FieldLabel>
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="e.g. Confirmed with congregation catechism register"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" loading={submitting}>
              Approve &amp; Verify Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Verification Modal (Mandatory Reason — VER-04) */}
      <ReasonModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Verification Request"
        description={`Provide a clear reason for declining ${rejectTarget?.member?.fullName || 'this request'}. The member will see this reason and may resubmit.`}
        confirmLabel="Reject Request"
        confirmVariant="danger"
        reasonLabel="Rejection Reason"
        reasonPlaceholder="e.g. Certificate image is unreadable; please upload a clearer copy."
        onConfirm={handleReject}
      />

      {/* Direct Validate Modal (Pathway C / D) */}
      <Modal
        open={directOpen}
        onClose={() => setDirectOpen(false)}
        title={`Direct Member Validation (${isPlatformAdmin ? 'Pathway D — Platform' : 'Pathway C — Church'})`}
        description="Directly verify a known member by UUID without waiting for a submitted request."
      >
        <form onSubmit={handleDirectValidate} className="space-y-4">
          <div>
            <FieldLabel required>Member UUID</FieldLabel>
            <Input
              value={directMemberId}
              onChange={(e) => setDirectMemberId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              required
            />
          </div>
          <div>
            <FieldLabel hint="Optional">Validation Note</FieldLabel>
            <Textarea
              value={directNote}
              onChange={(e) => setDirectNote(e.target.value)}
              placeholder="Known active member of the congregation"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDirectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Validate Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
