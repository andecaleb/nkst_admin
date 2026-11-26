'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api-client';
import { Button, FieldLabel, Input, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

type Mode = 'login' | 'recover_request' | 'recover_reset';

export default function LoginPage() {
  const { login, isAuthenticated, hasAdminAccess, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated && hasAdminAccess) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, hasAdminAccess, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      toast.success('Signed in to NKST Admin Console');
      router.replace('/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to sign in. Check credentials.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ message?: string; devOtp?: string }>(
        '/auth/password-recovery/request',
        { identifier: identifier.trim(), channel },
        true,
      );
      setDevOtpHint(res.data?.devOtp || null);
      toast.success('Recovery OTP sent', res.data?.message);
      setMode('recover_reset');
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Failed to request recovery OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.post(
        '/auth/password-recovery/reset',
        {
          identifier: identifier.trim(),
          channel,
          code: otpCode.trim(),
          newPassword,
        },
        true,
      );
      toast.success('Password updated', 'You can now sign in with your new password.');
      setMode('login');
      setPassword('');
      setOtpCode('');
      setNewPassword('');
      setDevOtpHint(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDevCredentials = () => {
    setIdentifier('admin@nkst.org.ng');
    setPassword('ChangeMe@123!');
    setErrorMsg(null);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#063b20] bg-cover bg-center bg-no-repeat px-4 py-10"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Atmospheric sanctuary green & warm sunrise overlay for readability */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(6,59,32,0.72) 0%, rgba(16,36,27,0.48) 50%, rgba(6,59,32,0.76) 100%)',
        }}
      />

      {/* Top sunrise gold & sanctuary green ribbon */}
      <div className="fixed inset-x-0 top-0 z-20 h-1.5 bg-gradient-to-r from-[#063b20] via-[#d48a1f] to-[#f5c76b]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3.5 flex h-22 w-22 items-center justify-center rounded-full bg-white/95 p-1.5 shadow-xl ring-2 ring-[#f5c76b]/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nkst-logo.png"
              alt="NKST — Nongo u Kristu u i Ser u sha Tar"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            NKST Admin Console
          </h1>
          <p className="mt-1 text-xs font-semibold text-[#f5c76b] drop-shadow-xs">
            Nongo u Kristu u i Ser u sha Tar · Est. 1957
          </p>
          <p className="mt-1 text-xs text-white/85">
            Congregation governance, verification &amp; community moderation
          </p>
        </div>

        <div className="rounded-2xl border border-[#f5c76b]/35 bg-[#faf7f0]/95 p-7 shadow-2xl backdrop-blur-md">
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-[#b83227]/30 bg-[#fdeceb] px-4 py-3 text-xs font-medium text-[#9c261d] leading-relaxed">
              {errorMsg}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <FieldLabel required>Email or Phone</FieldLabel>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@nkst.org.ng or +234..."
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#3e4c42]">
                    Password <span className="text-[#b83227]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recover_request');
                      setErrorMsg(null);
                    }}
                    className="text-xs font-semibold text-[#a96910] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" variant="primary" loading={submitting} className="w-full py-2.5">
                Sign In to Console
              </Button>

              <div className="pt-3 border-t border-[#e4dfd3]">
                <button
                  type="button"
                  onClick={fillDevCredentials}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d48a1f]/35 bg-[#fef6e6] px-3 py-2 text-xs font-semibold text-[#9b5f0d] hover:bg-[#fdecc8] transition-colors cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#d48a1f]" />
                  Fill Dev Platform Admin (admin@nkst.org.ng)
                </button>
              </div>
            </form>
          )}

          {mode === 'recover_request' && (
            <form onSubmit={handleRequestRecovery} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#063b20]">
                <KeyRound className="h-4 w-4 text-[#d48a1f]" />
                Password Recovery
              </div>
              <p className="text-xs text-[#56635a]">
                Request a one-time verification code via your registered email or phone number.
              </p>

              <div>
                <FieldLabel required>Email or Phone</FieldLabel>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@nkst.org.ng"
                  required
                />
              </div>

              <div>
                <FieldLabel required>Delivery Channel</FieldLabel>
                <Select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'email' | 'phone')}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone (SMS)</option>
                </Select>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" variant="primary" loading={submitting} className="flex-1">
                  Send Recovery Code
                </Button>
              </div>
            </form>
          )}

          {mode === 'recover_reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#063b20]">
                <KeyRound className="h-4 w-4 text-[#d48a1f]" />
                Enter Recovery Code
              </div>

              {devOtpHint && (
                <div className="rounded-lg border border-[#1e7e45]/35 bg-[#eaf6ee] px-3.5 py-2 text-xs text-[#0a542d]">
                  Dev OTP: <strong className="font-mono">{devOtpHint}</strong>
                </div>
              )}

              <div>
                <FieldLabel required>OTP Code</FieldLabel>
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit OTP code"
                  required
                />
              </div>

              <div>
                <FieldLabel required>New Password</FieldLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode('recover_request')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" variant="primary" loading={submitting} className="flex-1">
                  Reset Password
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-white/80 drop-shadow-xs">
          NKST National Headquarters, Mkar · API: <span className="font-mono">{api.baseUrl}</span>
        </p>
      </div>
    </div>
  );
}
