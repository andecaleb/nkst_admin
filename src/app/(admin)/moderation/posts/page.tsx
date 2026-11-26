'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  History,
  RefreshCw,
  Paperclip,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingRows,
  Modal,
  PageHeader,
  ReasonModal,
  Select,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatEnumLabel } from '@/lib/format';
import type {
  ModerationActionEntry,
  PostCategory,
  PostRecord,
  PostType,
} from '@/types/api';

export default function PostsModerationPage() {
  const { isPlatformAdmin, isChurchAdmin, administeredChurchIds, scopedChurchId } = useAuth();
  const toast = useToast();

  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [category, setCategory] = useState<PostCategory | ''>('');
  const [type, setType] = useState<PostType | ''>('');
  const [loading, setLoading] = useState(true);

  const [rejectTarget, setRejectTarget] = useState<PostRecord | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<PostRecord | null>(null);
  const [historyPost, setHistoryPost] = useState<PostRecord | null>(null);
  const [historyItems, setHistoryItems] = useState<ModerationActionEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PostRecord[]>('/posts/moderation/queue', {
        category: category || undefined,
        type: type || undefined,
        churchId: !isPlatformAdmin && isChurchAdmin ? scopedChurchId : undefined,
        page: 1,
        limit: 50,
      });
      const rawPosts = Array.isArray(res.data) ? res.data : [];
      setPosts(
        isPlatformAdmin || !isChurchAdmin
          ? rawPosts
          : rawPosts.filter((p) => administeredChurchIds.includes(p.churchId)),
      );
    } catch (err) {
      toast.error(
        'Failed to load posts moderation queue',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [category, type, isPlatformAdmin, isChurchAdmin, administeredChurchIds, scopedChurchId, toast]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleApprove = async (post: PostRecord) => {
    try {
      await api.patch(`/posts/${post.id}/moderate`, { action: 'approve' });
      toast.success('Post approved', 'Now visible to its target audience.');
      loadQueue();
    } catch (err) {
      toast.error('Approval failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await api.patch(`/posts/${rejectTarget.id}/moderate`, {
        action: 'reject',
        reason,
      });
      toast.success('Post rejected', 'Author has been notified with your reason.');
      loadQueue();
    } catch (err) {
      toast.error('Rejection failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleRequestCorrection = async (reason: string) => {
    if (!correctionTarget) return;
    try {
      await api.patch(`/posts/${correctionTarget.id}/moderate`, {
        action: 'request_correction',
        reason,
      });
      toast.success('Correction requested', 'Author can edit and resubmit the post.');
      loadQueue();
    } catch (err) {
      toast.error('Action failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const openHistory = async (post: PostRecord) => {
    setHistoryPost(post);
    setLoadingHistory(true);
    try {
      const res = await api.get<ModerationActionEntry[]>(
        `/posts/${post.id}/moderation-history`,
      );
      setHistoryItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Failed to load moderation history', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posts Moderation Queue"
        description="Every member-generated post requires moderator validation before public visibility. Group posts are moderated by Group Admins; church and general posts by Church Admins."
        badge={<Badge tone="amber">{posts.length} Pending</Badge>}
        actions={
          <Button variant="secondary" size="sm" onClick={loadQueue} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as PostType | '')}
          >
            <option value="">All Post Types</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
          </Select>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as PostCategory | '')}
          >
            <option value="">All Categories</option>
            <option value="general">General</option>
            <option value="news">News</option>
            <option value="notice">Notice</option>
            <option value="advert">Advert</option>
            <option value="important">Important Information</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingRows count={4} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="h-6 w-6" />}
          title="No posts awaiting moderation"
          description="All pending posts in your moderation scope have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#16241b]">
                      {post.author?.fullName || post.authorId.slice(0, 8)}
                    </span>
                    <Badge tone="gold">{formatEnumLabel(post.category)}</Badge>
                    <Badge tone="neutral">{formatEnumLabel(post.type)}</Badge>
                    <Badge tone="neutral">Audience: {formatEnumLabel(post.audience)}</Badge>
                    <Badge tone={statusTone(post.status)}>{formatEnumLabel(post.status)}</Badge>
                  </div>

                  <p className="text-xs text-[#56635a]">
                    {post.church?.name || post.churchId} · Submitted {formatDateTime(post.createdAt)}
                  </p>

                  {post.body && (
                    <div className="rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3.5 text-sm text-[#16241b] whitespace-pre-wrap leading-relaxed">
                      {post.body}
                    </div>
                  )}

                  {post.media && post.media.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {post.media.map((m) => (
                        <a
                          key={m.id}
                          href={m.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] px-3 py-1.5 text-xs text-[#0a542d] hover:border-[#d48a1f]/45"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {m.fileName} ({m.kind})
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap shrink-0 items-center gap-2">
                  <Button variant="emerald" size="sm" onClick={() => handleApprove(post)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCorrectionTarget(post)}
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5 text-[#b83227]" />
                    Request Correction
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setRejectTarget(post)}>
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openHistory(post)}>
                    <History className="h-3.5 w-3.5" />
                    History
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ReasonModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Post"
        description="Provide a reason for rejecting this post. The author will be notified."
        confirmLabel="Reject Post"
        confirmVariant="danger"
        onConfirm={handleReject}
      />

      <ReasonModal
        open={Boolean(correctionTarget)}
        onClose={() => setCorrectionTarget(null)}
        title="Request Corrections"
        description="Tell the author what needs to be updated before this post can be approved."
        confirmLabel="Send Correction Request"
        confirmVariant="primary"
        reasonLabel="Correction Note"
        reasonPlaceholder="e.g. Please remove personal phone numbers or clarify event date."
        onConfirm={handleRequestCorrection}
      />

      <Modal
        open={Boolean(historyPost)}
        onClose={() => setHistoryPost(null)}
        title="Post Moderation History"
        description={`Audit trail for post ${historyPost?.id.slice(0, 8)}`}
      >
        {loadingHistory ? (
          <p className="text-xs text-[#56635a]">Loading history...</p>
        ) : historyItems.length === 0 ? (
          <p className="text-xs text-[#56635a]">No prior moderation actions on this post.</p>
        ) : (
          <div className="space-y-2.5">
            {historyItems.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <Badge tone={statusTone(h.action)}>{formatEnumLabel(h.action)}</Badge>
                  <span className="text-[#56635a]">{formatDateTime(h.createdAt)}</span>
                </div>
                <p className="text-[#3e4c42]">
                  Moderator:{' '}
                  {h.moderator
                    ? `${h.moderator.firstName} ${h.moderator.surname}`
                    : h.moderatorId}
                </p>
                {h.reason && <p className="text-[#56635a]">Note: {h.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
