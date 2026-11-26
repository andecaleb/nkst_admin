'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  UsersRound,
  Plus,
  Search,
  RefreshCw,
  UserPlus,
  Shield,
  Trash2,
  CheckCircle2,
  XCircle,
  Settings2,
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
import { formatDateTime, formatEnumLabel, isValidUuid } from '@/lib/format';
import type {
  ChurchRecord,
  GenderRestriction,
  GroupJoinMode,
  GroupJoinRequestRecord,
  GroupMemberRecord,
  GroupRecord,
  GroupScope,
  GroupVisibility,
} from '@/types/api';

export default function GroupsAdminPage() {
  const { isPlatformAdmin, isChurchAdmin, member } = useAuth();
  const canCreateGroups = isPlatformAdmin || isChurchAdmin;
  const toast = useToast();

  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<GroupScope | ''>('');
  const [visibilityFilter, setVisibilityFilter] = useState<GroupVisibility | ''>('');

  // Create Group modal
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<GroupScope>('church');
  const [churchId, setChurchId] = useState(member?.churchId || '');
  const [visibility, setVisibility] = useState<GroupVisibility>('public');
  const [joinMode, setJoinMode] = useState<GroupJoinMode>('open');
  const [genderRestriction, setGenderRestriction] = useState<GenderRestriction>('any');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Manage Group modal
  const [selectedGroup, setSelectedGroup] = useState<GroupRecord | null>(null);
  const [manageTab, setManageTab] = useState<'requests' | 'members' | 'invite'>('requests');
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequestRecord[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMemberRecord[]>([]);
  const [inviteMemberId, setInviteMemberId] = useState('');
  const [loadingManage, setLoadingManage] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, churchesRes] = await Promise.all([
        api.get<GroupRecord[]>('/groups', {
          search: search.trim() || undefined,
          scope: scopeFilter || undefined,
          visibility: visibilityFilter || undefined,
        }),
        canCreateGroups
          ? api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 })
          : Promise.resolve({ data: [] as ChurchRecord[] }),
      ]);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      if (Array.isArray(churchesRes.data)) {
        setChurches(churchesRes.data);
      }
    } catch (err) {
      toast.error('Failed to load groups', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [search, scopeFilter, visibilityFilter, canCreateGroups, toast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const loadGroupDetails = useCallback(
    async (group: GroupRecord) => {
      setLoadingManage(true);
      try {
        const [membersRes, reqsRes] = await Promise.all([
          api.get<GroupMemberRecord[]>(`/groups/${group.id}/members`),
          api
            .get<GroupJoinRequestRecord[]>(`/groups/${group.id}/requests`)
            .catch(() => ({ data: [] as GroupJoinRequestRecord[] })),
        ]);
        setGroupMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
        setJoinRequests(Array.isArray(reqsRes.data) ? reqsRes.data : []);
      } catch (err) {
        toast.error(
          'Failed to load group details',
          err instanceof ApiError ? err.message : undefined,
        );
      } finally {
        setLoadingManage(false);
      }
    },
    [toast],
  );

  const openManage = (group: GroupRecord) => {
    setSelectedGroup(group);
    setManageTab('requests');
    loadGroupDetails(group);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/groups', {
        name: name.trim(),
        description: description.trim(),
        scope: isPlatformAdmin ? scope : 'church',
        churchId: scope === 'church' ? churchId || member?.churchId : undefined,
        visibility,
        joinMode: visibility === 'private' ? 'approval' : joinMode,
        genderRestriction,
        minAge: minAge ? Number(minAge) : undefined,
        maxAge: maxAge ? Number(maxAge) : undefined,
        verifiedOnly,
      });
      toast.success('Group created');
      setCreateOpen(false);
      setName('');
      setDescription('');
      setMinAge('');
      setMaxAge('');
      loadGroups();
    } catch (err) {
      toast.error('Failed to create group', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinDecision = async (requestId: string, decision: 'approve' | 'reject') => {
    if (!selectedGroup) return;
    try {
      await api.patch(`/groups/${selectedGroup.id}/requests/${requestId}`, { decision });
      toast.success(`Join request ${decision === 'approve' ? 'approved' : 'rejected'}`);
      loadGroupDetails(selectedGroup);
    } catch (err) {
      toast.error('Decision failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handlePromote = async (memberId: string) => {
    if (!selectedGroup) return;
    try {
      await api.patch(`/groups/${selectedGroup.id}/members/${memberId}/promote`);
      toast.success('Member promoted to GROUP_ADMIN');
      loadGroupDetails(selectedGroup);
    } catch (err) {
      toast.error('Promotion failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroup) return;
    try {
      await api.delete(`/groups/${selectedGroup.id}/members/${memberId}`);
      toast.success('Member removed from group');
      loadGroupDetails(selectedGroup);
    } catch (err) {
      toast.error('Removal failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !isValidUuid(inviteMemberId)) {
      toast.warning('Enter a valid Member UUID');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/groups/${selectedGroup.id}/invite`, {
        memberId: inviteMemberId.trim(),
      });
      toast.success('Invitation sent');
      setInviteMemberId('');
      loadGroupDetails(selectedGroup);
    } catch (err) {
      toast.error('Invitation failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups Administration"
        description="Create church or national groups with gender, age, and verification eligibility rules; review join requests, invite eligible members, and promote Group Admins."
        badge={<Badge tone="gold">{groups.length} Groups</Badge>}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={loadGroups} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {canCreateGroups && (
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups..."
              className="pl-9"
            />
          </div>
          <Select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as GroupScope | '')}
          >
            <option value="">All Scopes</option>
            <option value="church">Church Scoped</option>
            <option value="national">National Scoped</option>
          </Select>
          <Select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value as GroupVisibility | '')}
          >
            <option value="">Public &amp; Private</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingRows count={4} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title="No groups found"
          description="Create a church fellowship or national ministry group to get started."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id} className="p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-[#16241b]">{g.name}</h3>
                  <Badge tone="gold">{formatEnumLabel(g.scope)}</Badge>
                  <Badge tone={g.visibility === 'private' ? 'amber' : 'emerald'}>
                    {formatEnumLabel(g.visibility)}
                  </Badge>
                  <Badge tone="neutral">{formatEnumLabel(g.joinMode)}</Badge>
                </div>

                <p className="text-xs text-[#3e4c42] line-clamp-2">{g.description}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {g.verifiedOnly && <Badge tone="emerald">Verified Only</Badge>}
                  {g.genderRestriction !== 'any' && (
                    <Badge tone="neutral">
                      Gender: {formatEnumLabel(g.genderRestriction)}
                    </Badge>
                  )}
                  {(g.minAge != null || g.maxAge != null) && (
                    <Badge tone="neutral">
                      Age: {g.minAge ?? 0} – {g.maxAge ?? '∞'}
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-[#56635a]">
                  {g.church?.name ? `Church: ${g.church.name}` : 'National NKST Group'} ·{' '}
                  {g._count?.members ?? 0} members
                </p>
              </div>

              <div className="flex justify-end border-t border-[#e4dfd3] pt-3">
                <Button variant="secondary" size="sm" onClick={() => openManage(g)}>
                  <Settings2 className="h-3.5 w-3.5 text-[#0a542d]" />
                  Manage Requests &amp; Members
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Group"
        description="Configure scope, visibility, and server-enforced member eligibility rules (GRP-02)."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <FieldLabel required>Group Name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NKST Mkar Youth Fellowship"
              required
            />
          </div>
          <div>
            <FieldLabel required>Description</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fellowship and Bible study for young adults..."
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>Scope</FieldLabel>
              <Select
                value={scope}
                onChange={(e) => setScope(e.target.value as GroupScope)}
                disabled={!isPlatformAdmin}
              >
                <option value="church">Church Scoped</option>
                {isPlatformAdmin && <option value="national">National (Platform-wide)</option>}
              </Select>
            </div>
            {scope === 'church' && (
              <div>
                <FieldLabel required>Church</FieldLabel>
                <Select
                  value={churchId}
                  onChange={(e) => setChurchId(e.target.value)}
                  required
                >
                  <option value="">Select Church</option>
                  {churches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>Visibility</FieldLabel>
              <Select
                value={visibility}
                onChange={(e) => {
                  const v = e.target.value as GroupVisibility;
                  setVisibility(v);
                  if (v === 'private') setJoinMode('approval');
                }}
              >
                <option value="public">Public</option>
                <option value="private">Private (Approval Required)</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Join Mode</FieldLabel>
              <Select
                value={visibility === 'private' ? 'approval' : joinMode}
                onChange={(e) => setJoinMode(e.target.value as GroupJoinMode)}
                disabled={visibility === 'private'}
              >
                <option value="open">Open (Auto-join if eligible)</option>
                <option value="approval">Approval Required</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel>Gender</FieldLabel>
              <Select
                value={genderRestriction}
                onChange={(e) => setGenderRestriction(e.target.value as GenderRestriction)}
              >
                <option value="any">Any</option>
                <option value="male">Male Only</option>
                <option value="female">Female Only</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Min Age</FieldLabel>
              <Input
                type="number"
                min={0}
                max={120}
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                placeholder="18"
              />
            </div>
            <div>
              <FieldLabel>Max Age</FieldLabel>
              <Input
                type="number"
                min={0}
                max={120}
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                placeholder="35"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#16241b] cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-4 w-4 rounded accent-[#0a542d]"
            />
            Verified NKST members only
          </label>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Group Modal */}
      <Modal
        open={Boolean(selectedGroup)}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup?.name || 'Manage Group'}
        description="Approve join requests, invite eligible members, and manage Group Admins."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-1">
            {(['requests', 'members', 'invite'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setManageTab(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium cursor-pointer ${
                  manageTab === t ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                {t === 'requests'
                  ? `Join Requests (${joinRequests.length})`
                  : t === 'members'
                    ? `Members (${groupMembers.length})`
                    : 'Invite Member'}
              </button>
            ))}
          </div>

          {loadingManage ? (
            <LoadingRows count={3} />
          ) : manageTab === 'requests' ? (
            joinRequests.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#56635a]">
                No pending join requests for this group.
              </p>
            ) : (
              <div className="space-y-2.5">
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3"
                  >
                    <div>
                      <p className="text-xs font-medium text-[#16241b]">
                        {req.member?.fullName || req.memberId}
                      </p>
                      <p className="text-[11px] text-[#56635a]">
                        Requested {formatDateTime(req.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="emerald"
                        size="sm"
                        onClick={() => handleJoinDecision(req.id, 'approve')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleJoinDecision(req.id, 'reject')}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : manageTab === 'members' ? (
            groupMembers.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#56635a]">No members yet.</p>
            ) : (
              <div className="space-y-2">
                {groupMembers.map((gm) => (
                  <div
                    key={gm.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#16241b]">
                        {gm.member?.fullName || gm.memberId}
                      </span>
                      <Badge tone={statusTone(gm.role === 'admin' ? 'GROUP_ADMIN' : 'neutral')}>
                        {gm.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {gm.role !== 'admin' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePromote(gm.memberId)}
                        >
                          <Shield className="h-3 w-3 text-[#0a542d]" />
                          Promote
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveMember(gm.memberId)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <FieldLabel required>Eligible Member UUID</FieldLabel>
                <Input
                  value={inviteMemberId}
                  onChange={(e) => setInviteMemberId(e.target.value)}
                  placeholder="UUID of member to invite (server verifies eligibility)"
                  required
                />
              </div>
              <Button type="submit" variant="primary" loading={submitting}>
                <UserPlus className="h-4 w-4" />
                Send Group Invitation
              </Button>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
