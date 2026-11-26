'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldCheck,
  FileCheck2,
  Flag,
  Images,
  BookOpen,
  Building2,
  Users,
  FileSpreadsheet,
  UsersRound,
  Store,
  Megaphone,
  Mail,
  ScrollText,
  LogOut,
  MonitorSmartphone,
  Menu,
  X,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Award,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import { useAuth, type AuthContextValue } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { Badge, Button, Modal } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import type { SessionRecord } from '@/types/api';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (auth: Pick<AuthContextValue, 'isHqAdmin' | 'isChurchAdmin' | 'isGroupAdmin' | 'can'>) => boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.isGroupAdmin || a.can('branch.super_admin'),
      },
      {
        label: 'Verification Queue',
        href: '/verification',
        icon: ShieldCheck,
        visible: (a) => a.isHqAdmin || a.can('members.verify'),
      },
    ],
  },
  {
    title: 'Positions & Governance',
    items: [
      {
        label: 'HQ Positions',
        href: '/hq/positions',
        icon: Award,
        // Strictly HQ Platform Admin ONLY (never shown to Church Admin or branch.super_admin)
        visible: (a) => a.isHqAdmin,
      },
      {
        label: 'Branch Positions',
        href: '/branch/positions',
        icon: UserCheck,
        visible: (a) => a.can('positions.assign'),
      },
      {
        label: 'Position Permissions',
        href: '/branch/permissions',
        icon: KeyRound,
        visible: (a) => a.can('branch.super_admin'),
      },
    ],
  },
  {
    title: 'Moderation Center',
    items: [
      {
        label: 'Posts Queue',
        href: '/moderation/posts',
        icon: FileCheck2,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.isGroupAdmin,
      },
      {
        label: 'Content Reports',
        href: '/moderation/reports',
        icon: Flag,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.isGroupAdmin,
      },
      {
        label: 'Gallery Review',
        href: '/moderation/gallery',
        icon: Images,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin,
      },
      {
        label: 'Resources Review',
        href: '/moderation/resources',
        icon: BookOpen,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin,
      },
    ],
  },
  {
    title: 'Directory & Community',
    items: [
      {
        label: 'Churches',
        href: '/churches',
        icon: Building2,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.can('branch.super_admin'),
      },
      {
        label: 'Members & RBAC',
        href: '/members',
        icon: Users,
        visible: (a) => a.isHqAdmin || a.can('members.view'),
      },
      {
        label: 'Import Members',
        href: '/members/import',
        icon: FileSpreadsheet,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.can('branch.super_admin'),
      },
      {
        label: 'Groups',
        href: '/groups',
        icon: UsersRound,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.isGroupAdmin,
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Marketplace',
        href: '/marketplace',
        icon: Store,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin,
      },
      {
        label: 'Communications',
        href: '/communications',
        icon: Megaphone,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.isGroupAdmin,
      },
      {
        label: 'Messages',
        href: '/messages',
        icon: Mail,
        visible: (a) => a.isHqAdmin || a.isChurchAdmin || a.isGroupAdmin,
      },
      {
        label: 'Audit Logs',
        href: '/audit',
        icon: ScrollText,
        visible: (a) => a.isHqAdmin,
      },
    ],
  },
];

export function getVisibleNavGroups(
  auth: Pick<AuthContextValue, 'isHqAdmin' | 'isChurchAdmin' | 'isGroupAdmin' | 'can'>,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.visible(auth)),
  })).filter((group) => group.items.length > 0);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const {
    member,
    roles,
    permissions,
    loading,
    isAuthenticated,
    hasAdminAccess,
    isHqAdmin,
    isChurchAdmin,
    isGroupAdmin,
    can,
    suspensionNotice,
    logout,
    logoutAll,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const openSessionsModal = async () => {
    setSessionsOpen(true);
    setLoadingSessions(true);
    try {
      const res = await api.get<SessionRecord[]>('/auth/sessions');
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Failed to load sessions', err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/login');
  };

  const handleSignOutAll = async () => {
    await logoutAll();
    toast.success('Signed out of all devices');
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f0]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#d48a1f]/30 border-t-[#0a542d]" />
          <p className="text-xs font-medium uppercase tracking-widest text-[#56635a]">
            Loading NKST Admin Console
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Admin Shell Gate (01-auth-and-permissions-shell.md)
  if (!hasAdminAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f0] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#b83227]/30 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fdeceb] text-[#b83227]">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-[#16241b]">No Administrative Access</h1>
          <p className="mt-2 text-sm text-[#56635a] leading-relaxed">
            Signed in as <span className="font-semibold text-[#16241b]">{member?.fullName}</span>.
            Your account does not hold any HQ admin role, branch admin role, or delegated position
            permissions.
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="primary" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const visibleGroups = getVisibleNavGroups({ isHqAdmin, isChurchAdmin, isGroupAdmin, can });

  const primaryBadge = isHqAdmin
    ? 'HQ ADMIN'
    : isChurchAdmin
      ? 'CHURCH ADMIN'
      : can('branch.super_admin')
        ? 'BRANCH SUPER ADMIN'
        : permissions.length > 0
          ? 'BRANCH LEADER'
          : 'GROUP ADMIN';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#063b20] text-[#faf7f0] border-r border-[#d48a1f]/30">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-sm ring-2 ring-[#d48a1f]/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nkst-logo.png"
              alt="NKST Emblem"
              className="h-9 w-9 rounded-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-white">NKST Admin</p>
            <p className="text-[11px] text-[#f5c76b]">Mkar Digital Console</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-white/75 hover:bg-white/10 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Admin Navigation">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f5c76b]/80">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === '/' || item.href === '/members'
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-[#faf7f0] text-[#063b20] font-semibold shadow-xs border-l-3 border-[#d48a1f]'
                          : 'text-[#e3ece5] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? 'text-[#0a542d]' : 'text-[#a8c9b5] group-hover:text-[#f5c76b]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-[#d48a1f]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3.5">
        <div className="rounded-xl bg-[#042b17] border border-[#d48a1f]/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-white">{member?.fullName}</p>
            <span className="rounded-full bg-[#d48a1f]/20 border border-[#f5c76b]/40 px-2 py-0.5 text-[10px] font-semibold text-[#f5c76b] whitespace-nowrap">
              {primaryBadge}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-[#a8c9b5]">
            {member?.church?.name || member?.email}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={openSessionsModal}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-white/15 cursor-pointer"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" />
              Sessions
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#d48a1f] px-2.5 py-1.5 text-[11px] font-semibold text-[#062414] hover:bg-[#e5a435] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#faf7f0] text-[#16241b]">
      <aside className="hidden w-64 shrink-0 lg:block sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#062414]/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">{sidebarContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#e4dfd3] bg-white/95 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-[#dad3c4] p-2 text-[#16241b] hover:bg-[#f2ede2] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#56635a]">
              <span className="h-2 w-2 rounded-full bg-[#1e7e45]" />
              <span className="font-medium text-[#16241b]">NKST API Connected</span>
              <span className="text-[#d4ccb9]">·</span>
              <span className="text-[#b57012] font-semibold">Psalm 119:105</span>
              <span className="text-[#d4ccb9]">·</span>
              <span>{isHqAdmin ? 'HQ Global Console' : member?.church?.name || 'Branch Console'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roles.map((role) => (
              <Badge key={role} tone="gold" className="hidden md:inline-flex">
                {role}
              </Badge>
            ))}
            {!isHqAdmin && permissions.includes('branch.super_admin') && !roles.includes('CHURCH_ADMIN') && (
              <Badge tone="gold" className="hidden md:inline-flex">
                branch.super_admin
              </Badge>
            )}
          </div>
        </header>

        {suspensionNotice?.suspended && (
          <div className="border-b border-[#b83227]/30 bg-[#fdeceb] px-4 py-2.5 lg:px-8">
            <div className="flex items-center gap-2.5 text-xs text-[#9c261d]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Account Suspended (Read-Only):</strong> {suspensionNotice.reason}
              </span>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Modal
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        title="Active Device Sessions"
        description="Manage your active admin sessions across devices."
      >
        <div className="space-y-4">
          {loadingSessions ? (
            <p className="text-xs text-[#56635a]">Loading active sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-[#56635a]">No active sessions returned.</p>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-[#e4dfd3] bg-[#faf7f0] px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#16241b]">
                      {s.deviceInfo || 'Admin Web Session'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#56635a]">
                      IP: {s.ipAddress || 'Unknown'} · Started {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <Badge tone="emerald">Active</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-[#e4dfd3] pt-4">
            <Button variant="danger" size="sm" onClick={handleSignOutAll}>
              Sign Out All Devices
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSessionsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
