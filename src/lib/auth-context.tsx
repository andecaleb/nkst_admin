'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, tokenStorage } from '@/lib/api-client';
import type {
  AdminRole,
  LoginResponse,
  MemberProfile,
  MemberRoleAssignment,
} from '@/types/api';

interface AuthContextValue {
  member: MemberProfile | null;
  roles: AdminRole[];
  roleAssignments: MemberRoleAssignment[];
  administeredChurchIds: string[];
  scopedChurchId: string | undefined;
  loading: boolean;
  isAuthenticated: boolean;
  hasAdminAccess: boolean;
  isPlatformAdmin: boolean;
  isChurchAdmin: boolean;
  isGroupAdmin: boolean;
  suspensionNotice: LoginResponse['suspensionNotice'];
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ADMIN_ROLES: AdminRole[] = ['PLATFORM_ADMIN', 'CHURCH_ADMIN', 'GROUP_ADMIN'];

function isAdminRole(roleName: string): roleName is AdminRole {
  return ADMIN_ROLES.includes(roleName as AdminRole);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<MemberRoleAssignment[]>([]);
  const [suspensionNotice, setSuspensionNotice] = useState<LoginResponse['suspensionNotice']>(null);
  const [loading, setLoading] = useState(true);

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
      // GET /roles/member/:id is guarded by CHURCH_ADMIN | PLATFORM_ADMIN;
      // a 200 response for a non-Platform Admin confirms Church Admin authority.
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
          // Regular MEMBER or VISITOR — no admin access
        }
      }
    }

    setRoleAssignments(assignments);
    setRoles(Array.from(resolved));
  }, []);

  const refreshSession = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setMember(null);
      setRoles([]);
      setRoleAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<MemberProfile>('/members/me');
      setMember(res.data);
      if (res.data.verificationState === 'suspended') {
        setSuspensionNotice({
          suspended: true,
          readOnly: true,
          reason: res.data.suspensionReason || 'Account suspended by administrator',
        });
      } else {
        setSuspensionNotice(null);
      }
      await resolveAdminRoles(res.data);
    } catch {
      tokenStorage.clear();
      setMember(null);
      setRoles([]);
      setRoleAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [resolveAdminRoles]);

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

      const meRes = await api.get<MemberProfile>('/members/me');
      setMember(meRes.data);
      await resolveAdminRoles(meRes.data);
    },
    [resolveAdminRoles],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local session even if server call fails
    } finally {
      tokenStorage.clear();
      setMember(null);
      setRoles([]);
      setRoleAssignments([]);
      setSuspensionNotice(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {
      // Clear local session regardless
    } finally {
      tokenStorage.clear();
      setMember(null);
      setRoles([]);
      setRoleAssignments([]);
      setSuspensionNotice(null);
    }
  }, []);

  const administeredChurchIds = useMemo(() => {
    const ids = new Set<string>();
    roleAssignments.forEach((a) => {
      if (a.role?.name === 'CHURCH_ADMIN' && a.churchId) {
        ids.add(a.churchId);
      }
    });
    if (roles.includes('CHURCH_ADMIN') && member?.churchId) {
      ids.add(member.churchId);
    }
    return Array.from(ids);
  }, [roleAssignments, roles, member]);

  const scopedChurchId = useMemo(() => {
    if (roles.includes('PLATFORM_ADMIN')) return undefined;
    return administeredChurchIds[0] || member?.churchId || undefined;
  }, [roles, administeredChurchIds, member?.churchId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      member,
      roles,
      roleAssignments,
      administeredChurchIds,
      scopedChurchId,
      loading,
      isAuthenticated: Boolean(member),
      hasAdminAccess: roles.length > 0,
      isPlatformAdmin: roles.includes('PLATFORM_ADMIN'),
      isChurchAdmin: roles.includes('CHURCH_ADMIN'),
      isGroupAdmin: roles.includes('GROUP_ADMIN'),
      suspensionNotice,
      login,
      logout,
      logoutAll,
      refreshSession,
    }),
    [
      member,
      roles,
      roleAssignments,
      administeredChurchIds,
      scopedChurchId,
      loading,
      suspensionNotice,
      login,
      logout,
      logoutAll,
      refreshSession,
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
