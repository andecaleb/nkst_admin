'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Shield,
  UserX,
  UserCheck,
  Plus,
  Trash2,
  EyeOff,
  Eye,
  KeyRound,
  FileSpreadsheet,
  Users,
  RefreshCw,
  SlidersHorizontal,
  Info,
  ChevronLeft,
  ChevronRight,
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
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime, formatEnumLabel, isValidUuid } from '@/lib/format';
import type {
  ChurchRecord,
  MemberProfile,
  MemberRoleAssignment,
  PaginationMeta,
  PermissionDefinition,
  RoleDefinition,
  VerificationRequestRecord,
  VerificationState,
} from '@/types/api';

interface MemberDirectoryRow {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  churchId: string;
  churchName: string;
  positionInChurch: string;
  positionTone: 'gold' | 'emerald' | 'amber' | 'neutral';
  verificationState: VerificationState;
  profileVisibility: 'public' | 'private';
}

interface MemberDetailResponse {
  profile: MemberProfile;
  community?: {
    posts?: unknown[];
    groups?: Array<{ id: string; name: string }>;
    resources?: unknown[];
  };
}

function derivePosition(
  profile: Partial<MemberProfile>,
  administeredChurchMap: Set<string>,
  roleNames: string[] = [],
): { label: string; tone: 'gold' | 'emerald' | 'amber' | 'neutral' } {
  if (profile.churchPosition && profile.churchPosition.trim()) {
    return { label: profile.churchPosition.trim(), tone: 'gold' };
  }
  const roles = new Set([...(profile.roles || []), ...roleNames]);
  if (profile.isPlatformAdmin || roles.has('PLATFORM_ADMIN')) {
    return { label: 'Platform Admin (HQ)', tone: 'gold' };
  }
  if ((profile.id && administeredChurchMap.has(profile.id)) || roles.has('CHURCH_ADMIN')) {
    return { label: 'Church Admin', tone: 'gold' };
  }
  if (roles.has('GROUP_ADMIN')) {
    return { label: 'Group Admin', tone: 'amber' };
  }
  return { label: 'Congregation Member', tone: 'neutral' };
}

export default function MembersRbacPage() {
  const { isPlatformAdmin, member: currentMember } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'directory' | 'matrix'>('directory');

  // Directory state
  const [directoryRows, setDirectoryRows] = useState<MemberDirectoryRow[]>([]);
  const [usingFallbackDirectory, setUsingFallbackDirectory] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Partial<PaginationMeta>>({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [churchFilter, setChurchFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<VerificationState | ''>('');
  const [uuidLookup, setUuidLookup] = useState('');

  // Inspected Member modal
  const [inspectOpen, setInspectOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [inspected, setInspected] = useState<MemberDetailResponse | null>(null);
  const [memberRoles, setMemberRoles] = useState<MemberRoleAssignment[]>([]);

  // Suspend modal
  const [suspendOpen, setSuspendOpen] = useState(false);

  // Assign role modal (Platform Admin)
  const [assignOpen, setAssignOpen] = useState(false);
  const [roleName, setRoleName] = useState('CHURCH_ADMIN');
  const [roleChurchId, setRoleChurchId] = useState('');
  const [roleGroupId, setRoleGroupId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // RBAC Matrix & reference data
  const [rolesList, setRolesList] = useState<RoleDefinition[]>([]);
  const [permissionsList, setPermissionsList] = useState<PermissionDefinition[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(true);

  const loadData = useCallback(async () => {
    setLoadingDirectory(true);
    setLoadingMatrix(true);

    try {
      const [rolesRes, permsRes, churchesRes] = await Promise.all([
        api.get<RoleDefinition[]>('/roles'),
        api.get<PermissionDefinition[]>('/roles/permissions'),
        api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 }),
      ]);

      const churchesList = Array.isArray(churchesRes.data) ? churchesRes.data : [];
      setRolesList(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setPermissionsList(Array.isArray(permsRes.data) ? permsRes.data : []);
      setChurches(churchesList);
      setLoadingMatrix(false);

      const churchNameById = new Map<string, string>();
      const churchAdminMemberIds = new Set<string>();
      churchesList.forEach((c) => {
        churchNameById.set(c.id, c.name);
        if (c.adminMemberId) churchAdminMemberIds.add(c.adminMemberId);
      });

      // Attempt primary paginated directory endpoint: GET /api/v1/members
      try {
        const membersRes = await api.get<MemberProfile[]>('/members', {
          search: search.trim() || undefined,
          churchId: churchFilter || undefined,
          verificationState: stateFilter || undefined,
          page,
          limit: 25,
        });
        const list = Array.isArray(membersRes.data) ? membersRes.data : [];
        const mapped: MemberDirectoryRow[] = list.map((m) => {
          const pos = derivePosition(m, churchAdminMemberIds);
          return {
            id: m.id,
            fullName: m.fullName,
            email: m.email,
            phone: m.phone,
            churchId: m.churchId,
            churchName: m.church?.name || churchNameById.get(m.churchId) || '—',
            positionInChurch: pos.label,
            positionTone: pos.tone,
            verificationState: m.verificationState,
            profileVisibility: m.profileVisibility,
          };
        });
        setDirectoryRows(mapped);
        setPagination(membersRes.meta || { page: 1, totalPages: 1, total: mapped.length });
        setUsingFallbackDirectory(false);
      } catch (err) {
        // Fallback if backend does not yet expose GET /api/v1/members:
        // Aggregate known members from signed-in admin, church admins, and verification queue.
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setUsingFallbackDirectory(true);
          const collected = new Map<string, MemberDirectoryRow>();

          if (currentMember) {
            const pos = derivePosition(currentMember, churchAdminMemberIds);
            collected.set(currentMember.id, {
              id: currentMember.id,
              fullName: currentMember.fullName,
              email: currentMember.email,
              phone: currentMember.phone,
              churchId: currentMember.churchId,
              churchName:
                currentMember.church?.name ||
                churchNameById.get(currentMember.churchId) ||
                '—',
              positionInChurch: pos.label,
              positionTone: pos.tone,
              verificationState: currentMember.verificationState,
              profileVisibility: currentMember.profileVisibility,
            });
          }

          // Include assigned Church Admins from the churches directory
          churchesList.forEach((c) => {
            if (c.adminMember && c.adminMemberId && !collected.has(c.adminMemberId)) {
              const adminName =
                'fullName' in c.adminMember
                  ? c.adminMember.fullName
                  : `${c.adminMember.firstName} ${c.adminMember.surname}`;
              collected.set(c.adminMemberId, {
                id: c.adminMemberId,
                fullName: adminName,
                churchId: c.id,
                churchName: c.name,
                positionInChurch: c.isHeadquarters ? 'Platform Admin (HQ)' : 'Church Admin',
                positionTone: 'gold',
                verificationState: 'verified',
                profileVisibility:
                  'profileVisibility' in c.adminMember
                    ? c.adminMember.profileVisibility
                    : 'public',
              });
            }
          });

          // Include members from the pending verification queue
          try {
            const queueRes = await api.get<VerificationRequestRecord[]>('/verification/queue');
            const queue = Array.isArray(queueRes.data) ? queueRes.data : [];
            queue.forEach((req) => {
              if (req.member && !collected.has(req.memberId)) {
                const m = req.member;
                const pos = derivePosition(m, churchAdminMemberIds);
                collected.set(req.memberId, {
                  id: req.memberId,
                  fullName: m.fullName,
                  email: 'email' in m ? m.email : undefined,
                  phone: 'phone' in m ? m.phone : undefined,
                  churchId: req.churchId,
                  churchName:
                    req.church?.name || churchNameById.get(req.churchId) || '—',
                  positionInChurch: pos.label,
                  positionTone: pos.tone,
                  verificationState:
                    'verificationState' in m ? m.verificationState : 'pending_verification',
                  profileVisibility: m.profileVisibility,
                });
              }
            });
          } catch {
            // Non-blocking
          }

          const arr = Array.from(collected.values());
          setDirectoryRows(arr);
          setPagination({ page: 1, totalPages: 1, total: arr.length });
        } else {
          toast.error(
            'Failed to load members directory',
            err instanceof ApiError ? err.message : undefined,
          );
        }
      }
    } catch (err) {
      toast.error(
        'Failed to load RBAC catalog',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoadingDirectory(false);
      setLoadingMatrix(false);
    }
  }, [search, churchFilter, stateFilter, page, currentMember, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleRows = useMemo(() => {
    return directoryRows.filter((row) => {
      if (churchFilter && row.churchId !== churchFilter) return false;
      if (stateFilter && row.verificationState !== stateFilter) return false;
      if (positionFilter && row.positionInChurch !== positionFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${row.fullName} ${row.email || ''} ${row.phone || ''} ${row.churchName} ${row.positionInChurch}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [directoryRows, churchFilter, stateFilter, positionFilter, search]);

  const distinctPositions = useMemo(() => {
    const set = new Set<string>([
      'Platform Admin (HQ)',
      'Church Admin',
      'Group Admin',
      'Congregation Member',
    ]);
    directoryRows.forEach((r) => set.add(r.positionInChurch));
    return Array.from(set);
  }, [directoryRows]);

  const inspectMember = useCallback(
    async (id: string) => {
      if (!isValidUuid(id)) {
        toast.warning('Invalid Member UUID', 'Enter a valid UUID to look up a member.');
        return;
      }
      setInspectOpen(true);
      setSearching(true);
      try {
        const [profileRes, rolesRes] = await Promise.all([
          api.get<MemberDetailResponse>(`/members/${id.trim()}`),
          api.get<MemberRoleAssignment[]>(`/roles/member/${id.trim()}`),
        ]);
        setInspected(profileRes.data);
        const rList = Array.isArray(rolesRes.data) ? rolesRes.data : [];
        setMemberRoles(rList);

        // Also add/update this member in the table if using fallback directory
        if (profileRes.data?.profile) {
          const p = profileRes.data.profile;
          const adminIds = new Set(
            churches.map((c) => c.adminMemberId).filter((x): x is string => Boolean(x)),
          );
          const pos = derivePosition(
            p,
            adminIds,
            rList.map((r) => r.role?.name).filter(Boolean),
          );
          setDirectoryRows((prev) => {
            const exists = prev.some((row) => row.id === p.id);
            const nextRow: MemberDirectoryRow = {
              id: p.id,
              fullName: p.fullName,
              email: p.email,
              phone: p.phone,
              churchId: p.churchId,
              churchName: p.church?.name || '—',
              positionInChurch: pos.label,
              positionTone: pos.tone,
              verificationState: p.verificationState,
              profileVisibility: p.profileVisibility,
            };
            return exists
              ? prev.map((row) => (row.id === p.id ? nextRow : row))
              : [nextRow, ...prev];
          });
        }
      } catch (err) {
        setInspected(null);
        setMemberRoles([]);
        setInspectOpen(false);
        toast.error('Member lookup failed', err instanceof ApiError ? err.message : undefined);
      } finally {
        setSearching(false);
      }
    },
    [churches, toast],
  );

  const handleUuidLookup = (e: React.FormEvent) => {
    e.preventDefault();
    inspectMember(uuidLookup);
  };

  const handleSuspend = async (reason: string) => {
    if (!inspected) return;
    try {
      await api.patch(`/members/${inspected.profile.id}/suspend`, { reason });
      toast.success('Member suspended', 'Account is now read-only.');
      await inspectMember(inspected.profile.id);
    } catch (err) {
      toast.error('Suspension failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleReinstate = async () => {
    if (!inspected) return;
    try {
      await api.patch(`/members/${inspected.profile.id}/reinstate`);
      toast.success('Member reinstated', 'Account privileges have been restored.');
      await inspectMember(inspected.profile.id);
    } catch (err) {
      toast.error('Reinstatement failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspected) return;
    setAssigning(true);
    try {
      await api.post(`/roles/member/${inspected.profile.id}`, {
        roleName,
        churchId: roleChurchId || undefined,
        groupId: roleGroupId.trim() || undefined,
      });
      toast.success('Role assigned', `${roleName} assigned to ${inspected.profile.fullName}.`);
      setAssignOpen(false);
      setRoleChurchId('');
      setRoleGroupId('');
      await inspectMember(inspected.profile.id);
    } catch (err) {
      toast.error('Role assignment failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setAssigning(false);
    }
  };

  const handleRevokeRole = async (assignmentId: string) => {
    if (!inspected) return;
    try {
      await api.delete(`/roles/assignment/${assignmentId}`);
      toast.success('Role assignment revoked');
      await inspectMember(inspected.profile.id);
    } catch (err) {
      toast.error('Revocation failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members & RBAC"
        description="Browse all NKST members with their church affiliation and position in the church. Click any member to inspect governance details, suspend/reinstate, or manage RBAC roles."
        badge={<Badge tone="gold">{pagination.total ?? visibleRows.length} Members</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/members/import">
              <Button variant="primary" size="sm">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import from Excel
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={loadData} loading={loadingDirectory}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'directory'
                    ? 'bg-[#0a542d] text-white'
                    : 'text-[#3e4c42] hover:text-[#16241b]'
                }`}
              >
                All Members
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-[#0a542d] text-white'
                    : 'text-[#3e4c42] hover:text-[#16241b]'
                }`}
              >
                Roles &amp; Permissions Matrix
              </button>
            </div>
          </div>
        }
      />

      {activeTab === 'directory' ? (
        <>
          {usingFallbackDirectory && (
            <div className="flex items-start gap-3 rounded-xl border border-[#d48a1f]/35 bg-[#fef6e6] px-4 py-3 text-xs text-[#9b5f0d]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d48a1f]" />
              <p>
                <strong>Showing discovered members:</strong> The backend does not yet expose a
                paginated <code className="font-mono font-semibold">GET /api/v1/members</code>{' '}
                directory endpoint, so this table currently aggregates Church Admins, Verification
                Queue members, and members inspected by UUID below.
              </p>
            </div>
          )}

          {/* Filters + Quick UUID Lookup */}
          <Card className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, phone, email..."
                  className="pl-9"
                />
              </div>
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
              <Select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <option value="">All Church Positions</option>
                {distinctPositions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </Select>
              <Select
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value as VerificationState | '');
                  setPage(1);
                }}
              >
                <option value="">All Verification States</option>
                <option value="verified">Verified</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="registered">Registered</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>

            <form
              onSubmit={handleUuidLookup}
              className="flex flex-col gap-2 border-t border-[#ece7dc] pt-3 sm:flex-row"
            >
              <Input
                value={uuidLookup}
                onChange={(e) => setUuidLookup(e.target.value)}
                placeholder="Direct lookup by Member UUID (adds to table & opens RBAC panel)..."
                className="text-xs py-1.5"
              />
              <Button type="submit" variant="secondary" size="sm" loading={searching}>
                <Search className="h-3.5 w-3.5" />
                Lookup UUID
              </Button>
            </form>
          </Card>

          {/* All Members DataTable */}
          {loadingDirectory ? (
            <LoadingRows count={6} />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No members match your filters"
              description="Adjust your search or filters, import members from Excel, or look up a member by UUID above."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                      <th className="px-4 py-3.5">Member</th>
                      <th className="px-4 py-3.5">Church / Congregation</th>
                      <th className="px-4 py-3.5">Position in Church</th>
                      <th className="px-4 py-3.5">Verification Status</th>
                      <th className="px-4 py-3.5">Privacy</th>
                      <th className="px-4 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece7dc]">
                    {visibleRows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#faf7f0] transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-[#16241b]">{row.fullName}</p>
                          <p className="mt-0.5 text-[11px] text-[#56635a]">
                            {row.phone || row.email || (
                              <span className="font-mono text-[10px] text-[#6c7870]">
                                {row.id.slice(0, 12)}…
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-[#3e4c42] font-medium">
                          {row.churchName}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={row.positionTone}>
                            <Shield className="h-3 w-3" />
                            {row.positionInChurch}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={statusTone(row.verificationState)}>
                            {formatEnumLabel(row.verificationState)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#56635a]">
                            {row.profileVisibility === 'private' ? (
                              <EyeOff className="h-3.5 w-3.5 text-[#a96910]" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-[#0a542d]" />
                            )}
                            {formatEnumLabel(row.profileVisibility)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => inspectMember(row.id)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-[#0a542d]" />
                            Inspect &amp; RBAC
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(pagination.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-between border-t border-[#e4dfd3] bg-[#faf7f0] px-4 py-3 text-xs text-[#56635a]">
                  <span>
                    Page <strong className="text-[#16241b]">{pagination.page ?? page}</strong> of{' '}
                    <strong className="text-[#16241b]">{pagination.totalPages ?? 1}</strong> ·{' '}
                    {pagination.total ?? visibleRows.length} members
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.hasPreviousPage}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.hasNextPage}
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
        </>
      ) : loadingMatrix ? (
        <LoadingRows count={4} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-[#16241b] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#0a542d]" />
              Functional Roles ({rolesList.length})
            </h2>
            <div className="mt-4 space-y-3">
              {rolesList.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#e4dfd3] bg-[#faf7f0] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge tone={statusTone(r.name)}>{r.name}</Badge>
                    <span className="text-[11px] text-[#56635a]">
                      {r.permissions?.length ?? 0} permissions
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-xs text-[#3e4c42]">{r.description}</p>
                  )}
                  {r.permissions && r.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.permissions.map((rp) => (
                        <span
                          key={rp.permission.id}
                          className="rounded bg-[#f2ede2] px-2 py-0.5 font-mono text-[10px] text-[#56635a]"
                        >
                          {rp.permission.code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-[#16241b] flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#0a542d]" />
              Seeded Permissions ({permissionsList.length})
            </h2>
            <div className="mt-4 space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {permissionsList.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#ece7dc] bg-[#faf7f0] px-3.5 py-2.5"
                >
                  <span className="font-mono text-xs text-[#9b5f0d]">{p.code}</span>
                  <span className="text-right text-xs text-[#56635a]">
                    {p.description || '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Member Inspector & RBAC Modal */}
      <Modal
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        title={inspected?.profile.fullName || 'Inspect Member'}
        description="Unmasked governance profile, suspension controls, and RBAC role assignments."
        maxWidth="max-w-2xl"
      >
        {searching || !inspected ? (
          <LoadingRows count={3} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4dfd3] pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(inspected.profile.verificationState)}>
                  {formatEnumLabel(inspected.profile.verificationState)}
                </Badge>
                <Badge
                  tone={inspected.profile.profileVisibility === 'private' ? 'amber' : 'neutral'}
                >
                  {inspected.profile.profileVisibility === 'private' ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {formatEnumLabel(inspected.profile.profileVisibility)} Profile
                </Badge>
              </div>
              {inspected.profile.verificationState === 'suspended' ? (
                <Button variant="emerald" size="sm" onClick={handleReinstate}>
                  <UserCheck className="h-3.5 w-3.5" />
                  Reinstate Account
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setSuspendOpen(true)}>
                  <UserX className="h-3.5 w-3.5" />
                  Suspend Account
                </Button>
              )}
            </div>

            {inspected.profile.suspensionReason && (
              <div className="rounded-xl border border-[#b83227]/30 bg-[#fdeceb] px-4 py-3 text-xs text-[#9c261d]">
                <strong>Suspension Reason:</strong> {inspected.profile.suspensionReason}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-[#56635a]">Congregation</p>
                <p className="mt-0.5 font-medium text-[#16241b]">
                  {inspected.profile.church?.name || inspected.profile.churchId}
                </p>
              </div>
              <div>
                <p className="text-[#56635a]">Email</p>
                <p className="mt-0.5 font-medium text-[#16241b]">
                  {inspected.profile.email || 'Masked (Private)'}
                </p>
              </div>
              <div>
                <p className="text-[#56635a]">Phone</p>
                <p className="mt-0.5 font-medium text-[#16241b]">
                  {inspected.profile.phone || 'Masked (Private)'}
                </p>
              </div>
              <div>
                <p className="text-[#56635a]">Gender &amp; Date of Birth</p>
                <p className="mt-0.5 font-medium text-[#16241b]">
                  {formatEnumLabel(inspected.profile.gender)} ·{' '}
                  {inspected.profile.dateOfBirth
                    ? formatDate(inspected.profile.dateOfBirth)
                    : 'Masked'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[#56635a]">Location</p>
                <p className="mt-0.5 font-medium text-[#16241b]">
                  {[
                    inspected.profile.residentialLocation,
                    inspected.profile.lga,
                    inspected.profile.state,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
            </div>

            {/* RBAC Roles Section */}
            <div className="border-t border-[#e4dfd3] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#063b20]">
                  Role Assignments ({memberRoles.length})
                </h3>
                {isPlatformAdmin && (
                  <Button variant="primary" size="sm" onClick={() => setAssignOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Assign Role
                  </Button>
                )}
              </div>

              {memberRoles.length === 0 ? (
                <p className="text-xs text-[#56635a]">No explicit role rows assigned.</p>
              ) : (
                <div className="space-y-2">
                  {memberRoles.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <Badge tone={statusTone(assignment.role?.name)}>
                          {assignment.role?.name}
                        </Badge>
                        <p className="mt-1 text-[11px] text-[#56635a]">
                          Assigned {formatDateTime(assignment.createdAt)}
                        </p>
                      </div>
                      {isPlatformAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRevokeRole(assignment.id)}
                          className="rounded-md p-1.5 text-[#56635a] hover:bg-[#fdeceb] hover:text-[#9c261d] cursor-pointer"
                          title="Revoke role assignment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Suspend Member Modal (Mandatory Reason — VER-08) */}
      <ReasonModal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="Suspend Member Account"
        description={`Suspending ${inspected?.profile.fullName || 'this member'} places their account in read-only mode. Suspension is reversible and logged.`}
        confirmLabel="Suspend Account"
        confirmVariant="danger"
        reasonLabel="Suspension Reason"
        reasonPlaceholder="e.g. Repeated violation of community posting guidelines"
        onConfirm={handleSuspend}
      />

      {/* Assign Role Modal (Platform Admin) */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Functional Role"
        description={`Grant a role assignment to ${inspected?.profile.fullName || 'this member'}.`}
      >
        <form onSubmit={handleAssignRole} className="space-y-4">
          <div>
            <FieldLabel required>Role Name</FieldLabel>
            <Select value={roleName} onChange={(e) => setRoleName(e.target.value)}>
              {rolesList.length > 0 ? (
                rolesList.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                  <option value="CHURCH_ADMIN">CHURCH_ADMIN</option>
                  <option value="GROUP_ADMIN">GROUP_ADMIN</option>
                  <option value="MEMBER">MEMBER</option>
                </>
              )}
            </Select>
          </div>
          <div>
            <FieldLabel hint="Optional church scope">Church Scope</FieldLabel>
            <Select value={roleChurchId} onChange={(e) => setRoleChurchId(e.target.value)}>
              <option value="">None (Global / Unscoped)</option>
              {churches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.state})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel hint="Optional group UUID">Group Scope UUID</FieldLabel>
            <Input
              value={roleGroupId}
              onChange={(e) => setRoleGroupId(e.target.value)}
              placeholder="UUID of target group (for GROUP_ADMIN)"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={assigning}>
              Assign Role
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
