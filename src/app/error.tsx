'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf7f0] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#b83227]/30 bg-white p-8 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#b83227]">
          Application Error
        </p>
        <h1 className="mt-2 text-xl font-bold text-[#16241b]">Something went wrong</h1>
        <p className="mt-2 text-xs text-[#56635a] leading-relaxed">
          {error.message || 'An unexpected error occurred while rendering this view.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#0a542d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#063b20] cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
