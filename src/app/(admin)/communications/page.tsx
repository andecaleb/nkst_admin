'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  BookMarked,
  Plus,
  Pin,
  Send,
  EyeOff,
  Search,
  RefreshCw,
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
  Select,
  Textarea,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime, formatEnumLabel } from '@/lib/format';
import type {
  Audience,
  ChurchRecord,
  PostCategory,
  PostRecord,
  RecitationRecord,
} from '@/types/api';

export default function CommunicationsPage() {
  const { isPlatformAdmin, isChurchAdmin, member } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'announcements' | 'recitations'>('announcements');
  const [announcements, setAnnouncements] = useState<PostRecord[]>([]);
  const [recitations, setRecitations] = useState<RecitationRecord[]>([]);
  const [draftRecitations, setDraftRecitations] = useState<RecitationRecord[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [recitationSearch, setRecitationSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Publish announcement modal
  const [annOpen, setAnnOpen] = useState(false);
  const [annCategory, setAnnCategory] = useState<PostCategory>('announcement');
  const [annAudience, setAnnAudience] = useState<Audience>(
    isPlatformAdmin ? 'general' : isChurchAdmin ? 'church' : 'group',
  );
  const [annChurchId, setAnnChurchId] = useState(member?.churchId || '');
  const [annGroupId, setAnnGroupId] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [annPinDays, setAnnPinDays] = useState(7);

  // Create recitation modal (Platform Admin)
  const [recOpen, setRecOpen] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recBody, setRecBody] = useState('');
  const [recAppliesOn, setRecAppliesOn] = useState('');
  const [recAttachmentUrl, setRecAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [annRes, recRes, churchesRes] = await Promise.all([
        api.get<PostRecord[]>('/communication/announcements'),
        api.get<RecitationRecord[]>('/communication/recitations', {
          search: recitationSearch.trim() || undefined,
        }),
        api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 }),
      ]);
      setAnnouncements(Array.isArray(annRes.data) ? annRes.data : []);
      setRecitations(Array.isArray(recRes.data) ? recRes.data : []);
      setChurches(Array.isArray(churchesRes.data) ? churchesRes.data : []);
    } catch (err) {
      toast.error(
        'Failed to load communications',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [recitationSearch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/communication/announcements', {
        type: 'text',
        category: annCategory,
        audience: annAudience,
        audienceChurchId: annAudience === 'church' ? annChurchId || member?.churchId : undefined,
        audienceGroupId: annAudience === 'group' ? annGroupId.trim() : undefined,
        body: annBody.trim(),
        isPinned: annPinned,
        pinDays: annPinned ? Number(annPinDays) : undefined,
      });
      toast.success('Official announcement published', 'Published directly without moderation.');
      setAnnOpen(false);
      setAnnBody('');
      setAnnPinned(false);
      loadData();
    } catch (err) {
      toast.error('Publish failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRecitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post<RecitationRecord>('/communication/recitations', {
        title: recTitle.trim(),
        body: recBody.trim(),
        appliesOn: recAppliesOn,
        attachmentUrl: recAttachmentUrl.trim() || undefined,
      });
      toast.success('Draft recitation created', 'Click Publish to broadcast to all NKST members.');
      if (res.data) {
        setDraftRecitations((prev) => [res.data, ...prev]);
      }
      setRecOpen(false);
      setRecTitle('');
      setRecBody('');
      setRecAppliesOn('');
      setRecAttachmentUrl('');
    } catch (err) {
      toast.error('Failed to create recitation', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishRecitation = async (recitationId: string) => {
    try {
      await api.patch(`/communication/recitations/${recitationId}/publish`);
      toast.success('Recitation published', 'Notifications broadcast to all members.');
      setDraftRecitations((prev) => prev.filter((d) => d.id !== recitationId));
      loadData();
    } catch (err) {
      toast.error('Publish failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleUnpublishRecitation = async (recitation: RecitationRecord) => {
    try {
      await api.patch(`/communication/recitations/${recitation.id}/unpublish`);
      toast.success('Recitation unpublished');
      setDraftRecitations((prev) => [
        { ...recitation, status: 'draft' },
        ...prev.filter((d) => d.id !== recitation.id),
      ]);
      loadData();
    } catch (err) {
      toast.error('Unpublish failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="Publish official announcements directly to your authorized audience (skips moderation) and manage national NKST recitations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              <button
                type="button"
                onClick={() => setTab('announcements')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'announcements' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Official Announcements
              </button>
              <button
                type="button"
                onClick={() => setTab('recitations')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'recitations' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                National Recitations
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={loadData} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {tab === 'announcements' ? (
              <Button variant="primary" size="sm" onClick={() => setAnnOpen(true)}>
                <Plus className="h-4 w-4" />
                Publish Announcement
              </Button>
            ) : (
              isPlatformAdmin && (
                <Button variant="primary" size="sm" onClick={() => setRecOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Recitation
                </Button>
              )
            )}
          </div>
        }
      />

      {tab === 'announcements' ? (
        loading ? (
          <LoadingRows count={4} />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No official announcements yet"
            description="Publish an official notice, news item, or pinned announcement to reach members immediately."
          />
        ) : (
          <div className="space-y-3.5">
            {announcements.map((a) => (
              <Card key={a.id} className="p-5 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">{formatEnumLabel(a.category)}</Badge>
                  <Badge tone="neutral">Audience: {formatEnumLabel(a.audience)}</Badge>
                  {a.isPinned && (
                    <Badge tone="emerald">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </Badge>
                  )}
                  {a.publisherLabel && (
                    <span className="text-xs font-medium text-[#9b5f0d]">{a.publisherLabel}</span>
                  )}
                </div>
                <p className="text-sm text-[#16241b] whitespace-pre-wrap leading-relaxed">
                  {a.body}
                </p>
                <p className="text-[11px] text-[#56635a]">
                  Published {formatDateTime(a.createdAt)}
                  {a.church?.name ? ` · ${a.church.name}` : ''}
                </p>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
              <Input
                value={recitationSearch}
                onChange={(e) => setRecitationSearch(e.target.value)}
                placeholder="Search national recitations by title..."
                className="pl-9"
              />
            </div>
          </Card>

          {draftRecitations.length > 0 && isPlatformAdmin && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#b83227]">
                Draft Recitations (Ready to Publish)
              </p>
              {draftRecitations.map((d) => (
                <Card key={d.id} className="p-5 border-amber-300">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[#16241b]">{d.title}</h3>
                        <Badge tone="amber">Draft</Badge>
                      </div>
                      <p className="text-xs text-[#56635a]">
                        Applies on: {formatDate(d.appliesOn)}
                      </p>
                      <p className="text-sm text-[#3e4c42] whitespace-pre-wrap">{d.body}</p>
                    </div>
                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={() => handlePublishRecitation(d.id)}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publish &amp; Broadcast
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {loading ? (
            <LoadingRows count={4} />
          ) : recitations.length === 0 ? (
            <EmptyState
              icon={<BookMarked className="h-6 w-6" />}
              title="No published recitations found"
              description="Platform Admins can draft and publish national NKST recitations for all congregations."
            />
          ) : (
            <div className="space-y-3.5">
              {recitations.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#16241b]">{r.title}</h3>
                        <Badge tone={statusTone(r.status)}>{formatEnumLabel(r.status)}</Badge>
                        <Badge tone="gold">Applies: {formatDate(r.appliesOn)}</Badge>
                      </div>
                      <p className="text-sm text-[#3e4c42] whitespace-pre-wrap leading-relaxed">
                        {r.body}
                      </p>
                      {r.attachmentUrl && (
                        <a
                          href={r.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-xs text-[#0a542d] hover:underline"
                        >
                          Open PDF Attachment
                        </a>
                      )}
                    </div>
                    {isPlatformAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUnpublishRecitation(r)}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Unpublish
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Publish Official Announcement Modal */}
      <Modal
        open={annOpen}
        onClose={() => setAnnOpen(false)}
        title="Publish Official Announcement"
        description="Official content publishes immediately and notifies the target audience (ANN-01..06)."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handlePublishAnnouncement} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>Category</FieldLabel>
              <Select
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value as PostCategory)}
              >
                <option value="announcement">Announcement</option>
                <option value="important">Important Information</option>
                <option value="news">News</option>
                <option value="notice">Notice</option>
                <option value="advert">Advert</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Target Audience</FieldLabel>
              <Select
                value={annAudience}
                onChange={(e) => setAnnAudience(e.target.value as Audience)}
              >
                {isPlatformAdmin && <option value="general">General (All NKST Members)</option>}
                {(isPlatformAdmin || isChurchAdmin) && (
                  <option value="church">Church Congregation</option>
                )}
                <option value="group">Specific Group</option>
              </Select>
            </div>
          </div>

          {annAudience === 'church' && (
            <div>
              <FieldLabel required>Congregation</FieldLabel>
              <Select
                value={annChurchId}
                onChange={(e) => setAnnChurchId(e.target.value)}
                required
              >
                <option value="">Select Church</option>
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {annAudience === 'group' && (
            <div>
              <FieldLabel required>Target Group UUID</FieldLabel>
              <Input
                value={annGroupId}
                onChange={(e) => setAnnGroupId(e.target.value)}
                placeholder="UUID of target group"
                required
              />
            </div>
          )}

          <div>
            <FieldLabel required>Announcement Content</FieldLabel>
            <Textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Write the official announcement..."
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[#16241b] cursor-pointer">
              <input
                type="checkbox"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
                className="h-4 w-4 accent-[#0a542d]"
              />
              Pin announcement at top of feed
            </label>
            {annPinned && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#56635a]">Days (1–30):</span>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={annPinDays}
                  onChange={(e) => setAnnPinDays(Number(e.target.value))}
                  className="w-20 py-1"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAnnOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Publish Now
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create National Recitation Modal (Platform Admin) */}
      <Modal
        open={recOpen}
        onClose={() => setRecOpen(false)}
        title="Draft National NKST Recitation"
        description="Create a national recitation draft. Once published, it broadcasts notifications to all members (REC-01..05)."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateRecitation} className="space-y-4">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <Input
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              placeholder="e.g. NKST Sunday Recitation — Week 48"
              required
            />
          </div>
          <div>
            <FieldLabel required>Applies On Date</FieldLabel>
            <Input
              type="date"
              value={recAppliesOn}
              onChange={(e) => setRecAppliesOn(e.target.value)}
              required
            />
          </div>
          <div>
            <FieldLabel required>Recitation Text</FieldLabel>
            <Textarea
              value={recBody}
              onChange={(e) => setRecBody(e.target.value)}
              placeholder="Enter full recitation text..."
              className="min-h-[140px]"
              required
            />
          </div>
          <div>
            <FieldLabel hint="Optional PDF link">Attachment URL</FieldLabel>
            <Input
              value={recAttachmentUrl}
              onChange={(e) => setRecAttachmentUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setRecOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Draft
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
