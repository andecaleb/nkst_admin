'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Plus,
  Search,
  RefreshCw,
  Crown,
  ArrowRight,
  Users,
  ArrowUpDown,
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
  Select,
  statusTone,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatEnumLabel } from '@/lib/format';
import type {
  AdminCounts,
  ChurchMapPin,
  ChurchRecord,
  ChurchStatus,
  NigerianLocation,
  PaginationMeta,
} from '@/types/api';

type SortKey = 'name' | 'state' | 'lga' | 'members' | 'status';

export default function ChurchesPage() {
  const { isPlatformAdmin, administeredChurchIds } = useAuth();
  const toast = useToast();

  const [view, setView] = useState<'table' | 'map'>('table');
  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [memberCountMap, setMemberCountMap] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState<Partial<PaginationMeta>>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);

  const [mapPins, setMapPins] = useState<ChurchMapPin[]>([]);
  const [locations, setLocations] = useState<NigerianLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [lgaFilter, setLgaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChurchStatus | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Create Church modal
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formState, setFormState] = useState('Benue');
  const [formLga, setFormLga] = useState('');
  const [formTown, setFormTown] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formPhones, setFormPhones] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      const res = await api.get<NigerianLocation[] | Record<string, string[]>>(
        '/churches/locations',
        undefined,
        true,
      );
      if (Array.isArray(res.data)) {
        setLocations(res.data);
      } else if (res.data && typeof res.data === 'object') {
        setLocations(
          Object.entries(res.data).map(([state, lgas]) => ({
            state,
            lgas: Array.isArray(lgas) ? lgas : [],
          })),
        );
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const loadChurches = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, pinsRes, countsRes] = await Promise.all([
        api.get<ChurchRecord[]>('/churches', {
          search: search.trim() || undefined,
          state: stateFilter || undefined,
          lga: lgaFilter || undefined,
          status: statusFilter || undefined,
          page,
          limit: 20,
        }),
        api.get<ChurchMapPin[]>('/churches/map', {
          state: stateFilter || undefined,
        }),
        api
          .get<AdminCounts>('/audit/counts')
          .catch(() => ({ data: null as AdminCounts | null })),
      ]);

      const rawChurches = Array.isArray(listRes.data) ? listRes.data : [];
      const scopedChurches = isPlatformAdmin
        ? rawChurches
        : rawChurches.filter((c) => administeredChurchIds.includes(c.id));

      setChurches(scopedChurches);
      if (listRes.meta) {
        setPagination(
          isPlatformAdmin
            ? listRes.meta
            : { page: 1, totalPages: 1, total: scopedChurches.length },
        );
      }
      const rawPins = Array.isArray(pinsRes.data) ? pinsRes.data : [];
      setMapPins(
        isPlatformAdmin
          ? rawPins
          : rawPins.filter((p) => administeredChurchIds.includes(p.id)),
      );

      if (countsRes.data?.membersByChurch) {
        const map: Record<string, number> = {};
        countsRes.data.membersByChurch.forEach((entry) => {
          map[entry.churchId] = entry.count;
        });
        setMemberCountMap(map);
      }
    } catch (err) {
      toast.error('Failed to load churches', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, lgaFilter, statusFilter, page, isPlatformAdmin, administeredChurchIds, toast]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadChurches();
  }, [loadChurches]);

  const filterLgas = useMemo(() => {
    const found = locations.find((l) => l.state === stateFilter);
    return found?.lgas ?? [];
  }, [locations, stateFilter]);

  const formLgas = useMemo(() => {
    const found = locations.find((l) => l.state === formState);
    return found?.lgas ?? [];
  }, [locations, formState]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedChurches = useMemo(() => {
    const copy = [...churches];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      if (sortKey === 'members') {
        const ma = memberCountMap[a.id] ?? a._count?.members ?? 0;
        const mb = memberCountMap[b.id] ?? b._count?.members ?? 0;
        return (ma - mb) * dir;
      }
      const va = String(a[sortKey] || '').toLowerCase();
      const vb = String(b[sortKey] || '').toLowerCase();
      return va.localeCompare(vb) * dir;
    });
    return copy;
  }, [churches, memberCountMap, sortKey, sortDir]);

  const getAdminDisplayName = (church: ChurchRecord) => {
    const admin = church.adminMember;
    if (!admin) return null;
    if ('fullName' in admin && admin.fullName) return admin.fullName;
    if ('firstName' in admin) return `${admin.firstName} ${admin.surname}`.trim();
    return null;
  };

  const openCreateModal = () => {
    setFormName('');
    setFormState(locations[0]?.state || 'Benue');
    setFormLga('');
    setFormTown('');
    setFormAddress('');
    setFormLandmark('');
    setFormPhones('');
    setFormEmail('');
    setFormLat('');
    setFormLng('');
    setFormOpen(true);
  };

  const handleCreateChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const phones = formPhones
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const latNum = formLat.trim() ? Number(formLat) : undefined;
    const lngNum = formLng.trim() ? Number(formLng) : undefined;

    try {
      await api.post('/churches', {
        name: formName.trim(),
        state: formState,
        lga: formLga.trim(),
        town: formTown.trim(),
        address: formAddress.trim(),
        landmark: formLandmark.trim() || undefined,
        phones: phones.length > 0 ? phones : ['+2340000000000'],
        email: formEmail.trim() || undefined,
        latitude: latNum,
        longitude: lngNum,
      });
      toast.success('Church created');
      setFormOpen(false);
      loadChurches();
    } catch (err) {
      toast.error('Failed to create church', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Churches & Congregations"
        description="Browse NKST congregations in a structured directory table. Open any church to inspect full details, members, posts, gallery, resources, and admin settings."
        badge={<Badge tone="gold">{pagination.total ?? churches.length} Churches</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[#e4dfd3] bg-white p-1">
              <button
                type="button"
                onClick={() => setView('table')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  view === 'table' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Directory Table
              </button>
              <button
                type="button"
                onClick={() => setView('map')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  view === 'map' ? 'bg-[#0a542d] text-white' : 'text-[#3e4c42]'
                }`}
              >
                Geo-Locations ({mapPins.length})
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={loadChurches} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {isPlatformAdmin && (
              <Button variant="primary" size="sm" onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                Add Church
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6c7870]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search church name or town..."
              className="pl-9"
            />
          </div>
          <Select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setLgaFilter('');
              setPage(1);
            }}
          >
            <option value="">All States</option>
            {locations.map((loc) => (
              <option key={loc.state} value={loc.state}>
                {loc.state}
              </option>
            ))}
          </Select>
          <Select
            value={lgaFilter}
            onChange={(e) => {
              setLgaFilter(e.target.value);
              setPage(1);
            }}
            disabled={!stateFilter}
          >
            <option value="">All LGAs</option>
            {filterLgas.map((lga) => (
              <option key={lga} value={lga}>
                {lga}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ChurchStatus | '');
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingRows count={6} />
      ) : view === 'table' ? (
        sortedChurches.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No churches match your filters"
            description="Adjust your search or state/LGA filters, or add a new congregation record."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                    <th className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className="inline-flex items-center gap-1 font-semibold hover:text-[#063b20] cursor-pointer"
                      >
                        Church Name
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleSort('lga')}
                        className="inline-flex items-center gap-1 font-semibold hover:text-[#063b20] cursor-pointer"
                      >
                        LGA / State
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3.5">Town</th>
                    <th className="px-4 py-3.5">Church Admin</th>
                    <th className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('members')}
                        className="inline-flex items-center gap-1 font-semibold hover:text-[#063b20] cursor-pointer"
                      >
                        Members
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleSort('status')}
                        className="inline-flex items-center gap-1 font-semibold hover:text-[#063b20] cursor-pointer"
                      >
                        Status
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece7dc]">
                  {sortedChurches.map((church) => {
                    const memberCount =
                      memberCountMap[church.id] ?? church._count?.members ?? 0;
                    const adminName = getAdminDisplayName(church);
                    return (
                      <tr
                        key={church.id}
                        className="hover:bg-[#faf7f0] transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/churches/${church.id}`}
                              className="font-semibold text-[#063b20] hover:text-[#0a542d] hover:underline"
                            >
                              {church.name}
                            </Link>
                            {church.isHeadquarters && (
                              <Badge tone="gold">
                                <Crown className="h-3 w-3" />
                                HQ
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[#3e4c42]">
                          <span className="font-medium text-[#16241b]">{church.lga}</span>
                          <span className="text-[#56635a]">, {church.state}</span>
                        </td>
                        <td className="px-4 py-3.5 text-[#56635a]">{church.town}</td>
                        <td className="px-4 py-3.5">
                          {adminName ? (
                            <span className="text-[#16241b] font-medium">{adminName}</span>
                          ) : (
                            <span className="text-[#869189] italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#0a542d]">
                            <Users className="h-3.5 w-3.5 text-[#d48a1f]" />
                            {memberCount}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={statusTone(church.status)}>
                            {formatEnumLabel(church.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Link href={`/churches/${church.id}`}>
                            <Button variant="secondary" size="sm">
                              Open Church
                              <ArrowRight className="h-3.5 w-3.5 text-[#0a542d]" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {(pagination.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between border-t border-[#e4dfd3] bg-[#faf7f0] px-4 py-3 text-xs text-[#56635a]">
                <span>
                  Page <strong className="text-[#16241b]">{pagination.page ?? page}</strong> of{' '}
                  <strong className="text-[#16241b]">{pagination.totalPages ?? 1}</strong> ·{' '}
                  {pagination.total ?? churches.length} total congregations
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
        )
      ) : (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-[#16241b] mb-3">
            Congregation Geo-Location Pins
          </h2>
          {mapPins.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="No geo-located churches found"
              description="Add latitude and longitude coordinates to church records to populate the map view."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mapPins.map((pin) => (
                <div
                  key={pin.id}
                  className="rounded-xl border border-[#e4dfd3] bg-[#faf7f0] p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/churches/${pin.id}`}
                      className="text-sm font-semibold text-[#063b20] hover:underline"
                    >
                      {pin.name}
                    </Link>
                    <Badge tone={statusTone(pin.status)}>{pin.status}</Badge>
                  </div>
                  <p className="text-xs text-[#56635a]">
                    {pin.town}, {pin.lga}, {pin.state}
                  </p>
                  {pin.latitude != null && pin.longitude != null ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${pin.latitude}&mlon=${pin.longitude}#map=14/${pin.latitude}/${pin.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#0a542d] hover:underline font-mono"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                    </a>
                  ) : (
                    <p className="text-xs text-[#6c7870]">Coordinates not set</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Create Church Modal (Platform Admin) */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Register New NKST Church"
        description="Complete the congregation directory record."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateChurch} className="space-y-4">
          <div>
            <FieldLabel required>Church Name</FieldLabel>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. NKST Church Iortyer"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>State</FieldLabel>
              <Select
                value={formState}
                onChange={(e) => {
                  setFormState(e.target.value);
                  setFormLga('');
                }}
              >
                {locations.length > 0 ? (
                  locations.map((loc) => (
                    <option key={loc.state} value={loc.state}>
                      {loc.state}
                    </option>
                  ))
                ) : (
                  <option value="Benue">Benue</option>
                )}
              </Select>
            </div>
            <div>
              <FieldLabel required>LGA</FieldLabel>
              {formLgas.length > 0 ? (
                <Select
                  value={formLga}
                  onChange={(e) => setFormLga(e.target.value)}
                  required
                >
                  <option value="">Select LGA</option>
                  {formLgas.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={formLga}
                  onChange={(e) => setFormLga(e.target.value)}
                  placeholder="e.g. Gboko"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>Town / Community</FieldLabel>
              <Input
                value={formTown}
                onChange={(e) => setFormTown(e.target.value)}
                placeholder="e.g. Mkar"
                required
              />
            </div>
            <div>
              <FieldLabel>Landmark</FieldLabel>
              <Input
                value={formLandmark}
                onChange={(e) => setFormLandmark(e.target.value)}
                placeholder="Near University of Mkar"
              />
            </div>
          </div>

          <div>
            <FieldLabel required>Street Address</FieldLabel>
            <Input
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="Full congregation address"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required hint="Comma-separated">
                Contact Phone(s)
              </FieldLabel>
              <Input
                value={formPhones}
                onChange={(e) => setFormPhones(e.target.value)}
                placeholder="+2348030000001"
                required
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="church@nkst.org.ng"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Latitude</FieldLabel>
              <Input
                type="number"
                step="any"
                value={formLat}
                onChange={(e) => setFormLat(e.target.value)}
                placeholder="7.3167"
              />
            </div>
            <div>
              <FieldLabel>Longitude</FieldLabel>
              <Input
                type="number"
                step="any"
                value={formLng}
                onChange={(e) => setFormLng(e.target.value)}
                placeholder="9.0333"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create Church
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
