'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Store,
  PackageCheck,
  UserCheck,
  UserX,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Info,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  LoadingRows,
  PageHeader,
  ReasonModal,
  Select,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import {
  formatDateTime,
  formatEnumLabel,
  formatNgn,
  formatWaitingTime,
  isValidUuid,
} from '@/lib/format';
import { RESOURCE_CATEGORY_LABELS, SELLER_PLAN_LABELS } from '@/types/api';
import type {
  FulfilmentOrderRecord,
  ResourceRecord,
  SellerPlan,
} from '@/types/api';

export default function MarketplaceGovernancePage() {
  const toast = useToast();

  const [tab, setTab] = useState<'pool' | 'listings' | 'sellers'>('pool');
  const [pool, setPool] = useState<FulfilmentOrderRecord[]>([]);
  const [listings, setListings] = useState<ResourceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Seller Grant form
  const [grantMemberId, setGrantMemberId] = useState('');
  const [grantPlan, setGrantPlan] = useState<SellerPlan>('one_year');
  const [granting, setGranting] = useState(false);

  // Seller Revoke form
  const [revokeAccessId, setRevokeAccessId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Modals
  const [hideListingTarget, setHideListingTarget] = useState<ResourceRecord | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<FulfilmentOrderRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [poolRes, listingsRes] = await Promise.all([
        api.get<FulfilmentOrderRecord[]>('/marketplace/fulfilment-pool'),
        api.get<ResourceRecord[]>('/marketplace/listings'),
      ]);
      setPool(Array.isArray(poolRes.data) ? poolRes.data : []);
      setListings(Array.isArray(listingsRes.data) ? listingsRes.data : []);
    } catch (err) {
      toast.error(
        'Failed to load marketplace data',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCloseOrder = async (order: FulfilmentOrderRecord) => {
    try {
      await api.patch(`/marketplace/orders/${order.id}/close`);
      toast.success('Order closed', 'Receipt confirmation acknowledged.');
      loadData();
    } catch (err) {
      toast.error('Failed to close order', err instanceof ApiError ? err.message : undefined);
    }
  };

  const handleCancelOrder = async (reason: string) => {
    if (!cancelOrderTarget) return;
    try {
      await api.patch(`/marketplace/orders/${cancelOrderTarget.id}/cancel`, { reason });
      toast.success('Order cancelled', 'Hard-copy stock has been restored.');
      loadData();
    } catch (err) {
      toast.error('Cancellation failed', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleHideListing = async (reason: string) => {
    if (!hideListingTarget) return;
    try {
      await api.patch(`/marketplace/listings/${hideListingTarget.id}/hide`, { reason });
      toast.success('Listing hidden', 'Removed from marketplace visibility.');
      loadData();
    } catch (err) {
      toast.error('Failed to hide listing', err instanceof ApiError ? err.message : undefined);
      throw err;
    }
  };

  const handleGrantSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUuid(grantMemberId)) {
      toast.warning('Enter a valid verified Member UUID');
      return;
    }
    setGranting(true);
    try {
      await api.post('/marketplace/sellers/grant', {
        memberId: grantMemberId.trim(),
        plan: grantPlan,
      });
      toast.success(
        'Seller access granted',
        `Plan: ${SELLER_PLAN_LABELS[grantPlan]} (non-financial recording).`,
      );
      setGrantMemberId('');
    } catch (err) {
      toast.error('Grant failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUuid(revokeAccessId)) {
      toast.warning('Enter a valid Seller Access UUID');
      return;
    }
    setRevoking(true);
    try {
      await api.patch(`/marketplace/sellers/${revokeAccessId.trim()}/revoke`, {
        reason: revokeReason.trim(),
      });
      toast.success('Seller access revoked', 'Seller listings are now hidden.');
      setRevokeAccessId('');
      setRevokeReason('');
    } catch (err) {
      toast.error('Revocation failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace Governance"
        description="Authorize verified sellers, moderate active church listings, and oversee the hard-copy fulfilment pool. Payments are not processed in the MVP."
        badge={<Badge tone="gold">Non-Financial Mode</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              <button
                type="button"
                onClick={() => setTab('pool')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'pool' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Fulfilment Pool ({pool.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('listings')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'listings' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Active Listings ({listings.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('sellers')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  tab === 'sellers' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Seller Access
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={loadData} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {/* Domain guardrail notice */}
      <div className="flex items-start gap-3 rounded-xl border border-[#d48a1f]/35 bg-[#0a542d]/6 px-4 py-3 text-xs text-[#9b5f0d]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Request &amp; Arrange Mode (payment_status = not_enabled):</strong> Prices are
          informational only. No payments, token fees, or settlements are processed through this
          console.
        </p>
      </div>

      {tab === 'pool' ? (
        loading ? (
          <LoadingRows count={4} />
        ) : pool.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="h-6 w-6" />}
            title="Fulfilment pool is empty"
            description="Accepted hard-copy orders awaiting delivery or receipt confirmation will appear here."
          />
        ) : (
          <div className="space-y-3.5">
            {pool.map((order) => (
              <Card key={order.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#16241b]">
                        {order.resource?.title || order.resourceId}
                      </h3>
                      <Badge tone={statusTone(order.status)}>
                        {formatEnumLabel(order.status)}
                      </Badge>
                      <Badge tone="neutral">Qty: {order.quantity}</Badge>
                      <Badge tone="amber">
                        <Clock className="h-3 w-3" />
                        Waiting: {formatWaitingTime(order.acceptedAt, order.waitingHours)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#56635a]">
                      <span>Buyer: {order.buyer?.fullName || order.buyerId.slice(0, 8)}</span>
                      <span>Seller: {order.seller?.fullName || order.sellerId.slice(0, 8)}</span>
                      <span>Church: {order.church?.name || order.churchId}</span>
                      <span>Accepted: {formatDateTime(order.acceptedAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {order.status === 'received' && (
                      <Button
                        variant="emerald"
                        size="sm"
                        onClick={() => handleCloseOrder(order)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Acknowledge &amp; Close
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setCancelOrderTarget(order)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel Order
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === 'listings' ? (
        loading ? (
          <LoadingRows count={4} />
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title="No active marketplace listings"
            description="Approved paid resources from active sellers will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {listings.map((item) => (
              <Card key={item.id} className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#16241b]">{item.title}</h3>
                    <Badge tone="gold">{formatNgn(item.price)}</Badge>
                    <Badge tone="neutral">{formatEnumLabel(item.format)}</Badge>
                    <Badge tone="neutral">
                      {RESOURCE_CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#3e4c42] line-clamp-2">{item.description}</p>
                  <p className="text-[11px] text-[#56635a]">
                    Seller: {item.owner?.fullName || item.ownerId.slice(0, 8)} ·{' '}
                    {item.church?.name || item.churchId}
                    {item.format === 'hard_copy' ? ` · Stock: ${item.stock ?? 0}` : ''}
                  </p>
                </div>
                <div className="flex justify-end border-t border-[#e4dfd3] pt-3">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setHideListingTarget(item)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide Listing
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grant Seller Access */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-[#16241b] flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#0a542d]" />
              Grant Seller Access Period
            </h2>
            <p className="mt-1 text-xs text-[#56635a]">
              Approve a verified member to list paid resources in their church marketplace.
            </p>
            <form onSubmit={handleGrantSeller} className="mt-4 space-y-4">
              <div>
                <FieldLabel required>Verified Member UUID</FieldLabel>
                <Input
                  value={grantMemberId}
                  onChange={(e) => setGrantMemberId(e.target.value)}
                  placeholder="UUID of verified member"
                  required
                />
              </div>
              <div>
                <FieldLabel required>Access Period Plan</FieldLabel>
                <Select
                  value={grantPlan}
                  onChange={(e) => setGrantPlan(e.target.value as SellerPlan)}
                >
                  {Object.entries(SELLER_PLAN_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="primary" loading={granting}>
                Grant Seller Access
              </Button>
            </form>
          </Card>

          {/* Revoke Seller Access */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-[#16241b] flex items-center gap-2">
              <UserX className="h-4 w-4 text-[#b83227]" />
              Revoke Seller Access
            </h2>
            <p className="mt-1 text-xs text-[#56635a]">
              Immediately revoke an active seller access record and hide their listings (MKT-05).
            </p>
            <form onSubmit={handleRevokeSeller} className="mt-4 space-y-4">
              <div>
                <FieldLabel required>Seller Access UUID</FieldLabel>
                <Input
                  value={revokeAccessId}
                  onChange={(e) => setRevokeAccessId(e.target.value)}
                  placeholder="UUID of SellerAccess record"
                  required
                />
              </div>
              <div>
                <FieldLabel required>Revocation Reason</FieldLabel>
                <Input
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Listing policy violation"
                  required
                />
              </div>
              <Button type="submit" variant="danger" loading={revoking}>
                Revoke Seller Access
              </Button>
            </form>
          </Card>
        </div>
      )}

      <ReasonModal
        open={Boolean(hideListingTarget)}
        onClose={() => setHideListingTarget(null)}
        title="Hide Marketplace Listing"
        description={`Hiding "${hideListingTarget?.title}" removes it from marketplace browsing and notifies the seller.`}
        confirmLabel="Hide Listing"
        onConfirm={handleHideListing}
      />

      <ReasonModal
        open={Boolean(cancelOrderTarget)}
        onClose={() => setCancelOrderTarget(null)}
        title="Cancel Fulfilment Order"
        description="Cancelling an accepted hard-copy order restores the reserved stock quantity (ORD-10)."
        confirmLabel="Cancel Order"
        onConfirm={handleCancelOrder}
      />
    </div>
  );
}
