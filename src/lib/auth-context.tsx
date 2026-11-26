'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, tokenStorage } from '@/lib/api-client';
import type {
  AdminRole,
  LoginResponse,
  MemberProfile,
  MemberRoleAssignment,
  MyBranchPermissionsResponse,
  PositionPermissionKey,
} from '@/types/api';

export interface AuthContextValue {
  member: MemberProfile | null;
  roles: AdminRole[];
  roleAssignments: MemberRoleAssignment[];
  administeredChurchIds: string[];
  scopedChurchId: string | undefined;
  branchId: string | null;
  permissions: PositionPermissionKey[];
  loading: boolean;
  isAuthenticated: boolean;
  hasAdminAccess: boolean;
  isHqAdmin: boolean;
  isPlatformAdmin: boolean;
  isChurchAdmin: boolean;
  isGroupAdmin: boolean;
  can: (permissionKey: PositionPermissionKey) => boolean;
  suspensionNotice: LoginResponse['suspensionNotice'];
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshPermissions: () => Promise<PositionPermissionKey[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ADMIN_ROLES: AdminRole[] = ['PLATFORM_ADMIN', 'CHURCH_ADMIN', 'GROUP_ADMIN'];

function isAdminRole(roleName: string): roleName is AdminRole {
  return ADMIN_ROLES.includes(roleName as AdminRole);
}

export function computeCanPermission(
  permissions: PositionPermissionKey[],
  key: PositionPermissionKey,
): boolean {
  return permissions.includes(key);
}

export function computeHasAdminAccess(params: {
  isHqAdmin: boolean;
  roles: AdminRole[];
  permissions: PositionPermissionKey[];
}): boolean {
  return (
    params.isHqAdmin ||
    params.permissions.length > 0 ||
    params.roles.includes('CHURCH_ADMIN') ||
    params.roles.includes('GROUP_ADMIN') ||
    params.roles.includes('PLATFORM_ADMIN')
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<MemberRoleAssignment[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PositionPermissionKey[]>([]);
  const [suspensionNotice, setSuspensionNotice] = useState<LoginResponse['suspensionNotice']>(null);
  const [loading, setLoading] = useState(true);

  const fetchMyPermissions = useCallback(async (): Promise<{
    branchId: string | null;
    permissions: PositionPermissionKey[];
  }> => {
    try {
      const res = await api.get<MyBranchPermissionsResponse>('/branch/positions/my-permissions');
      const perms = Array.isArray(res.data?.permissions) ? res.data.permissions : [];
      const bId = res.data?.branchId ?? null;
      setBranchId(bId);
      setPermissions(perms);
      return { branchId: bId, permissions: perms };
    } catch {
      setBranchId(null);
      setPermissions([]);
      return { branchId: null, permissions: [] };
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    const { permissions: nextPerms } = await fetchMyPermissions();
    return nextPerms;
  }, [fetchMyPermissions]);

  const resolveAdminRoles = useCallback(async (profile: MemberProfile) => {
    const resolved = new Set<AdminRole>();
    let assignments: MemberRoleAssignment[] = [];

    if (profile.isPlatformAdmin) {
      resolved.add('PLATFORM_ADMIN');
    }

    // Attempt to fetch member role assignments (permitted for CHURCH_ADMIN and PLATFORM_ADMIN)
    try {
      const res = await api.get<MemberRoleAssignment[]>(`/roles/member/${profile.id}`);
      assignments = Array.isArray(res.data) ? res.data : [];
      assignments.forEach((a) => {
        if (a.role?.name && isAdminRole(a.role.name)) {
          resolved.add(a.role.name);
        }
      });
      if (!profile.isPlatformAdmin && !resolved.has('CHURCH_ADMIN')) {
        resolved.add('CHURCH_ADMIN');
      }
    } catch (err) {
      // If 403, the member might still be a GROUP_ADMIN; probe the group-accessible moderation queue
      if (err instanceof ApiError && err.status === 403) {
        try {
          await api.get('/posts/moderation/queue', { page: 1, limit: 1 });
          resolved.add('GROUP_ADMIN');
        } catch {
          // Delegated position holders (e.g. Catechism Leader) are authorized via my-permissions
        }
      }
    }

    setRoleAssignments(assignments);
    setRoles(Array.from(resolved));
  }, []);

  const hydrateUserSession = useCallback(async () => {
    // 01-auth-and-permissions-shell.md: fetch /members/me and /branch/positions/my-permissions in parallel
    const [meRes] = await Promise.all([
      api.get<MemberProfile>('/members/me'),
      fetchMyPermissions(),
    ]);

    setMember(meRes.data);
    if (meRes.data.verificationState === 'suspended') {
      setSuspensionNotice({
        suspended: true,
        readOnly: true,
        reason: meRes.data.suspensionReason || 'Account suspended by administrator',
      });
    } else {
      setSuspensionNotice(null);
    }
    await resolveAdminRoles(meRes.data);
  }, [fetchMyPermissions, resolveAdminRoles]);

  const refreshSession = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setMember(null);
      setRoles([]);
      setRoleAssignments([]);
      setBranchId(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await hydrateUserSession();
    } catch {
      tokenStorage.clear();
      setMember(null);
      setRoles([]);
      setRoleAssignments([]);
      setBranchId(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [hydrateUserSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await api.post<LoginResponse>(
        '/auth/login',
        {
          identifier: identifier.trim(),
          password,
          deviceInfo: 'NKST Admin Web Console',
        },
        true,
      );
      tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
      setSuspensionNotice(res.data.suspensionNotice ?? null);
      await hydrateUserSession();
    },
    [hydrateUserSession],
  );

  const clearLocalAuth = useCallback(() => {
    tokenStorage.clear();
    setMember(null);
    setRoles([]);
    setRoleAssignments([]);
    setBranchId(null);
    setPermissions([]);
    setSuspensionNotice(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local session even if server call fails
    } finally {
      clearLocalAuth();
    }
  }, [clearLocalAuth]);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {
      // Clear local session regardless
    } finally {
      clearLocalAuth();
    }
  }, [clearLocalAuth]);

  const isHqAdmin = Boolean(member?.isPlatformAdmin) || roles.includes('PLATFORM_ADMIN');

  const administeredChurchIds = useMemo(() => {
    const ids = new Set<string>();
    roleAssignments.forEach((a) => {
      if (a.role?.name === 'CHURCH_ADMIN' && a.churchId) {
        ids.add(a.churchId);
      }
    });
    if (branchId) {
      ids.add(branchId);
    }
    if ((roles.includes('CHURCH_ADMIN') || permissions.length > 0) && member?.churchId) {
      ids.add(member.churchId);
    }
    return Array.from(ids);
  }, [roleAssignments, roles, branchId, permissions.length, member?.churchId]);

  const scopedChurchId = useMemo(() => {
    if (isHqAdmin) return undefined;
    return branchId || administeredChurchIds[0] || member?.churchId || undefined;
  }, [isHqAdmin, branchId, administeredChurchIds, member?.churchId]);

  const can = useCallback(
    (permissionKey: PositionPermissionKey) => computeCanPermission(permissions, permissionKey),
    [permissions],
  );

  const hasAdminAccess = useMemo(
    () => computeHasAdminAccess({ isHqAdmin, roles, permissions }),
    [isHqAdmin, roles, permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      member,
      roles,
      roleAssignments,
      administeredChurchIds,
      scopedChurchId,
      branchId,
      permissions,
      loading,
      isAuthenticated: Boolean(member),
      hasAdminAccess,
      isHqAdmin,
      isPlatformAdmin: isHqAdmin,
      isChurchAdmin: roles.includes('CHURCH_ADMIN'),
      isGroupAdmin: roles.includes('GROUP_ADMIN'),
      can,
      suspensionNotice,
      login,
      logout,
      logoutAll,
      refreshSession,
      refreshPermissions,
    }),
    [
      member,
      roles,
      roleAssignments,
      administeredChurchIds,
      scopedChurchId,
      branchId,
      permissions,
      loading,
      hasAdminAccess,
      isHqAdmin,
      can,
      suspensionNotice,
      login,
      logout,
      logoutAll,
      refreshSession,
      refreshPermissions,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
