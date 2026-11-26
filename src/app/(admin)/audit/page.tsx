'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingRows,
  PageHeader,
  Select,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatEnumLabel } from '@/lib/format';
import type { AuditLogEntry, ModerationActionEntry } from '@/types/api';

export default function AuditLogsPage() {
  const { isPlatformAdmin } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'moderation' | 'system'>(
    isPlatformAdmin ? 'system' : 'moderation',
  );
  const [limit, setLimit] = useState(50);
  const [systemLogs, setSystemLogs] = useState<AuditLogEntry[]>([]);
  const [moderationLogs, setModerationLogs] = useState<ModerationActionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'system' && isPlatformAdmin) {
        const res = await api.get<AuditLogEntry[]>('/audit/logs', { limit });
        setSystemLogs(Array.isArray(res.data) ? res.data : []);
      } else {
        const res = await api.get<ModerationActionEntry[]>('/audit/moderation-actions', {
          limit,
        });
        setModerationLogs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error('Failed to load audit trail', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [tab, limit, isPlatformAdmin, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail & Moderation History"
        description="Inspect administrative actions and cross-module moderation history across posts, gallery photos, and resources."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              {isPlatformAdmin && (
                <button
                  type="button"
                  onClick={() => setTab('system')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    tab === 'system' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                  }`}
                >
                  System Audit Logs
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab('moderation')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'moderation' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Moderation Actions
              </button>
            </div>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-28 py-1.5 text-xs"
            >
              <option value="50">Last 50</option>
              <option value="100">Last 100</option>
              <option value="200">Last 200</option>
            </Select>
            <Button variant="secondary" size="sm" onClick={loadLogs} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingRows count={6} />
      ) : tab === 'system' && isPlatformAdmin ? (
        systemLogs.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No system audit logs recorded"
            description="Administrative mutations (church updates, role changes, verifications) will appear here."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                    <th className="px-4 py-3 w-14">S/No.</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece7dc]">
                  {systemLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-[#faf7f0]">
                      <td className="px-4 py-3 font-mono text-[#56635a]">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <Badge tone="gold">{log.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#16241b]">
                        {log.actor
                          ? `${log.actor.firstName} ${log.actor.surname}`
                          : log.actorId?.slice(0, 8) || 'System'}
                      </td>
                      <td className="px-4 py-3 text-[#3e4c42]">
                        {log.entityType || '—'}
                        {log.entityId && (
                          <span className="ml-1.5 font-mono text-[10px] text-[#56635a]">
                            {log.entityId.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#56635a] max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[#56635a] whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : moderationLogs.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="No moderation history yet"
          description="Moderation decisions on posts, gallery photos, and library resources will be logged here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                  <th className="px-4 py-3 w-14">S/No.</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Moderator</th>
                  <th className="px-4 py-3">Reason / Note</th>
                  <th className="px-4 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece7dc]">
                {moderationLogs.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-[#faf7f0]">
                    <td className="px-4 py-3 font-mono text-[#56635a]">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-[#16241b]">{entry.subjectType}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-[#56635a]">
                        {entry.subjectId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(entry.action)}>
                        {formatEnumLabel(entry.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#3e4c42]">
                      {entry.moderator
                        ? `${entry.moderator.firstName} ${entry.moderator.surname}`
                        : entry.moderatorId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-[#56635a] max-w-md truncate">
                      {entry.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[#56635a] whitespace-nowrap">
                      {formatDateTime(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
