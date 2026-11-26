'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  FileText,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
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
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatEnumLabel, formatNgn } from '@/lib/format';
import { RESOURCE_CATEGORY_LABELS } from '@/types/api';
import type {
  ResourceAccess,
  ResourceCategory,
  ResourceFormat,
  ResourceRecord,
} from '@/types/api';

export default function ResourcesModerationPage() {
  const toast = useToast();

  const [tab, setTab] = useState<'queue' | 'library'>('queue');
  const [queue, setQueue] = useState<ResourceRecord[]>([]);
  const [library, setLibrary] = useState<ResourceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Library filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | ''>('');
  const [accessFilter, setAccessFilter] = useState<ResourceAccess | ''>('');
  const [formatFilter, setFormatFilter] = useState<ResourceFormat | ''>('');

  // Review modals
  const [approveTarget, setApproveTarget] = useState<ResourceRecord | null>(null);
  const [approveCategory, setApproveCategory] = useState<ResourceCategory>('sermons');
  const [rejectTarget, setRejectTarget] = useState<ResourceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'queue') {
        const res = await api.get<ResourceRecord[]>('/resources/review-queue');
        setQueue(Array.isArray(res.data) ? res.data : []);
      } else {
        const res = await api.get<ResourceRecord[]>('/resources/library', {
          search: search.trim() || undefined,
          category: categoryFilter || undefined,
          access: accessFilter || undefined,
          format: formatFilter || undefined,
        });
        setLibrary(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error(
        'Failed to load resources',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [tab, search, categoryFilter, accessFilter, formatFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;
    setSubmitting(true);
    try {
      await api.patch(`/resources/${approveTarget.id}/review`, {
        decision: 'approve',
        category: approveCategory,
      });
      toast.success(
        'Resource approved',
        'Now available in the Church Collection and Central Library.',
      );
      setApproveTarget(null);
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
      await api.patch(`/resources/${rejectTarget.id}/review`, {
        decision: 'reject',
        reason,
      });
      toast.success('Resource rejected', 'Owner can revise and resubmit from My Library.');
      loadData();
    } catch (err) {
      toast.error('Rejection failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources & Central Library"
        description="Approve or reject member-submitted sermons, hymnals, study guides, and physical items before they enter the Church Collection and Central Library."
        badge={<Badge tone="amber">{queue.length} In Queue</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              <button
                type="button"
                onClick={() => setTab('queue')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'queue' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Review Queue
              </button>
              <button
                type="button"
                onClick={() => setTab('library')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'library' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Central Library
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={loadData} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {tab === 'library' && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or description..."
                className="pl-9"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ResourceCategory | '')}
            >
              <option value="">All Categories</option>
              {Object.entries(RESOURCE_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value as ResourceAccess | '')}
            >
              <option value="">Free &amp; Paid</option>
              <option value="free">Free Only</option>
              <option value="paid">Paid (Marketplace)</option>
            </Select>
            <Select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as ResourceFormat | '')}
            >
              <option value="">Digital &amp; Hard Copy</option>
              <option value="digital">Digital</option>
              <option value="hard_copy">Hard Copy</option>
            </Select>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingRows count={4} />
      ) : (tab === 'queue' ? queue : library).length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={
            tab === 'queue'
              ? 'No resources awaiting review'
              : 'No approved resources found'
          }
          description={
            tab === 'queue'
              ? 'Submitted church resources will appear here for approval.'
              : 'Adjust your search or filters to browse the Central Library.'
          }
        />
      ) : (
        <div className="space-y-4">
          {(tab === 'queue' ? queue : library).map((res) => (
            <Card key={res.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[#16241b]">{res.title}</h3>
                    <Badge tone="gold">
                      {RESOURCE_CATEGORY_LABELS[res.category] || res.category}
                    </Badge>
                    <Badge tone="neutral">{formatEnumLabel(res.resourceType)}</Badge>
                    <Badge tone="neutral">{formatEnumLabel(res.format)}</Badge>
                    <Badge tone={res.access === 'paid' ? 'amber' : 'emerald'}>
                      {res.access === 'paid' ? `Paid · ${formatNgn(res.price)}` : 'Free'}
                    </Badge>
                    <Badge tone={statusTone(res.status)}>{formatEnumLabel(res.status)}</Badge>
                  </div>

                  <p className="text-xs text-[#3e4c42] leading-relaxed">{res.description}</p>

                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#56635a]">
                    <span>
                      Owner: <strong className="text-[#16241b]">{res.owner?.fullName || res.ownerId.slice(0, 8)}</strong>
                    </span>
                    <span>Church: {res.church?.name || res.churchId}</span>
                    {res.format === 'hard_copy' && (
                      <span>Stock: {res.stock ?? 0} available</span>
                    )}
                    <span>Submitted: {formatDateTime(res.createdAt)}</span>
                  </div>

                  {res.files && res.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {res.files.map((f) => (
                        <a
                          key={f.id}
                          href={f.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] px-2.5 py-1 text-xs text-[#0a542d] hover:border-[#d48a1f]/45"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {f.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {tab === 'queue' && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={() => {
                        setApproveTarget(res);
                        setApproveCategory(res.category);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRejectTarget(res)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Approve Resource for Church Collection"
        description={`Confirm or refine the category for "${approveTarget?.title}" before publishing to the Central Library (RES-05).`}
      >
        <form onSubmit={handleApprove} className="space-y-4">
          <div>
            <FieldLabel required>Category</FieldLabel>
            <Select
              value={approveCategory}
              onChange={(e) => setApproveCategory(e.target.value as ResourceCategory)}
            >
              {Object.entries(RESOURCE_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" loading={submitting}>
              Approve Resource
            </Button>
          </div>
        </form>
      </Modal>

      <ReasonModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Resource Submission"
        description="Provide a clear reason so the contributor can revise and resubmit from My Library."
        confirmLabel="Reject Resource"
        onConfirm={handleReject}
      />
    </div>
  );
}
