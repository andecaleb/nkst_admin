'use client';

import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';

// ============================================================================
// Badges (Sanctuary Forest Green, Sunrise Gold, Sky Slate, Warm Crimson)
// ============================================================================

export type BadgeTone = 'gold' | 'emerald' | 'amber' | 'danger' | 'neutral';

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const toneClasses: Record<BadgeTone, string> = {
    gold: 'bg-[#fef6e6] text-[#9b5f0d] border-[#d48a1f]/35',
    emerald: 'bg-[#eaf6ee] text-[#0a542d] border-[#1e7e45]/30',
    amber: 'bg-[#fff4de] text-[#a96910] border-[#e5a435]/45',
    danger: 'bg-[#fdeceb] text-[#9c261d] border-[#b83227]/30',
    neutral: 'bg-[#f2ede2] text-[#46534a] border-[#dfd8c8]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status?: string | null): BadgeTone {
  switch (status) {
    case 'verified':
    case 'approved':
    case 'active':
    case 'published':
    case 'fulfilled':
    case 'closed':
      return 'emerald';
    case 'pending_verification':
    case 'pending_review':
    case 'pending':
    case 'submitted':
    case 'ready_for_review':
    case 'needs_correction':
    case 'awaiting_delivery':
    case 'received':
    case 'open':
    case 'draft':
      return 'amber';
    case 'rejected':
    case 'suspended':
    case 'removed':
    case 'inactive':
    case 'revoked':
    case 'cancelled':
    case 'declined':
      return 'danger';
    case 'PLATFORM_ADMIN':
    case 'CHURCH_ADMIN':
    case 'GROUP_ADMIN':
      return 'gold';
    default:
      return 'neutral';
  }
}

// ============================================================================
// Buttons
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'emerald' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-[#0a542d] text-white hover:bg-[#063b20] font-semibold border border-[#0a542d] shadow-xs',
    secondary:
      'bg-white text-[#16241b] hover:bg-[#f6f1e6] border border-[#dad3c4] font-medium',
    emerald:
      'bg-[#1e7e45] text-white hover:bg-[#156234] border border-[#1e7e45] font-semibold shadow-xs',
    danger:
      'bg-[#b83227] text-white hover:bg-[#96261d] border border-[#b83227] font-semibold shadow-xs',
    ghost:
      'bg-transparent text-[#56635a] hover:bg-[#f2ede2] hover:text-[#16241b] border border-transparent',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-lg',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ============================================================================
// Form Inputs
// ============================================================================

const baseInputClass =
  'w-full rounded-lg border border-[#dad3c4] bg-white px-3.5 py-2 text-sm text-[#16241b] placeholder:text-[#869189] focus:border-[#d48a1f] focus:outline-none focus:ring-2 focus:ring-[#d48a1f]/20 transition-colors disabled:bg-[#f5f1e8] disabled:text-[#78847c]';

export function Input({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${baseInputClass} ${className}`} {...props} />;
}

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${baseInputClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${baseInputClass} min-h-[88px] ${className}`} {...props} />;
}

export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#3e4c42]">
        {children}
        {required && <span className="ml-1 text-[#b83227]">*</span>}
      </label>
      {hint && <span className="text-[11px] text-[#56635a]">{hint}</span>}
    </div>
  );
}

// ============================================================================
// Surfaces, Cards, Page Header & Empty State
// ============================================================================

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#e4dfd3] bg-white shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent = 'gold',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  accent?: 'gold' | 'emerald' | 'amber' | 'danger';
}) {
  const accentBg = {
    gold: 'bg-[#fef6e6] text-[#b57012] border-[#d48a1f]/30',
    emerald: 'bg-[#eaf6ee] text-[#0a542d] border-[#1e7e45]/25',
    amber: 'bg-[#fff4de] text-[#a96910] border-[#e5a435]/35',
    danger: 'bg-[#fdeceb] text-[#b83227] border-[#b83227]/25',
  }[accent];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#56635a]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#16241b]">
            {value}
          </p>
          {sublabel && <p className="mt-1 text-xs text-[#56635a]">{sublabel}</p>}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${accentBg}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-[#e4dfd3] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#063b20]">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-sm text-[#56635a] max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d4ccb9] bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef6e6] text-[#d48a1f]">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[#16241b]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#56635a] leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="h-16 w-full animate-pulse rounded-xl border border-[#e4dfd3] bg-white"
        />
      ))}
    </div>
  );
}

// ============================================================================
// Modal & Mandatory Reason Confirmation Modal
// ============================================================================

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#062414]/55 p-4 backdrop-blur-xs">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl border border-[#e4dfd3] bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e4dfd3] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#063b20]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-[#56635a]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#56635a] hover:bg-[#f2ede2] hover:text-[#16241b]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function ReasonModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Provide a clear reason for the audit log...',
  required = true,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  required?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (required && !reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel required={required}>{reasonLabel}</FieldLabel>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            required={required}
          />
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={confirmVariant}
            loading={submitting}
            disabled={required && !reason.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
