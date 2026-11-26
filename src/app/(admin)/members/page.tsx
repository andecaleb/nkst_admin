'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  PermissionDefinition,
  RoleDefinition,
} from '@/types/api';

interface MemberDetailResponse {
  profile: MemberProfile;
  community?: {
    posts?: unknown[];
    groups?: Array<{ id: string; name: string }>;
    resources?: unknown[];
  };
}

export default function MembersRbacPage() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'lookup' | 'matrix'>('lookup');
  const [memberIdInput, setMemberIdInput] = useState('');
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

  // RBAC Matrix
  const [rolesList, setRolesList] = useState<RoleDefinition[]>([]);
  const [permissionsList, setPermissionsList] = useState<PermissionDefinition[]>([]);
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(true);

  const loadReferenceData = useCallback(async () => {
    setLoadingMatrix(true);
    try {
      const [rolesRes, permsRes, churchesRes] = await Promise.all([
        api.get<RoleDefinition[]>('/roles'),
        api.get<PermissionDefinition[]>('/roles/permissions'),
        api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 }),
      ]);
      setRolesList(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setPermissionsList(Array.isArray(permsRes.data) ? permsRes.data : []);
      setChurches(Array.isArray(churchesRes.data) ? churchesRes.data : []);
    } catch (err) {
      toast.error('Failed to load RBAC catalog', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoadingMatrix(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  const inspectMember = useCallback(
    async (id: string) => {
      if (!isValidUuid(id)) {
        toast.warning('Invalid Member UUID', 'Enter a valid UUID to look up a member.');
        return;
      }
      setSearching(true);
      try {
        const [profileRes, rolesRes] = await Promise.all([
          api.get<MemberDetailResponse>(`/members/${id.trim()}`),
          api.get<MemberRoleAssignment[]>(`/roles/member/${id.trim()}`),
        ]);
        setInspected(profileRes.data);
        setMemberRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      } catch (err) {
        setInspected(null);
        setMemberRoles([]);
        toast.error('Member lookup failed', err instanceof ApiError ? err.message : undefined);
      } finally {
        setSearching(false);
      }
    },
    [toast],
  );

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspectMember(memberIdInput);
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
        description="Inspect member profiles (with authorized governance unmasking), suspend or reinstate accounts, and manage functional role assignments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/members/import">
              <Button variant="primary" size="sm">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import from Excel
              </Button>
            </Link>
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab('lookup')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'lookup'
                    ? 'bg-[#0a542d] text-white'
                    : 'text-[#3e4c42] hover:text-[#16241b]'
                }`}
              >
                Member Inspector
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

      {activeTab === 'lookup' ? (
        <>
          <Card className="p-5">
            <form onSubmit={handleLookupSubmit} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  value={memberIdInput}
                  onChange={(e) => setMemberIdInput(e.target.value)}
                  placeholder="Enter Member UUID to inspect profile, suspension status & RBAC roles..."
                />
              </div>
              <Button type="submit" variant="primary" loading={searching}>
                <Search className="h-4 w-4" />
                Inspect Member
              </Button>
            </form>
          </Card>

          {!inspected ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Look up a member by UUID"
              description="Paste a Member UUID from the Verification Queue, Moderation Queue, Groups, or Audit Logs to inspect unmasked governance details, suspend/reinstate, or manage roles."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Profile Card */}
              <Card className="p-6 lg:col-span-2 space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[#e4dfd3] pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[#16241b]">
                        {inspected.profile.fullName}
                      </h2>
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
                    <p className="mt-1 font-mono text-xs text-[#56635a]">{inspected.profile.id}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {inspected.profile.verificationState === 'suspended' ? (
                      <Button variant="emerald" size="sm" onClick={handleReinstate}>
                        <UserCheck className="h-3.5 w-3.5" />
                        Reinstate
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setSuspendOpen(true)}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Suspend
                      </Button>
                    )}
                  </div>
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

                {inspected.community && (
                  <div className="grid grid-cols-3 gap-3 border-t border-[#e4dfd3] pt-4">
                    <div className="rounded-lg border border-[#ece7dc] bg-[#faf7f0] p-3">
                      <p className="text-[11px] text-[#56635a]">Approved Posts</p>
                      <p className="mt-1 text-lg font-semibold text-[#16241b]">
                        {inspected.community.posts?.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#ece7dc] bg-[#faf7f0] p-3">
                      <p className="text-[11px] text-[#56635a]">Public Groups</p>
                      <p className="mt-1 text-lg font-semibold text-[#16241b]">
                        {inspected.community.groups?.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#ece7dc] bg-[#faf7f0] p-3">
                      <p className="text-[11px] text-[#56635a]">Resources</p>
                      <p className="mt-1 text-lg font-semibold text-[#16241b]">
                        {inspected.community.resources?.length ?? 0}
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* RBAC Role Assignments Card */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#16241b]">Role Assignments</h3>
                    <p className="text-xs text-[#56635a]">Functional RBAC scope</p>
                  </div>
                  {isPlatformAdmin && (
                    <Button variant="primary" size="sm" onClick={() => setAssignOpen(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      Assign
                    </Button>
                  )}
                </div>

                {memberRoles.length === 0 ? (
                  <p className="text-xs text-[#56635a]">No explicit role rows assigned.</p>
                ) : (
                  <div className="space-y-2.5">
                    {memberRoles.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3"
                      >
                        <div className="min-w-0">
                          <Badge tone={statusTone(assignment.role?.name)}>
                            {assignment.role?.name}
                          </Badge>
                          <p className="mt-1.5 text-[11px] text-[#56635a]">
                            Assigned {formatDateTime(assignment.createdAt)}
                          </p>
                          {assignment.churchId && (
                            <p className="mt-0.5 font-mono text-[10px] text-[#6c7870] truncate">
                              Church: {assignment.churchId}
                            </p>
                          )}
                          {assignment.groupId && (
                            <p className="mt-0.5 font-mono text-[10px] text-[#6c7870] truncate">
                              Group: {assignment.groupId}
                            </p>
                          )}
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
              </Card>
            </div>
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
