'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyRound,
  Save,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
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
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type {
  BranchPositionPermissionsResponse,
  BranchPositionRecord,
  PermissionCatalogItem,
  PositionPermissionKey,
} from '@/types/api';

export default function BranchPermissionsPage() {
  const { can, member, refreshPermissions } = useAuth();
  const isBranchSuperAdmin = can('branch.super_admin');
  const toast = useToast();

  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [positions, setPositions] = useState<BranchPositionRecord[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [checkedKeys, setCheckedKeys] = useState<PositionPermissionKey[]>([]);
  const [hoveredKey, setHoveredKey] = useState<PositionPermissionKey | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!isBranchSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [catRes, posRes] = await Promise.all([
        api.get<PermissionCatalogItem[]>('/branch/positions/permission-catalog'),
        api.get<BranchPositionRecord[]>('/branch/positions'),
      ]);
      setCatalog(Array.isArray(catRes.data) ? catRes.data : []);
      const posList = Array.isArray(posRes.data) ? posRes.data : [];
      setPositions(posList);
      if (!selectedPositionId && posList[0]) {
        setSelectedPositionId(posList[0].id);
      }
    } catch (err) {
      toast.error(
        'Failed to load permission catalog',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [isBranchSuperAdmin, selectedPositionId, toast]);

  const loadPositionPermissions = useCallback(
    async (positionId: string) => {
      if (!positionId || !isBranchSuperAdmin) return;
      setLoadingPerms(true);
      setSaveError(null);
      try {
        const res = await api.get<BranchPositionPermissionsResponse>(
          `/branch/positions/${positionId}/permissions`,
        );
        setCheckedKeys(Array.isArray(res.data?.permissions) ? res.data.permissions : []);
      } catch (err) {
        toast.error(
          'Failed to load position permissions',
          err instanceof ApiError ? err.message : undefined,
        );
      } finally {
        setLoadingPerms(false);
      }
    },
    [isBranchSuperAdmin, toast],
  );

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (selectedPositionId) {
      loadPositionPermissions(selectedPositionId);
    }
  }, [selectedPositionId, loadPositionPermissions]);

  // Strict gate: ONLY branch.super_admin (03-branch-positions-and-permissions-ui.md Part B)
  if (!isBranchSuperAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6 text-[#b83227]" />}
        title="403 Forbidden — Branch Super Admin Required"
        description="Configuring per-position permissions requires the branch.super_admin permission in your congregation."
      />
    );
  }

  const togglePermission = (key: PositionPermissionKey) => {
    setSaveError(null);
    setCheckedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    if (!selectedPositionId) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Strict Branch Isolation: body contains ONLY { permissions }
      await api.put(`/branch/positions/${selectedPositionId}/permissions`, {
        permissions: checkedKeys,
      });
      // Immediately refetch my-permissions so any self-permission changes reflect right away
      await refreshPermissions();
      toast.success(
        'Position permissions saved',
        'Updated for your congregation only.',
      );
    } catch (err) {
      // Surface 400 Bad Request (e.g. last-admin protection) inline
      setSaveError(
        err instanceof ApiError ? err.message : 'Unable to save position permissions.',
      );
    } finally {
      setSaving(false);
    }
  };

  const activePosition = positions.find((p) => p.id === selectedPositionId) || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Position Permissions"
        description={`Configure which capabilities each HQ position grants inside ${member?.church?.name || 'your congregation'}. Changes apply only to your church.`}
        badge={<Badge tone="gold">branch.super_admin</Badge>}
        actions={
          <Button variant="secondary" size="sm" onClick={loadInitial} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <LoadingRows count={4} />
      ) : positions.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="No positions available"
          description="No active HQ positions were returned for your congregation."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Position List Sidebar */}
          <Card className="p-4 space-y-2">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#56635a]">
              Select Position
            </p>
            {positions.map((pos) => {
              const selected = pos.id === selectedPositionId;
              return (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setSelectedPositionId(pos.id)}
                  className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#0a542d] bg-[#eaf6ee] text-[#063b20]'
                      : 'border-[#e4dfd3] bg-[#faf7f0] text-[#16241b] hover:border-[#d48a1f]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{pos.title}</span>
                    <Badge tone="neutral">{pos.filled} active</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#56635a] line-clamp-1">
                    {pos.description}
                  </p>
                </button>
              );
            })}
          </Card>

          {/* Dynamic Permission Checklist */}
          <Card className="p-6 lg:col-span-2 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4dfd3] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#063b20]">
                  {activePosition?.title || 'Position Permissions'}
                </h2>
                <p className="mt-0.5 text-xs text-[#56635a]">
                  Permissions are loaded dynamically from the platform permission catalog.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                disabled={loadingPerms || !selectedPositionId}
                onClick={handleSave}
              >
                <Save className="h-3.5 w-3.5" />
                Save Permissions
              </Button>
            </div>

            {saveError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#b83227]/40 bg-[#fdeceb] px-4 py-3 text-xs font-medium text-[#9c261d]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {loadingPerms ? (
              <LoadingRows count={4} />
            ) : (
              <div className="space-y-3">
                {catalog.map((item) => {
                  const checked = checkedKeys.includes(item.key);
                  const showWarning = Boolean(
                    item.warning && (checked || hoveredKey === item.key),
                  );
                  return (
                    <div
                      key={item.key}
                      onMouseEnter={() => setHoveredKey(item.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      className={`rounded-xl border p-4 transition-colors ${
                        checked
                          ? item.warning
                            ? 'border-[#b83227]/45 bg-[#fff8f7]'
                            : 'border-[#0a542d]/45 bg-[#eaf6ee]/60'
                          : 'border-[#e4dfd3] bg-[#faf7f0]'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(item.key)}
                          className="mt-0.5 h-4 w-4 accent-[#0a542d]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[#16241b]">
                              {item.label}
                            </span>
                            <code className="rounded bg-white px-2 py-0.5 font-mono text-[10px] text-[#56635a] border border-[#e4dfd3]">
                              {item.key}
                            </code>
                          </div>
                          <p className="mt-1 text-xs text-[#56635a] leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </label>

                      {showWarning && item.warning && (
                        <div
                          role="note"
                          className="mt-3 flex items-start gap-2 rounded-lg border border-[#b83227]/35 bg-[#fdeceb] px-3.5 py-2.5 text-xs font-medium text-[#9c261d]"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{item.warning}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
