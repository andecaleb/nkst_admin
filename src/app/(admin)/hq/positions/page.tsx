'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Plus,
  Pencil,
  PowerOff,
  RotateCcw,
  Trash2,
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
  FieldLabel,
  Input,
  LoadingRows,
  Modal,
  PageHeader,
  Textarea,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import {
  maxSeatsFromMode,
  seatModeFromMaxSeats,
  type SeatCapacityMode,
} from '@/lib/positions-utils';
import type { HqPositionRecord } from '@/types/api';

export default function HqPositionsPage() {
  const { isHqAdmin } = useAuth();
  const toast = useToast();

  const [positions, setPositions] = useState<HqPositionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HqPositionRecord | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seatMode, setSeatMode] = useState<SeatCapacityMode>('single');
  const [seatLimit, setSeatLimit] = useState(2);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Deactivate / Delete modals
  const [deactivateTarget, setDeactivateTarget] = useState<HqPositionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HqPositionRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    if (!isHqAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<HqPositionRecord[]>('/hq/positions', {
        includeInactive: true,
      });
      setPositions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(
        'Failed to load HQ positions',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [isHqAdmin, toast]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  // Strict HQ-only route gate (02-hq-positions-ui.md)
  if (!isHqAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6 text-[#b83227]" />}
        title="403 Forbidden — HQ Platform Admin Only"
        description="Managing the NKST Position Catalog is restricted to HQ Platform Administrators. Local Church Admins and Branch Super Admins can assign positions under Branch Positions."
      />
    );
  }

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setSeatMode('single');
    setSeatLimit(2);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (pos: HqPositionRecord) => {
    setEditing(pos);
    setTitle(pos.title);
    setDescription(pos.description);
    const mode = seatModeFromMaxSeats(pos.maxSeats);
    setSeatMode(mode);
    setSeatLimit(pos.maxSeats && pos.maxSeats > 1 ? pos.maxSeats : 2);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (trimmedTitle.length < 2 || trimmedTitle.length > 100) {
      setFormError('Title must be between 2 and 100 characters.');
      return;
    }
    if (trimmedDesc.length < 5 || trimmedDesc.length > 500) {
      setFormError('Description must be between 5 and 500 characters.');
      return;
    }
    if (seatMode === 'limited' && (!Number.isInteger(seatLimit) || seatLimit < 1)) {
      setFormError('Seat limit must be a whole number of at least 1.');
      return;
    }

    const maxSeats = maxSeatsFromMode(seatMode, seatLimit);
    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/hq/positions/${editing.id}`, {
          title: trimmedTitle,
          description: trimmedDesc,
          maxSeats,
        });
        toast.success('Position updated');
      } else {
        await api.post('/hq/positions', {
          title: trimmedTitle,
          description: trimmedDesc,
          maxSeats,
        });
        toast.success('Position created');
      }
      setFormOpen(false);
      loadPositions();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to save position.';
      // Display verbatim 409 Conflict (duplicate) or 400 Bad Request (seat reduction affected branches)
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setSubmitting(true);
    try {
      await api.patch(`/hq/positions/${deactivateTarget.id}/deactivate`);
      toast.success(
        'Position deactivated',
        `${deactivateTarget.title} is now inactive across all branches.`,
      );
      setDeactivateTarget(null);
      loadPositions();
    } catch (err) {
      toast.error('Deactivation failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (pos: HqPositionRecord) => {
    try {
      await api.patch(`/hq/positions/${pos.id}/reactivate`);
      toast.success('Position reactivated', `${pos.title} is now active.`);
      loadPositions();
    } catch (err) {
      toast.error('Reactivation failed', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setSubmitting(true);
    try {
      await api.delete(`/hq/positions/${deleteTarget.id}`);
      toast.success('Position deleted');
      setDeleteTarget(null);
      loadPositions();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : 'Unable to delete position. Deactivate it instead.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="HQ Positions Catalog"
        description="Define official NKST church leadership positions and seat capacities available to all local congregations."
        badge={<Badge tone="gold">{positions.length} Positions</Badge>}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={loadPositions} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Position
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingRows count={5} />
      ) : positions.length === 0 ? (
        <EmptyState
          icon={<Award className="h-6 w-6" />}
          title="No positions defined yet"
          description="Create church positions (e.g., Senior Pastor, Elders, Catechism Leader) for local churches to assign."
          action={
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create Position
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                  <th className="px-4 py-3.5 w-14">S/No.</th>
                  <th className="px-4 py-3.5">Title</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5">Seats</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Branches Using</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece7dc]">
                {positions.map((pos, idx) => (
                  <tr key={pos.id} className="hover:bg-[#faf7f0] transition-colors">
                    <td className="px-4 py-3.5 font-mono text-[#56635a]">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-[#063b20]">{pos.title}</td>
                    <td className="px-4 py-3.5 text-[#56635a] max-w-md">{pos.description}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone="gold">{pos.seatLabel}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={pos.isActive ? 'emerald' : 'neutral'}>
                        {pos.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        title={`${pos.activeAssignmentsCount} active holder(s) across ${pos.branchesUsingCount} branch(es)`}
                        className="font-mono font-semibold text-[#16241b] cursor-help underline decoration-dotted"
                      >
                        {pos.branchesUsingCount}
                      </span>
                      <span className="ml-1 text-[11px] text-[#56635a]">
                        ({pos.activeAssignmentsCount} active)
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(pos)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {pos.isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeactivateTarget(pos)}
                          >
                            <PowerOff className="h-3.5 w-3.5 text-[#a96910]" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="emerald"
                            size="sm"
                            onClick={() => handleReactivate(pos)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reactivate
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={pos.activeAssignmentsCount > 0}
                          title={
                            pos.activeAssignmentsCount > 0
                              ? 'Cannot delete while active holders exist'
                              : 'Delete position'
                          }
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(pos);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit Position Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Position: ${editing.title}` : 'Create HQ Position'}
        description="Configure title, description, and per-branch seat capacity."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#b83227]/40 bg-[#fdeceb] px-4 py-3 text-xs font-medium text-[#9c261d] leading-relaxed"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <FieldLabel required hint="2–100 chars, case-insensitive unique">
              Position Title
            </FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Pastor, Elders, Catechism Leader"
              minLength={2}
              maxLength={100}
              required
            />
          </div>

          <div>
            <FieldLabel required hint="5–500 chars">
              Description
            </FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the responsibilities of this church position..."
              minLength={5}
              maxLength={500}
              required
            />
          </div>

          <div className="space-y-2.5">
            <FieldLabel required>Seat Capacity Per Branch</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['single', 'Single holder', '1 seat per church'],
                  ['limited', 'Multiple — set limit', 'Fixed cap per church'],
                  ['unlimited', 'Multiple — unlimited', 'No seat limit'],
                ] as const
              ).map(([mode, label, sub]) => (
                <label
                  key={mode}
                  className={`flex flex-col rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                    seatMode === mode
                      ? 'border-[#0a542d] bg-[#eaf6ee] text-[#063b20]'
                      : 'border-[#e4dfd3] bg-[#faf7f0] text-[#56635a]'
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="seatMode"
                      value={mode}
                      checked={seatMode === mode}
                      onChange={() => setSeatMode(mode)}
                      className="accent-[#0a542d]"
                    />
                    {label}
                  </span>
                  <span className="mt-1 pl-5 text-[11px] opacity-80">{sub}</span>
                </label>
              ))}
            </div>

            {seatMode === 'limited' && (
              <div className="pt-1">
                <FieldLabel required hint="Minimum 1">
                  Maximum Seats Per Branch
                </FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(Number(e.target.value))}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editing ? 'Save Changes' : 'Create Position'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivation Confirmation Modal */}
      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.title || 'Position'}`}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d48a1f]/40 bg-[#fef6e6] p-4 text-xs text-[#9b5f0d] leading-relaxed">
            Deactivating this position keeps all historical records, blocks new assignments, and
            immediately suspends permissions granted through this position across all branches.
          </div>
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={submitting} onClick={handleDeactivate}>
              Confirm Deactivate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.title || 'Position'}`}
        description="Permanent deletion is only allowed when zero historical assignments exist."
      >
        <div className="space-y-4">
          {deleteError && (
            <div
              role="alert"
              className="rounded-xl border border-[#b83227]/40 bg-[#fdeceb] px-4 py-3 text-xs text-[#9c261d]"
            >
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={submitting} onClick={handleDelete}>
              Delete Position
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
