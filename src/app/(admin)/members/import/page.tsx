'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Play,
  Square,
  ArrowLeft,
  ShieldCheck,
  Info,
  RotateCcw,
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
  PageHeader,
  Select,
  StatCard,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import {
  downloadMemberImportTemplate,
  exportImportResultsReport,
  parseMembersSpreadsheet,
  type ImportRowStatus,
  type ParsedMemberRow,
} from '@/lib/member-import';
import type { ChurchRecord, MemberProfile } from '@/types/api';

type FilterView = 'all' | 'ready' | 'duplicates' | 'invalid' | 'done';

const STATUS_BADGE: Record<
  ImportRowStatus,
  { label: string; tone: 'emerald' | 'amber' | 'danger' | 'gold' | 'neutral' }
> = {
  ready: { label: 'Ready', tone: 'gold' },
  duplicate_in_file: { label: 'Duplicate (File)', tone: 'amber' },
  invalid: { label: 'Invalid', tone: 'danger' },
  importing: { label: 'Importing…', tone: 'gold' },
  imported: { label: 'Imported', tone: 'emerald' },
  imported_verified: { label: 'Imported & Verified', tone: 'emerald' },
  duplicate_in_db: { label: 'Already Exists (DB)', tone: 'amber' },
  failed: { label: 'Failed', tone: 'danger' },
};

export default function ImportMembersPage() {
  const { member, isPlatformAdmin, administeredChurchIds } = useAuth();
  const toast = useToast();

  const [churches, setChurches] = useState<ChurchRecord[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState(member?.churchId || '');
  const [defaultPassword, setDefaultPassword] = useState('NkstMember@2026!');
  const [autoGenerateEmail, setAutoGenerateEmail] = useState(true);
  const [autoVerify, setAutoVerify] = useState(true);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedMemberRow[]>([]);
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [parsing, setParsing] = useState(false);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [rateLimitWaitSec, setRateLimitWaitSec] = useState(0);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadChurches = useCallback(async () => {
    try {
      const res = await api.get<ChurchRecord[]>('/churches', {
        status: 'active',
        page: 1,
        limit: 100,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const scoped = isPlatformAdmin
        ? list
        : list.filter(
            (c) =>
              administeredChurchIds.includes(c.id) || c.id === member?.churchId,
          );
      setChurches(scoped.length > 0 ? scoped : list);
      if (!selectedChurchId && (scoped[0] || list[0])) {
        setSelectedChurchId((scoped[0] || list[0]).id);
      }
    } catch (err) {
      toast.error('Failed to load churches', err instanceof ApiError ? err.message : undefined);
    }
  }, [isPlatformAdmin, administeredChurchIds, member?.churchId, selectedChurchId, toast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const qsChurchId = new URLSearchParams(window.location.search).get('churchId');
      if (qsChurchId) {
        setSelectedChurchId(qsChurchId);
      }
    }
  }, []);

  useEffect(() => {
    loadChurches();
  }, [loadChurches]);

  const selectedChurch = useMemo(
    () => churches.find((c) => c.id === selectedChurchId) || null,
    [churches, selectedChurchId],
  );

  const stats = useMemo(() => {
    let ready = 0;
    let duplicates = 0;
    let invalid = 0;
    let imported = 0;
    let failed = 0;
    let selectedReady = 0;

    for (const r of rows) {
      if (r.status === 'ready') {
        ready++;
        if (r.selected) selectedReady++;
      } else if (r.status === 'duplicate_in_file' || r.status === 'duplicate_in_db') {
        duplicates++;
      } else if (r.status === 'invalid') {
        invalid++;
      } else if (r.status === 'imported' || r.status === 'imported_verified') {
        imported++;
      } else if (r.status === 'failed') {
        failed++;
      }
    }
    return { total: rows.length, ready, selectedReady, duplicates, invalid, imported, failed };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterView === 'ready') return r.status === 'ready';
      if (filterView === 'duplicates') {
        return r.status === 'duplicate_in_file' || r.status === 'duplicate_in_db';
      }
      if (filterView === 'invalid') return r.status === 'invalid' || r.status === 'failed';
      if (filterView === 'done') {
        return r.status === 'imported' || r.status === 'imported_verified';
      }
      return true;
    });
  }, [rows, filterView]);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (!selectedChurch) {
      toast.warning('Select a target church first');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20 MB limit');
      return;
    }

    setParsing(true);
    try {
      const parsed = await parseMembersSpreadsheet(file, {
        church: selectedChurch,
        defaultPassword: defaultPassword.trim() || 'NkstMember@2026!',
        autoGenerateEmail,
      });
      setRows(parsed);
      setFileName(file.name);
      setFilterView('all');

      const dupCount = parsed.filter((r) => r.status === 'duplicate_in_file').length;
      const errCount = parsed.filter((r) => r.status === 'invalid').length;
      const okCount = parsed.filter((r) => r.status === 'ready').length;

      toast.success(
        `Parsed ${parsed.length} rows from ${file.name}`,
        `${okCount} ready · ${dupCount} in-file duplicate(s) · ${errCount} invalid`,
      );
    } catch (err) {
      toast.error(
        'Could not parse spreadsheet',
        err instanceof Error ? err.message : 'Ensure the file is a valid .xlsx, .xls, or .csv.',
      );
    } finally {
      setParsing(false);
    }
  };

  const toggleRowSelection = (rowNumber: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowNumber === rowNumber && r.status === 'ready'
          ? { ...r, selected: !r.selected }
          : r,
      ),
    );
  };

  const updateRowState = (rowNumber: number, patch: Partial<ParsedMemberRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)),
    );
  };

  const sleepWithCountdown = async (seconds: number) => {
    for (let s = seconds; s > 0; s--) {
      if (cancelRef.current) break;
      setRateLimitWaitSec(s);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setRateLimitWaitSec(0);
  };

  const handleStartImport = async () => {
    if (!selectedChurch) {
      toast.warning('Please select an active NKST church');
      return;
    }
    const queue = rows.filter((r) => r.status === 'ready' && r.selected);
    if (queue.length === 0) {
      toast.warning('No valid rows selected for import');
      return;
    }

    cancelRef.current = false;
    setImporting(true);
    setProgress({ processed: 0, total: queue.length });

    let importedCount = 0;
    let dbDupCount = 0;
    let failedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      if (cancelRef.current) break;
      const row = queue[i];
      updateRowState(row.rowNumber, { status: 'importing', resultMessage: 'Registering…' });

      let attempt = 0;
      let completed = false;

      while (!completed && !cancelRef.current && attempt < 3) {
        attempt++;
        try {
          const res = await api.post<{ member?: MemberProfile; message?: string }>(
            '/auth/register',
            {
              firstName: row.firstName,
              middleName: row.middleName || undefined,
              surname: row.surname,
              email: row.email,
              phone: row.phone,
              password: row.password,
              gender: row.gender,
              dateOfBirth: row.dateOfBirth,
              state: row.state,
              lga: row.lga,
              residentialLocation: row.residentialLocation,
              churchId: selectedChurch.id,
              verificationChannel: 'email',
            },
            true,
          );

          const createdId = res.data?.member?.id;
          let finalStatus: ImportRowStatus = 'imported';
          let finalMsg = 'Registered successfully';

          if (autoVerify && createdId) {
            try {
              await api.post('/verification/direct-validate', {
                memberId: createdId,
                decisionNote: `Imported from congregation Excel register (${fileName})`,
              });
              finalStatus = 'imported_verified';
              finalMsg = 'Registered & directly verified';
            } catch (verErr) {
              finalMsg = `Registered (direct verify skipped: ${
                verErr instanceof ApiError ? verErr.message : 'error'
              })`;
            }
          }

          updateRowState(row.rowNumber, {
            status: finalStatus,
            selected: false,
            createdMemberId: createdId,
            resultMessage: finalMsg,
          });
          importedCount++;
          completed = true;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            // MEM-06: Duplicate email or phone already exists in database
            updateRowState(row.rowNumber, {
              status: 'duplicate_in_db',
              selected: false,
              resultMessage: err.message || 'Email or phone already registered on NKST',
            });
            dbDupCount++;
            completed = true;
          } else if (err instanceof ApiError && err.status === 429 && attempt < 3) {
            // Respect backend 10/min registration throttle automatically
            updateRowState(row.rowNumber, {
              status: 'importing',
              resultMessage: 'Rate limit reached (10/min) — waiting to resume…',
            });
            await sleepWithCountdown(62);
          } else {
            updateRowState(row.rowNumber, {
              status: 'failed',
              selected: false,
              resultMessage: err instanceof Error ? err.message : 'Registration failed',
            });
            failedCount++;
            completed = true;
          }
        }
      }

      setProgress({ processed: i + 1, total: queue.length });
    }

    setImporting(false);
    setRateLimitWaitSec(0);

    if (cancelRef.current) {
      toast.warning(
        'Import paused',
        `${importedCount} imported · ${dbDupCount} existing duplicates skipped · ${failedCount} failed`,
      );
    } else {
      toast.success(
        'Bulk member import complete',
        `${importedCount} imported · ${dbDupCount} existing duplicates skipped · ${failedCount} failed`,
      );
    }
  };

  const handleReset = () => {
    setRows([]);
    setFileName('');
    setProgress({ processed: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Member Import (Excel)"
        description="Import congregation members who cannot self-register on a phone. Automatically validates required fields, detects duplicates in the spreadsheet, and skips existing platform records."
        badge={<Badge tone="gold">.XLSX / .CSV</Badge>}
        actions={
          <>
            <Link href="/members">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Members &amp; RBAC
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadMemberImportTemplate(selectedChurch)}
            >
              <Download className="h-3.5 w-3.5 text-[#0a542d]" />
              Download Excel Template
            </Button>
          </>
        }
      />

      {/* Step 1: Configuration & Upload */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-[#063b20] flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#d48a1f]" />
            1. Congregation &amp; Import Settings
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>Target Active Church</FieldLabel>
              <Select
                value={selectedChurchId}
                onChange={(e) => setSelectedChurchId(e.target.value)}
                disabled={importing || (!isPlatformAdmin && churches.length <= 1)}
              >
                <option value="">Select Congregation</option>
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.lga}, {c.state})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <FieldLabel required hint="Min 8 chars (fallback if omitted in Excel)">
                Default Temporary Password
              </FieldLabel>
              <Input
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                disabled={importing}
                placeholder="NkstMember@2026!"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <label className="flex items-start gap-2.5 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateEmail}
                onChange={(e) => setAutoGenerateEmail(e.target.checked)}
                disabled={importing}
                className="mt-0.5 h-4 w-4 accent-[#0a542d]"
              />
              <span>
                <strong className="block text-[#16241b]">
                  Auto-generate placeholder email when blank
                </strong>
                <span className="text-[#56635a]">
                  Generates <code>name.digits@offline.nkst.org.ng</code> for members without email.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoVerify}
                onChange={(e) => setAutoVerify(e.target.checked)}
                disabled={importing}
                className="mt-0.5 h-4 w-4 accent-[#0a542d]"
              />
              <span>
                <strong className="block text-[#16241b]">
                  Auto-verify imported members
                </strong>
                <span className="text-[#56635a]">
                  Immediately validates via {isPlatformAdmin ? 'Pathway D (Platform)' : 'Pathway C (Church)'}.
                </span>
              </span>
            </label>
          </div>
        </Card>

        {/* Step 2: File Dropzone */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#063b20] flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#d48a1f]" />
              2. Upload Spreadsheet
            </h2>
            <p className="mt-1 text-xs text-[#56635a]">
              Supports <code>.xlsx</code>, <code>.xls</code>, and <code>.csv</code> files.
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!importing) handleFileChange(e.dataTransfer.files?.[0]);
            }}
            className="my-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d4ccb9] bg-[#faf7f0] px-4 py-7 text-center hover:border-[#d48a1f] transition-colors"
          >
            <FileSpreadsheet className="h-8 w-8 text-[#0a542d] mb-2" />
            <p className="text-xs font-semibold text-[#16241b]">
              {fileName || 'Drop Excel file here or click browse'}
            </p>
            <p className="mt-0.5 text-[11px] text-[#56635a]">
              Required: First Name, Surname, Phone, Gender, DOB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing || parsing}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="hidden"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={parsing}
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              {rows.length > 0 && !importing && (
                <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-[#56635a] flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#d48a1f] mt-0.5" />
            State, LGA &amp; Town auto-fill from the selected church if left blank.
          </p>
        </Card>
      </div>

      {/* Duplicate & Validation Summary + Preview Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-6 w-6" />}
          title="No spreadsheet loaded yet"
          description="Download the NKST Excel template, fill in the congregation's member list, and upload it above to preview validation and duplicate checks before importing."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => downloadMemberImportTemplate(selectedChurch)}
            >
              <Download className="h-3.5 w-3.5" />
              Download Excel Template (.xlsx)
            </Button>
          }
        />
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Rows Parsed"
              value={stats.total}
              sublabel={`${stats.selectedReady} selected for import`}
              icon={<FileSpreadsheet className="h-5 w-5" />}
              accent="gold"
            />
            <StatCard
              label="Imported"
              value={stats.imported}
              sublabel={autoVerify ? 'Registered & verified' : 'Registered as member'}
              icon={<CheckCircle2 className="h-5 w-5" />}
              accent="emerald"
            />
            <StatCard
              label="Duplicates Detected"
              value={stats.duplicates}
              sublabel="In-file & existing DB matches skipped"
              icon={<Copy className="h-5 w-5" />}
              accent="amber"
            />
            <StatCard
              label="Invalid / Failed"
              value={stats.invalid + stats.failed}
              sublabel="Fix in Excel and re-upload"
              icon={<XCircle className="h-5 w-5" />}
              accent={stats.invalid + stats.failed > 0 ? 'danger' : 'emerald'}
            />
          </div>

          {/* Action & Filter Bar */}
          <Card className="p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1 rounded-lg border border-[#e4dfd3] bg-[#faf7f0] p-1">
                {(
                  [
                    ['all', `All (${stats.total})`],
                    ['ready', `Ready (${stats.ready})`],
                    ['duplicates', `Duplicates (${stats.duplicates})`],
                    ['invalid', `Errors (${stats.invalid + stats.failed})`],
                    ['done', `Imported (${stats.imported})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterView(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      filterView === key
                        ? 'bg-[#0a542d] text-white'
                        : 'text-[#56635a] hover:text-[#16241b]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {stats.imported + stats.duplicates + stats.failed > 0 && !importing && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      exportImportResultsReport(rows, selectedChurch?.name || 'nkst-church')
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Report (.xlsx)
                  </Button>
                )}

                {importing ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop Import
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={stats.selectedReady === 0}
                    onClick={handleStartImport}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Import {stats.selectedReady} Member{stats.selectedReady === 1 ? '' : 's'}
                  </Button>
                )}
              </div>
            </div>

            {importing && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-[#56635a]">
                  <span>
                    Importing into <strong className="text-[#16241b]">{selectedChurch?.name}</strong>
                    {rateLimitWaitSec > 0 && (
                      <span className="ml-2 font-semibold text-[#a96910]">
                        · Pausing {rateLimitWaitSec}s for API rate limit (10/min)…
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-[#0a542d]">
                    {progress.processed} / {progress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8e2d5]">
                  <div
                    className="h-full rounded-full bg-[#0a542d] transition-all"
                    style={{
                      width: `${
                        progress.total > 0
                          ? Math.round((progress.processed / progress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Preview & Duplicate Inspection Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4dfd3] bg-[#f4efe4] text-[11px] uppercase tracking-wider text-[#56635a]">
                    <th className="px-3 py-3 w-12">S/No.</th>
                    <th className="px-3 py-3 w-10">Inc.</th>
                    <th className="px-3 py-3">Row</th>
                    <th className="px-3 py-3">Full Name</th>
                    <th className="px-3 py-3">Phone &amp; Email</th>
                    <th className="px-3 py-3">Gender / DOB</th>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Status &amp; Duplicate Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece7dc]">
                  {filteredRows.map((row, idx) => {
                    const badge = STATUS_BADGE[row.status];
                    const fullName = [row.firstName, row.middleName, row.surname]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <tr
                        key={row.rowNumber}
                        className={
                          row.status === 'duplicate_in_file' || row.status === 'duplicate_in_db'
                            ? 'bg-[#fffbf2]'
                            : row.status === 'invalid' || row.status === 'failed'
                              ? 'bg-[#fff8f7]'
                              : 'hover:bg-[#faf7f0]'
                        }
                      >
                        <td className="px-3 py-3 font-mono text-[#56635a]">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={row.status !== 'ready' || importing}
                            onChange={() => toggleRowSelection(row.rowNumber)}
                            className="h-4 w-4 accent-[#0a542d]"
                          />
                        </td>
                        <td className="px-3 py-3 font-mono text-[#56635a]">#{row.rowNumber}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-[#16241b]">{fullName || '—'}</p>
                          {row.softDuplicateWarning && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#a96910]">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {row.softDuplicateWarning}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-mono text-[#16241b]">{row.phone || '—'}</p>
                          <p className="text-[11px] text-[#56635a]">
                            {row.email || '—'}
                            {row.emailGenerated && (
                              <span className="ml-1 text-[#9b5f0d]">(auto)</span>
                            )}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[#3e4c42] whitespace-nowrap">
                          <span className="capitalize">{row.gender || '—'}</span> ·{' '}
                          {row.dateOfBirth || '—'}
                        </td>
                        <td className="px-3 py-3 text-[#56635a] max-w-[180px] truncate">
                          {[row.residentialLocation, row.lga, row.state]
                            .filter(Boolean)
                            .join(', ')}
                        </td>
                        <td className="px-3 py-3 space-y-1">
                          <Badge tone={badge.tone}>
                            {row.status === 'imported_verified' && (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            {badge.label}
                          </Badge>
                          {row.duplicateNote && (
                            <p className="text-[11px] text-[#a96910]">{row.duplicateNote}</p>
                          )}
                          {row.errors.length > 0 && (
                            <p className="text-[11px] text-[#9c261d]">
                              {row.errors.join(' · ')}
                            </p>
                          )}
                          {row.resultMessage && (
                            <p className="text-[11px] text-[#56635a]">{row.resultMessage}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
