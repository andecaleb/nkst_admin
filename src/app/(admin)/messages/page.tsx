'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  Send,
  Inbox,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  AlertTriangle,
  Tag,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
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
  StatCard,
  Textarea,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatEnumLabel, isValidUuid } from '@/lib/format';
import type {
  ChurchRecord,
  DirectMessageRecord,
  DirectMessageStatus,
  FlaggedKeywordRecord,
  KeywordSeverity,
  MemberProfile,
  PaginationMeta,
} from '@/types/api';

type MessagesTab = 'queue' | 'all' | 'keywords' | 'inbox' | 'sent';

interface MessagesMeta extends Partial<PaginationMeta> {
  flaggedCount?: number;
  pendingCount?: number;
}

function severityTone(severity: KeywordSeverity): 'danger' | 'amber' | 'neutral' {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'amber';
  return 'neutral';
}

export default function MessagesPage() {
  const { isPlatformAdmin, isChurchAdmin, administeredChurchIds, scopedChurchId } = useAuth();
  const canModerateMessages = isPlatformAdmin || isChurchAdmin;
  const toast = useToast();

  const [tab, setTab] = useState<MessagesTab>(canModerateMessages ? 'queue' : 'inbox');
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [meta, setMeta] = useState<MessagesMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Reference data
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [keywords, setKeywords] = useState<FlaggedKeywordRecord[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [churchFilter, setChurchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<DirectMessageStatus | ''>('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Modals
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const [viewMessage, setViewMessage] = useState<DirectMessageRecord | null>(null);
  const [approveTarget, setApproveTarget] = useState<DirectMessageRecord | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<DirectMessageRecord | null>(null);

  // Flagged keyword modal (Platform Admin)
  const [kwModalOpen, setKwModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newSeverity, setNewSeverity] = useState<KeywordSeverity>('medium');
  const [submitting, setSubmitting] = useState(false);

  const loadReferenceData = useCallback(async () => {
    try {
      const [churchesRes, membersRes] = await Promise.all([
        api
          .get<ChurchRecord[]>('/churches', { page: 1, limit: 100 })
          .catch(() => ({ data: [] as ChurchRecord[] })),
        canModerateMessages
          ? api
              .get<MemberProfile[]>('/members', {
                churchId: isPlatformAdmin ? undefined : scopedChurchId,
                page: 1,
                limit: 100,
              })
              .catch(() => ({ data: [] as MemberProfile[] }))
          : Promise.resolve({ data: [] as MemberProfile[] }),
      ]);
      const rawChurches = Array.isArray(churchesRes.data) ? churchesRes.data : [];
      setChurches(
        isPlatformAdmin
          ? rawChurches
          : rawChurches.filter((c) => administeredChurchIds.includes(c.id)),
      );
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch {
      // Non-blocking
    }
  }, [canModerateMessages, isPlatformAdmin, administeredChurchIds, scopedChurchId]);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'keywords') {
        const res = await api.get<FlaggedKeywordRecord[]>('/messages/flagged-keywords');
        setKeywords(Array.isArray(res.data) ? res.data : []);
      } else if (tab === 'queue' && canModerateMessages) {
        const res = await api.get<DirectMessageRecord[]>('/messages/approval-queue', {
          churchId: isPlatformAdmin ? churchFilter || undefined : scopedChurchId,
          flaggedOnly: flaggedOnly || undefined,
          search: search.trim() || undefined,
          page,
          limit: 20,
        });
        const list = (Array.isArray(res.data) ? res.data : []).filter(
          (m) => isPlatformAdmin || administeredChurchIds.includes(m.churchId),
        );
        setMessages(list);
        setMeta((res.meta as MessagesMeta) || { page: 1, limit: 20, total: list.length, totalPages: 1 });
      } else if (tab === 'all' && isPlatformAdmin) {
        const res = await api.get<DirectMessageRecord[]>('/messages/admin/all', {
          churchId: churchFilter || undefined,
          status: statusFilter || undefined,
          flaggedOnly: flaggedOnly || undefined,
          search: search.trim() || undefined,
          page,
          limit: 20,
        });
        const list = Array.isArray(res.data) ? res.data : [];
        setMessages(list);
        setMeta((res.meta as MessagesMeta) || { page: 1, limit: 20, total: list.length, totalPages: 1 });
      } else if (tab === 'inbox') {
        const res = await api.get<DirectMessageRecord[]>('/messages/inbox', { page, limit: 20 });
        const list = Array.isArray(res.data) ? res.data : [];
        setMessages(list);
        setMeta((res.meta as MessagesMeta) || { page: 1, limit: 20, total: list.length, totalPages: 1 });
      } else if (tab === 'sent') {
        const res = await api.get<DirectMessageRecord[]>('/messages/sent', { page, limit: 20 });
        const list = Array.isArray(res.data) ? res.data : [];
        setMessages(list);
        setMeta((res.meta as MessagesMeta) || { page: 1, limit: 20, total: list.length, totalPages: 1 });
      }
    } catch (err) {
      toast.error('Failed to load messages', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    canModerateMessages,
    isPlatformAdmin,
    administeredChurchIds,
    scopedChurchId,
    churchFilter,
    statusFilter,
    flaggedOnly,
    search,
    page,
    toast,
  ]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUuid(recipientId)) {
      toast.warning('Invalid Recipient', 'Please choose a recipient or enter a valid Member UUID.');
      return;
    }
    setSending(true);
    try {
      const res = await api.post<DirectMessageRecord>('/messages', {
        recipientId: recipientId.trim(),
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      toast.success(
        'Message submitted for approval',
        res.data?.isFlagged
          ? 'Flagged keyword detected — highlighted for recipient Church Admin review.'
          : 'Queued for the recipient Church Admin before entering their inbox.',
      );
      setComposeOpen(false);
      setRecipientId('');
      setSubject('');
      setBody('');
      loadTabData();
    } catch (err) {
      toast.error('Failed to send message', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const handleOpenMessage = async (msg: DirectMessageRecord) => {
    setViewMessage(msg);
    if (tab === 'inbox' && !msg.readAt) {
      try {
        await api.patch(`/messages/${msg.id}/read`);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, readAt: new Date().toISOString() } : m,
          ),
        );
      } catch {
        // Non-blocking
      }
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;
    setSubmitting(true);
    try {
      await api.patch(`/messages/${approveTarget.id}/approve`, {
        reviewNote: approveNote.trim() || undefined,
      });
      toast.success('Message approved', 'Delivered to recipient inbox and logged to audit trail.');
      setApproveTarget(null);
      setApproveNote('');
      setViewMessage(null);
      loadTabData();
    } catch (err) {
      toast.error('Approval failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    if (reason.trim().length < 3) {
      toast.warning('Rejection reason must be at least 3 characters');
      return;
    }
    try {
      await api.patch(`/messages/${rejectTarget.id}/reject`, { reason });
      toast.success('Message rejected', 'Sender notified; message will not enter recipient inbox.');
      setViewMessage(null);
      loadTabData();
    } catch (err) {
      toast.error('Rejection failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim().length < 2) {
      toast.warning('Keyword must be at least 2 characters');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/messages/flagged-keywords', {
        keyword: newKeyword.trim(),
        severity: newSeverity,
      });
      toast.success('Flagged keyword added');
      setKwModalOpen(false);
      setNewKeyword('');
      setNewSeverity('medium');
      loadTabData();
    } catch (err) {
      toast.error('Failed to add keyword', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleKeyword = async (kw: FlaggedKeywordRecord) => {
    try {
      await api.patch(`/messages/flagged-keywords/${kw.id}`, {
        isActive: !kw.isActive,
      });
      toast.success(kw.isActive ? 'Keyword paused' : 'Keyword activated');
      loadTabData();
    } catch (err) {
      toast.error('Update failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleChangeKeywordSeverity = async (
    kw: FlaggedKeywordRecord,
    severity: KeywordSeverity,
  ) => {
    try {
      await api.patch(`/messages/flagged-keywords/${kw.id}`, { severity });
      toast.success('Severity updated');
      loadTabData();
    } catch (err) {
      toast.error('Update failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleDeleteKeyword = async (kw: FlaggedKeywordRecord) => {
    try {
      await api.delete(`/messages/flagged-keywords/${kw.id}`);
      toast.success('Flagged keyword removed');
      loadTabData();
    } catch (err) {
      toast.error('Delete failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const switchTab = (next: MessagesTab) => {
    setTab(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Messages & Keyword Oversight"
        description={
          isPlatformAdmin
            ? 'Review pending member messages, monitor flagged content across all churches, and manage platform-wide flagged keywords.'
            : isChurchAdmin
              ? 'Approve or reject incoming messages addressed to members of your congregation before they reach member inboxes.'
              : 'Send messages and view your approved inbox and sent message statuses.'
        }
        badge={
          tab === 'queue' ? (
            <Badge tone="amber">{meta.total ?? messages.length} Pending</Badge>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadTabData} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {tab === 'keywords' && isPlatformAdmin && (
              <Button variant="primary" size="sm" onClick={() => setKwModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Flagged Keyword
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setComposeOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              New Message
            </Button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[#e4dfd3] bg-white p-1.5 w-fit">
        {canModerateMessages && (
          <button
            type="button"
            onClick={() => switchTab('queue')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
              tab === 'queue'
                ? 'bg-[#0a542d] text-white'
                : 'text-[#56635a] hover:text-[#16241b]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Approval Queue
          </button>
        )}
        {isPlatformAdmin && (
          <button
            type="button"
            onClick={() => switchTab('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
              tab === 'all'
                ? 'bg-[#0a542d] text-white'
                : 'text-[#56635a] hover:text-[#16241b]'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            All Platform Messages
          </button>
        )}
        {canModerateMessages && (
          <button
            type="button"
            onClick={() => switchTab('keywords')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
              tab === 'keywords'
                ? 'bg-[#0a542d] text-white'
                : 'text-[#56635a] hover:text-[#16241b]'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            Flagged Keywords
          </button>
        )}
        <button
          type="button"
          onClick={() => switchTab('inbox')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
            tab === 'inbox'
              ? 'bg-[#0a542d] text-white'
              : 'text-[#56635a] hover:text-[#16241b]'
          }`}
        >
          <Inbox className="h-3.5 w-3.5" />
          My Inbox
        </button>
        <button
          type="button"
          onClick={() => switchTab('sent')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
            tab === 'sent'
              ? 'bg-[#0a542d] text-white'
              : 'text-[#56635a] hover:text-[#16241b]'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Sent
        </button>
      </div>

      {/* Platform Admin Oversight KPIs */}
      {tab === 'all' && isPlatformAdmin && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Messages"
            value={meta.total ?? messages.length}
            sublabel="Across all NKST congregations"
            icon={<Mail className="h-5 w-5" />}
            accent="gold"
          />
          <StatCard
            label="Pending Approval"
            value={meta.pendingCount ?? 0}
            sublabel="Awaiting Church Admin review"
            icon={<Clock className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard
            label="Keyword Flagged"
            value={meta.flaggedCount ?? 0}
            sublabel="Matched active platform keywords"
            icon={<ShieldAlert className="h-5 w-5" />}
            accent={(meta.flaggedCount ?? 0) > 0 ? 'danger' : 'emerald'}
          />
        </div>
      )}

      {/* Filter Bar for Approval Queue & Platform Oversight */}
      {(tab === 'queue' || tab === 'all') && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search subject or message body..."
                className="pl-9"
              />
            </div>
            {isPlatformAdmin && (
              <Select
                value={churchFilter}
                onChange={(e) => {
                  setChurchFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Congregations</option>
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            {tab === 'all' && (
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as DirectMessageStatus | '');
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
            )}
            <label className="flex items-center gap-2 text-xs font-medium text-[#16241b] cursor-pointer px-1">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => {
                  setFlaggedOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[#b83227]"
              />
              Show Flagged Only
            </label>
          </div>
        </Card>
      )}

      {/* Main Content */}
      {loading ? (
        <LoadingRows count={5} />
      ) : tab === 'keywords' ? (
        keywords.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-6 w-6" />}
            title="No flagged keywords configured"
            description="Platform Admins can add keywords (e.g. financial solicitations, scams, abusive terms) that automatically flag member messages for priority review."
            action={
              isPlatformAdmin ? (
                <Button variant="primary" size="sm" onClick={() => setKwModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add First Keyword
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                    <th className="px-4 py-3.5 w-14">S/No.</th>
                    <th className="px-4 py-3.5">Keyword / Phrase</th>
                    <th className="px-4 py-3.5">Severity</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Created</th>
                    {isPlatformAdmin && <th className="px-4 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece7dc]">
                  {keywords.map((kw, idx) => (
                    <tr key={kw.id} className="hover:bg-[#faf7f0]">
                      <td className="px-4 py-3.5 font-mono text-[#56635a]">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-semibold text-[#16241b]">{kw.keyword}</td>
                      <td className="px-4 py-3.5">
                        {isPlatformAdmin ? (
                          <Select
                            value={kw.severity}
                            onChange={(e) =>
                              handleChangeKeywordSeverity(kw, e.target.value as KeywordSeverity)
                            }
                            className="w-28 py-1 text-xs"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </Select>
                        ) : (
                          <Badge tone={severityTone(kw.severity)}>
                            {formatEnumLabel(kw.severity)}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone={kw.isActive ? 'emerald' : 'neutral'}>
                          {kw.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-[#56635a]">
                        {formatDateTime(kw.createdAt)}
                      </td>
                      {isPlatformAdmin && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleToggleKeyword(kw)}
                          >
                            {kw.isActive ? 'Pause' : 'Activate'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteKeyword(kw)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : messages.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title={
            tab === 'queue'
              ? 'Message approval queue is clear'
              : tab === 'inbox'
                ? 'Your inbox is empty'
                : tab === 'sent'
                  ? 'No sent messages yet'
                  : 'No messages match your filters'
          }
          description={
            tab === 'queue'
              ? 'Incoming member messages awaiting congregation approval will appear here, with keyword-flagged items pinned at the top.'
              : 'Use New Message to send a message to another NKST member.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                  <th className="px-4 py-3.5 w-14">S/No.</th>
                  <th className="px-4 py-3.5">Sender &amp; Recipient</th>
                  {(tab === 'queue' || tab === 'all') && (
                    <th className="px-4 py-3.5">Church</th>
                  )}
                  <th className="px-4 py-3.5">Subject &amp; Message</th>
                  <th className="px-4 py-3.5">Status &amp; Flags</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece7dc]">
                {messages.map((msg, idx) => {
                  const serialNo = ((meta.page ?? page) - 1) * (meta.limit ?? 20) + idx + 1;
                  const canActOnMsg =
                    canModerateMessages &&
                    msg.status === 'pending_approval' &&
                    (isPlatformAdmin || administeredChurchIds.includes(msg.churchId));

                  return (
                    <tr
                      key={msg.id}
                      className={
                        msg.isFlagged
                          ? 'bg-[#fff5f5] hover:bg-[#fdeceb]/70'
                          : 'hover:bg-[#faf7f0]'
                      }
                    >
                      <td className="px-4 py-3.5 font-mono text-[#56635a]">{serialNo}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[#16241b]">
                          {msg.sender?.fullName || msg.senderId.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-[#56635a]">
                          → {msg.recipient?.fullName || msg.recipientId.slice(0, 8)}
                        </p>
                      </td>
                      {(tab === 'queue' || tab === 'all') && (
                        <td className="px-4 py-3.5 text-[#3e4c42]">
                          {msg.church?.name || msg.churchId.slice(0, 8)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="font-semibold text-[#16241b] truncate">
                          {msg.subject || '(No subject)'}
                        </p>
                        <p className="mt-0.5 text-[#56635a] line-clamp-2">{msg.body}</p>
                      </td>
                      <td className="px-4 py-3.5 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone={statusTone(msg.status)}>
                            {formatEnumLabel(msg.status)}
                          </Badge>
                          {msg.isFlagged && (
                            <Badge tone="danger">
                              <AlertTriangle className="h-3 w-3" />
                              Flagged
                            </Badge>
                          )}
                          {tab === 'inbox' && !msg.readAt && (
                            <Badge tone="gold">Unread</Badge>
                          )}
                        </div>
                        {msg.matchedKeywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {msg.matchedKeywords.map((kw) => (
                              <span
                                key={kw}
                                className="rounded bg-[#fdeceb] border border-[#b83227]/30 px-1.5 py-0.5 font-mono text-[10px] text-[#9c261d]"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[#56635a] whitespace-nowrap">
                        {formatDateTime(msg.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenMessage(msg)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          {canActOnMsg && (
                            <>
                              <Button
                                variant="emerald"
                                size="sm"
                                onClick={() => {
                                  setApproveTarget(msg);
                                  setApproveNote('');
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setRejectTarget(msg)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(meta.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between border-t border-[#e4dfd3] bg-[#faf7f0] px-4 py-3 text-xs text-[#56635a]">
              <span>
                Page <strong className="text-[#16241b]">{meta.page ?? page}</strong> of{' '}
                <strong className="text-[#16241b]">{meta.totalPages ?? 1}</strong> ·{' '}
                {meta.total ?? messages.length} total
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Compose Message Modal */}
      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Send Member Message"
        description="Messages are scanned against platform flagged keywords and queued for the recipient's Church Admin approval before delivery."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSendMessage} className="space-y-4">
          {members.length > 0 && (
            <div>
              <FieldLabel hint="Or enter a UUID below">Select Recipient</FieldLabel>
              <Select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
              >
                <option value="">Choose a member...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} {m.church?.name ? `(${m.church.name})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <FieldLabel required>Recipient Member UUID</FieldLabel>
            <Input
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="UUID of recipient NKST member"
              required
            />
          </div>
          <div>
            <FieldLabel hint="Optional (max 160 chars)">Subject</FieldLabel>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={160}
              placeholder="e.g. Choir rehearsal update"
            />
          </div>
          <div>
            <FieldLabel required>Message Body</FieldLabel>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              className="min-h-[120px]"
              placeholder="Write your message..."
              required
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={sending}>
              <Send className="h-3.5 w-3.5" />
              Send for Approval
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Full Message Modal */}
      <Modal
        open={Boolean(viewMessage)}
        onClose={() => setViewMessage(null)}
        title={viewMessage?.subject || 'Member Message'}
        description={`From ${viewMessage?.sender?.fullName || viewMessage?.senderId} → ${viewMessage?.recipient?.fullName || viewMessage?.recipientId}`}
        maxWidth="max-w-xl"
      >
        {viewMessage && (
          <div className="space-y-4">
            {viewMessage.isFlagged && (
              <div className="rounded-xl border border-[#b83227]/35 bg-[#fdeceb] p-3.5 text-xs text-[#9c261d] space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Keyword Flagged Message
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {viewMessage.matchedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#9c261d] border border-[#b83227]/30"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={statusTone(viewMessage.status)}>
                {formatEnumLabel(viewMessage.status)}
              </Badge>
              {viewMessage.church?.name && (
                <Badge tone="neutral">{viewMessage.church.name}</Badge>
              )}
              <span className="ml-auto text-[#56635a]">
                Sent {formatDateTime(viewMessage.createdAt)}
              </span>
            </div>

            <div className="rounded-xl border border-[#e4dfd3] bg-[#faf7f0] p-4 text-sm text-[#16241b] whitespace-pre-wrap leading-relaxed">
              {viewMessage.body}
            </div>

            {viewMessage.reviewNote && (
              <p className="text-xs text-[#0a542d] flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Review Note: {viewMessage.reviewNote}
              </p>
            )}

            {viewMessage.rejectionReason && (
              <p className="text-xs text-[#9c261d]">
                Rejection Reason: {viewMessage.rejectionReason}
              </p>
            )}

            {canModerateMessages &&
              viewMessage.status === 'pending_approval' &&
              (isPlatformAdmin || administeredChurchIds.includes(viewMessage.churchId)) && (
                <div className="flex justify-end gap-2 border-t border-[#e4dfd3] pt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setRejectTarget(viewMessage)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => {
                      setApproveTarget(viewMessage);
                      setApproveNote('');
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve &amp; Deliver
                  </Button>
                </div>
              )}
          </div>
        )}
      </Modal>

      {/* Approve Message Modal */}
      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Approve & Deliver Message"
        description="Approving delivers this message to the recipient's inbox and logs the decision to the audit trail."
      >
        <form onSubmit={handleApprove} className="space-y-4">
          <div>
            <FieldLabel hint="Optional">Review Note</FieldLabel>
            <Textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="e.g. Reviewed and approved for member inbox."
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" loading={submitting}>
              Approve &amp; Deliver
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Message Modal (Mandatory Reason) */}
      <ReasonModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Pending Message"
        description="Provide a clear reason (min 3 characters). The sender will be notified and the message will never enter the recipient's inbox."
        confirmLabel="Reject Message"
        confirmVariant="danger"
        reasonLabel="Rejection Reason"
        reasonPlaceholder="e.g. Contains unverified financial solicitation."
        onConfirm={handleReject}
      />

      {/* Add Flagged Keyword Modal (Platform Admin) */}
      <Modal
        open={kwModalOpen}
        onClose={() => setKwModalOpen(false)}
        title="Add Platform-Wide Flagged Keyword"
        description="Any new member message containing this keyword or phrase will be automatically flagged and pinned to the top of the approval queue."
      >
        <form onSubmit={handleAddKeyword} className="space-y-4">
          <div>
            <FieldLabel required>Keyword or Phrase</FieldLabel>
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. wire transfer, send money, urgent loan"
              required
            />
          </div>
          <div>
            <FieldLabel required>Severity</FieldLabel>
            <Select
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as KeywordSeverity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setKwModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Flagged Keyword
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
