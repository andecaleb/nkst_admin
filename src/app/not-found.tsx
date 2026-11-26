import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf7f0] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e4dfd3] bg-white p-8 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#b83227]">404</p>
        <h1 className="mt-2 text-xl font-bold text-[#16241b]">Page Not Found</h1>
        <p className="mt-2 text-sm text-[#56635a]">
          The requested admin page does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#0a542d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#063b20]"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
