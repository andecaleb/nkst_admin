'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Flag,
  ShieldCheck,
  Users,
  RefreshCw,
  ArrowUpRight,
  FileCheck2,
  Images,
  BookOpen,
  Store,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingRows,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatEnumLabel } from '@/lib/format';
import type { AdminCounts, ChurchRecord, ModerationActionEntry } from '@/types/api';

export default function DashboardPage() {
  const { member, isPlatformAdmin, isChurchAdmin, administeredChurchIds } = useAuth();
  const canViewCounts = isPlatformAdmin || isChurchAdmin;
  const toast = useToast();

  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [recentModeration, setRecentModeration] = useState<ModerationActionEntry[]>([]);
  const [churchesMap, setChurchesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (canViewCounts) {
        const [countsRes, modRes, churchesRes] = await Promise.all([
          api.get<AdminCounts>('/audit/counts'),
          api.get<ModerationActionEntry[]>('/audit/moderation-actions', { limit: 10 }),
          api.get<ChurchRecord[]>('/churches', { page: 1, limit: 100 }),
        ]);
        const countsData = countsRes.data;
        if (!isPlatformAdmin && countsData) {
          countsData.membersByChurch = (countsData.membersByChurch || []).filter((r) =>
            administeredChurchIds.includes(r.churchId),
          );
          countsData.totalChurches = administeredChurchIds.length || 1;
        }
        setCounts(countsData);
        setRecentModeration(Array.isArray(modRes.data) ? modRes.data : []);
        const map: Record<string, string> = {};
        if (Array.isArray(churchesRes.data)) {
          churchesRes.data
            .filter((c) => isPlatformAdmin || administeredChurchIds.includes(c.id))
            .forEach((c) => {
              map[c.id] = c.name;
            });
        }
        setChurchesMap(map);
      }
    } catch (err) {
      toast.error(
        'Failed to load dashboard metrics',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [canViewCounts, isPlatformAdmin, administeredChurchIds, toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalMembers = useMemo(
    () =>
      counts?.membersByVerificationState.reduce((sum, item) => sum + item.count, 0) ?? 0,
    [counts],
  );

  const verifiedCount = useMemo(
    () =>
      counts?.membersByVerificationState.find((i) => i.verificationState === 'verified')?.count ??
      0,
    [counts],
  );

  const pendingCount = useMemo(
    () =>
      counts?.membersByVerificationState.find(
        (i) => i.verificationState === 'pending_verification',
      )?.count ?? 0,
    [counts],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${member?.firstName || 'Admin'}`}
        description={
          isPlatformAdmin
            ? 'Global NKST platform governance overview across all congregations.'
            : isChurchAdmin
              ? `Congregation administration dashboard for ${member?.church?.name || 'your church'}.`
              : 'Group administration workspace for moderating group posts, reports, and join requests.'
        }
        badge={
          <Badge tone="emerald">
            {isPlatformAdmin ? 'Global Scope' : isChurchAdmin ? 'Church Scope' : 'Group Scope'}
          </Badge>
        }
        actions={
          canViewCounts ? (
            <Button variant="secondary" size="sm" onClick={loadDashboard} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {!canViewCounts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Posts Moderation Queue',
              desc: 'Approve, reject, or request corrections on pending group posts.',
              href: '/moderation/posts',
              icon: FileCheck2,
            },
            {
              title: 'Content Reports',
              desc: 'Review reported posts and comments in your groups.',
              href: '/moderation/reports',
              icon: Flag,
            },
            {
              title: 'Groups & Join Requests',
              desc: 'Approve join requests, invite eligible members, and manage group admins.',
              href: '/groups',
              icon: Users,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full p-5 hover:border-[#d48a1f]/45 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d48a1f]/35 bg-[#0a542d]/10 text-[#0a542d]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[#56635a]" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[#16241b]">{item.title}</h3>
                  <p className="mt-1 text-xs text-[#56635a] leading-relaxed">{item.desc}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : loading ? (
        <LoadingRows count={4} />
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Members (Scope)"
              value={totalMembers}
              sublabel={`${verifiedCount} verified · ${pendingCount} pending`}
              icon={<Users className="h-5 w-5" />}
              accent="gold"
            />
            <StatCard
              label="Verified Members"
              value={verifiedCount}
              sublabel={
                totalMembers > 0
                  ? `${Math.round((verifiedCount / totalMembers) * 100)}% verification rate`
                  : 'No members yet'
              }
              icon={<ShieldCheck className="h-5 w-5" />}
              accent="emerald"
            />
            <StatCard
              label="Active Churches"
              value={counts?.totalChurches ?? 0}
              sublabel="Registered NKST congregations"
              icon={<Building2 className="h-5 w-5" />}
              accent="gold"
            />
            <StatCard
              label="Open Reports"
              value={counts?.openReports ?? 0}
              sublabel="Posts, comments & gallery flags"
              icon={<Flag className="h-5 w-5" />}
              accent={(counts?.openReports ?? 0) > 0 ? 'danger' : 'emerald'}
            />
          </div>

          {/* Quick Operational Queues */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Verification Queue', href: '/verification', icon: ShieldCheck },
              { label: 'Posts Moderation', href: '/moderation/posts', icon: FileCheck2 },
              { label: 'Gallery Safeguarding', href: '/moderation/gallery', icon: Images },
              { label: 'Resources & Marketplace', href: '/marketplace', icon: Store },
            ].map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.href} href={q.href}>
                  <div className="flex items-center justify-between rounded-xl border border-[#e4dfd3] bg-white px-4 py-3 hover:border-[#d48a1f]/40 hover:bg-[#f4efe4] transition-colors">
                    <span className="flex items-center gap-2.5 text-xs font-medium text-[#16241b]">
                      <Icon className="h-4 w-4 text-[#0a542d]" />
                      {q.label}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#56635a]" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Breakdowns Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Verification State Breakdown */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[#16241b]">
                Members by Verification State
              </h2>
              <p className="mt-0.5 text-xs text-[#56635a]">
                4-pathway membership verification pipeline
              </p>
              <div className="mt-4 space-y-3">
                {counts?.membersByVerificationState.length ? (
                  counts.membersByVerificationState.map((row) => {
                    const pct = totalMembers > 0 ? Math.round((row.count / totalMembers) * 100) : 0;
                    return (
                      <div key={row.verificationState} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <Badge tone={statusTone(row.verificationState)}>
                            {formatEnumLabel(row.verificationState)}
                          </Badge>
                          <span className="font-mono text-[#16241b]">
                            {row.count}{' '}
                            <span className="text-[#56635a]">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e2d5]">
                          <div
                            className="h-full rounded-full bg-[#0a542d]"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#56635a]">No verification data yet.</p>
                )}
              </div>
            </Card>

            {/* Members by State */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[#16241b]">Members by State</h2>
              <p className="mt-0.5 text-xs text-[#56635a]">
                Geographic distribution across Nigeria
              </p>
              <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {counts?.membersByState.length ? (
                  [...counts.membersByState]
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <div
                        key={row.state}
                        className="flex items-center justify-between rounded-lg border border-[#ece7dc] bg-[#faf7f0] px-3 py-2 text-xs"
                      >
                        <span className="text-[#16241b]">{row.state || 'Unspecified'}</span>
                        <span className="font-mono text-[#0a542d]">{row.count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-[#56635a]">No state data available.</p>
                )}
              </div>
            </Card>

            {/* Members by Church */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[#16241b]">Members by Church</h2>
              <p className="mt-0.5 text-xs text-[#56635a]">
                Congregation headcount in your scope
              </p>
              <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {counts?.membersByChurch.length ? (
                  [...counts.membersByChurch]
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <div
                        key={row.churchId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#ece7dc] bg-[#faf7f0] px-3 py-2 text-xs"
                      >
                        <span className="truncate text-[#16241b]">
                          {churchesMap[row.churchId] || `${row.churchId.slice(0, 8)}…`}
                        </span>
                        <span className="font-mono text-[#0a542d]">{row.count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-[#56635a]">No church affiliation counts yet.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Recent Moderation Activity */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#16241b]">
                  Recent Moderation Actions
                </h2>
                <p className="mt-0.5 text-xs text-[#56635a]">
                  Latest decisions across posts, gallery photos, and resources
                </p>
              </div>
              <Link
                href="/audit"
                className="text-xs font-medium text-[#0a542d] hover:underline flex items-center gap-1"
              >
                View full audit
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentModeration.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="No moderation actions recorded yet"
                description="Approved, rejected, or corrected posts, gallery photos, and library resources will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e4dfd3] text-[11px] uppercase tracking-wider text-[#56635a]">
                      <th className="pb-2.5 pr-4 w-12">S/No.</th>
                      <th className="pb-2.5 pr-4">Subject</th>
                      <th className="pb-2.5 pr-4">Action</th>
                      <th className="pb-2.5 pr-4">Moderator</th>
                      <th className="pb-2.5 pr-4">Reason / Note</th>
                      <th className="pb-2.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece7dc]">
                    {recentModeration.map((entry, idx) => (
                      <tr key={entry.id} className="hover:bg-[#faf7f0]">
                        <td className="py-3 pr-4 font-mono text-[#56635a]">{idx + 1}</td>
                        <td className="py-3 pr-4">
                          <span className="capitalize text-[#16241b]">{entry.subjectType}</span>
                          <span className="ml-2 font-mono text-[10px] text-[#56635a]">
                            {entry.subjectId.slice(0, 8)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={statusTone(entry.action)}>
                            {formatEnumLabel(entry.action)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-[#3e4c42]">
                          {entry.moderator
                            ? `${entry.moderator.firstName} ${entry.moderator.surname}`
                            : entry.moderatorId.slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4 text-[#56635a] max-w-xs truncate">
                          {entry.reason || '—'}
                        </td>
                        <td className="py-3 text-right text-[#56635a] whitespace-nowrap">
                          {formatDateTime(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
