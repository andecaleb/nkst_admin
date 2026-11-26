'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Images,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FolderPlus,
  RefreshCw,
  Check,
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
  ReasonModal,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime } from '@/lib/format';
import { PHOTO_CATEGORY_LABELS } from '@/types/api';
import type { AlbumRecord, ChurchRecord, PhotoRecord } from '@/types/api';

export default function GalleryReviewPage() {
  const { member, isPlatformAdmin, administeredChurchIds } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'queue' | 'albums'>('queue');
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState(member?.churchId || '');
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modals
  const [approveTarget, setApproveTarget] = useState<PhotoRecord | null>(null);
  const [moveToAlbumId, setMoveToAlbumId] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PhotoRecord | null>(null);

  // Create album modal
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumEventName, setAlbumEventName] = useState('');
  const [albumEventDate, setAlbumEventDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, churchesRes] = await Promise.all([
        api.get<PhotoRecord[]>('/gallery/review-queue'),
        api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 }),
      ]);
      const rawPhotos = Array.isArray(queueRes.data) ? queueRes.data : [];
      setPhotos(
        isPlatformAdmin
          ? rawPhotos
          : rawPhotos.filter((p) => administeredChurchIds.includes(p.churchId)),
      );
      const rawChurches = Array.isArray(churchesRes.data) ? churchesRes.data : [];
      const list = isPlatformAdmin
        ? rawChurches
        : rawChurches.filter((c) => administeredChurchIds.includes(c.id));
      setChurches(list);
      if (!selectedChurchId && list.length > 0) {
        setSelectedChurchId(member?.churchId || list[0].id);
      }
    } catch (err) {
      toast.error(
        'Failed to load gallery review queue',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [member?.churchId, selectedChurchId, isPlatformAdmin, administeredChurchIds, toast]);

  const loadAlbums = useCallback(async () => {
    if (!selectedChurchId) return;
    try {
      const res = await api.get<AlbumRecord[]>(`/gallery/churches/${selectedChurchId}/albums`);
      setAlbums(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Failed to load albums', err instanceof ApiError ? err.message : undefined);
    }
  }, [selectedChurchId, toast]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const handleApprovePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;
    setSubmitting(true);
    try {
      await api.patch(`/gallery/photos/${approveTarget.id}/review`, {
        decision: 'approve',
        moveToAlbumId: moveToAlbumId || undefined,
      });
      toast.success('Photo approved', 'Photo is now live in the church gallery.');
      setApproveTarget(null);
      setMoveToAlbumId('');
      loadQueue();
    } catch (err) {
      toast.error('Photo approval failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPhoto = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await api.patch(`/gallery/photos/${rejectTarget.id}/review`, {
        decision: 'reject',
        reason,
      });
      toast.success('Photo rejected', 'Uploader has been notified.');
      loadQueue();
    } catch (err) {
      toast.error('Photo rejection failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurchId) return;
    setSubmitting(true);
    try {
      await api.post(`/gallery/churches/${selectedChurchId}/albums`, {
        title: albumTitle.trim(),
        description: albumDesc.trim() || undefined,
        eventName: albumEventName.trim() || undefined,
        eventDate: albumEventDate || undefined,
      });
      toast.success('Album created');
      setAlbumModalOpen(false);
      setAlbumTitle('');
      setAlbumDesc('');
      setAlbumEventName('');
      setAlbumEventDate('');
      loadAlbums();
    } catch (err) {
      toast.error('Failed to create album', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gallery & Minors Safeguarding"
        description="Review submitted church gallery photos before public display. Photos showing children or minors are highlighted for strict caption and parental consent checks (GAL-11..15)."
        badge={<Badge tone="amber">{photos.length} Pending</Badge>}
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
                Photo Review Queue
              </button>
              <button
                type="button"
                onClick={() => setTab('albums')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'albums' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Church Albums
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={loadQueue} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {tab === 'queue' ? (
        loading ? (
          <LoadingRows count={4} />
        ) : photos.length === 0 ? (
          <EmptyState
            icon={<Images className="h-6 w-6" />}
            title="Photo review queue is clear"
            description="No submitted gallery photos are currently awaiting review."
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {photos.map((photo) => (
              <Card
                key={photo.id}
                className={`overflow-hidden ${
                  photo.hasMinors ? 'border-[#b83227]/45 ring-1 ring-[#b83227]/20' : ''
                }`}
              >
                {/* Prominent Minors Safeguarding Banner */}
                {photo.hasMinors && (
                  <div className="flex items-center gap-2 bg-[#fdeceb] border-b border-[#b83227]/35 px-4 py-2 text-xs font-semibold text-[#9c261d]">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    MINORS SAFEGUARDING FLAG — Verify parental consent &amp; ensure no child names in caption
                  </div>
                )}

                <div className="aspect-video w-full bg-[#faf7f0] overflow-hidden relative flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.fileUrl}
                    alt={photo.caption || 'Submitted gallery photo'}
                    className="h-full w-full object-cover select-none"
                    onContextMenu={photo.hasMinors ? (e) => e.preventDefault() : undefined}
                  />
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="gold">
                      {PHOTO_CATEGORY_LABELS[photo.category] || photo.category}
                    </Badge>
                    <Badge tone={photo.consentConfirmed ? 'emerald' : 'danger'}>
                      {photo.consentConfirmed ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {photo.consentConfirmed ? 'Consent Confirmed' : 'Consent Missing'}
                    </Badge>
                    {photo.hasMinors && (
                      <Badge tone={photo.parentalConsentConfirmed ? 'amber' : 'danger'}>
                        {photo.parentalConsentConfirmed
                          ? 'Parental Consent Checked'
                          : 'Parental Consent Unconfirmed'}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-[#16241b]">
                    {photo.caption || <span className="italic text-[#56635a]">No caption</span>}
                  </p>

                  <div className="text-xs text-[#56635a] space-y-0.5">
                    <p>
                      Uploader: <strong className="text-[#3e4c42]">{photo.uploader?.fullName || photo.uploaderId.slice(0, 8)}</strong>
                    </p>
                    <p>
                      Church: {photo.church?.name || photo.churchId}
                      {photo.album?.title ? ` · Album: ${photo.album.title}` : ''}
                    </p>
                    <p>Uploaded {formatDateTime(photo.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#e4dfd3]">
                    <Button
                      variant="emerald"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setApproveTarget(photo);
                        setMoveToAlbumId(photo.albumId || '');
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      onClick={() => setRejectTarget(photo)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <Select
                value={selectedChurchId}
                onChange={(e) => setSelectedChurchId(e.target.value)}
                disabled={!isPlatformAdmin && churches.length <= 1}
              >
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.lga})
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" size="sm" onClick={() => setAlbumModalOpen(true)}>
              <FolderPlus className="h-4 w-4" />
              New Church Album
            </Button>
          </Card>

          {albums.length === 0 ? (
            <EmptyState
              icon={<Images className="h-6 w-6" />}
              title="No albums for this congregation"
              description="Create an album to organize worship services, synod thanksgiving, and outreach photography."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <Card key={album.id} className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#16241b]">{album.title}</h3>
                    <Badge tone="neutral">{album._count?.photos ?? 0} photos</Badge>
                  </div>
                  {album.description && (
                    <p className="text-xs text-[#56635a] line-clamp-2">{album.description}</p>
                  )}
                  <div className="pt-2 text-[11px] text-[#56635a] flex items-center justify-between border-t border-[#ece7dc]">
                    <span>{album.eventName || 'General Album'}</span>
                    <span>{album.eventDate ? formatDate(album.eventDate) : ''}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approve Photo Modal (supports moving to album — GAL-04) */}
      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Approve Gallery Photo"
        description={
          approveTarget?.hasMinors
            ? 'Safeguarding reminder: Confirm caption contains no minor names and parental consent is satisfied.'
            : 'Optionally assign or move this photo into a church album.'
        }
      >
        <form onSubmit={handleApprovePhoto} className="space-y-4">
          <div>
            <FieldLabel hint="Optional">Move to Album</FieldLabel>
            <Select
              value={moveToAlbumId}
              onChange={(e) => setMoveToAlbumId(e.target.value)}
            >
              <option value="">Keep current album assignment</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" loading={submitting}>
              Approve &amp; Publish
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Photo Modal */}
      <ReasonModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Gallery Photo"
        description="Provide a reason (e.g. missing parental consent, caption names a minor, low quality)."
        confirmLabel="Reject Photo"
        onConfirm={handleRejectPhoto}
      />

      {/* Create Album Modal */}
      <Modal
        open={albumModalOpen}
        onClose={() => setAlbumModalOpen(false)}
        title="Create Gallery Album"
        description="Create a new photo album for the selected church gallery."
      >
        <form onSubmit={handleCreateAlbum} className="space-y-4">
          <div>
            <FieldLabel required>Album Title</FieldLabel>
            <Input
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="e.g. 2026 Annual Synod Thanksgiving"
              required
            />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              placeholder="Brief summary of the album..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Event Name</FieldLabel>
              <Input
                value={albumEventName}
                onChange={(e) => setAlbumEventName(e.target.value)}
                placeholder="e.g. Harvest Thanksgiving"
              />
            </div>
            <div>
              <FieldLabel>Event Date</FieldLabel>
              <Input
                type="date"
                value={albumEventDate}
                onChange={(e) => setAlbumEventDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAlbumModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create Album
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
