'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Flag,
  CheckCircle2,
  EyeOff,
  Trash2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingRows,
  PageHeader,
  ReasonModal,
  Select,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatEnumLabel } from '@/lib/format';
import type { ReportRecord, ReportStatus } from '@/types/api';

export default function ReportsQueuePage() {
  const toast = useToast();

  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('open');
  const [loading, setLoading] = useState(true);

  const [actionModal, setActionModal] = useState<{
    report: ReportRecord;
    decision: 'dismiss' | 'hide' | 'remove';
  } | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ReportRecord[]>('/posts/reports/queue', {
        status: statusFilter || undefined,
      });
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(
        'Failed to load content reports',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleDecision = async (note: string) => {
    if (!actionModal) return;
    try {
      await api.patch(`/posts/reports/${actionModal.report.id}`, {
        decision: actionModal.decision,
        resolutionNote: note || undefined,
      });
      toast.success(
        `Report ${actionModal.decision === 'dismiss' ? 'dismissed' : 'actioned'}`,
        `Decision "${actionModal.decision}" has been recorded.`,
      );
      loadReports();
    } catch (err) {
      toast.error('Failed to process report', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Reports Queue"
        description="Review member-submitted reports for posts, comments, and gallery photos. Dismiss invalid flags, hide content pending revision, or remove content."
        badge={<Badge tone={reports.length > 0 && statusFilter === 'open' ? 'danger' : 'neutral'}>{reports.length} Reports</Badge>}
        actions={
          <Button variant="secondary" size="sm" onClick={loadReports} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
            >
              <option value="open">Open Reports</option>
              <option value="actioned">Actioned Reports</option>
              <option value="dismissed">Dismissed Reports</option>
              <option value="">All Statuses</option>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingRows count={4} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-6 w-6" />}
          title="No reports matching this filter"
          description="Reported posts, comments, and gallery photos will appear here for moderator review."
        />
      ) : (
        <div className="space-y-3.5">
          {reports.map((report) => {
            const isMinorRemoval = report.reason === 'minor_removal_request';
            return (
              <Card
                key={report.id}
                className={`p-5 ${isMinorRemoval ? 'border-[#b83227]/40 bg-[#fff5f5]' : ''}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{formatEnumLabel(report.subjectType)}</Badge>
                      <Badge tone={isMinorRemoval ? 'danger' : 'amber'}>
                        {isMinorRemoval && <ShieldAlert className="h-3 w-3" />}
                        {formatEnumLabel(report.reason)}
                      </Badge>
                      <Badge tone={statusTone(report.status)}>
                        {formatEnumLabel(report.status)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#56635a]">
                      <span>
                        Subject ID: <code className="text-[#16241b]">{report.subjectId}</code>
                      </span>
                      <span>
                        Reporter: {report.reporter?.fullName || report.reporterId.slice(0, 8)}
                      </span>
                      <span>Filed: {formatDateTime(report.createdAt)}</span>
                    </div>

                    {report.detail && (
                      <div className="rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3 text-xs text-[#3e4c42]">
                        {report.detail}
                      </div>
                    )}

                    {report.resolutionNote && (
                      <p className="text-xs text-[#0a542d]">
                        Resolution Note: {report.resolutionNote}
                      </p>
                    )}
                  </div>

                  {report.status === 'open' && (
                    <div className="flex flex-wrap shrink-0 items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActionModal({ report, decision: 'dismiss' })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActionModal({ report, decision: 'hide' })}
                      >
                        <EyeOff className="h-3.5 w-3.5 text-[#b83227]" />
                        Hide Content
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setActionModal({ report, decision: 'remove' })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ReasonModal
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={
          actionModal?.decision === 'dismiss'
            ? 'Dismiss Report'
            : actionModal?.decision === 'hide'
              ? 'Hide Reported Content'
              : 'Remove Reported Content'
        }
        description="Record an optional resolution note for the moderation log."
        confirmLabel={
          actionModal?.decision === 'dismiss'
            ? 'Dismiss Report'
            : actionModal?.decision === 'hide'
              ? 'Hide Content'
              : 'Remove Content'
        }
        confirmVariant={actionModal?.decision === 'remove' ? 'danger' : 'primary'}
        reasonLabel="Resolution Note"
        reasonPlaceholder="Optional note explaining the moderation outcome..."
        required={actionModal?.decision !== 'dismiss'}
        onConfirm={handleDecision}
      />
    </div>
  );
}
