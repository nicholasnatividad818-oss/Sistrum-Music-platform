import { FormEvent, useState } from 'react';
import { KeyRound, Loader2, LogIn, UserPlus, X } from 'lucide-react';
import { sendPasswordReset, signIn, signUp } from '../services/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  onOpenTerms,
  onOpenPrivacy,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'signup') {
        if (!accepted) throw new Error('Accept the Terms and Privacy Policy to create an account.');
        if (displayName.trim().length < 2) throw new Error('Enter an artist or display name.');
        const result = await signUp(email.trim(), password, displayName.trim());
        if (!result.session) {
          setMessage('Check your email to confirm your Sistrum account, then sign in.');
          setMode('signin');
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await sendPasswordReset(email.trim());
      setMessage('Password reset instructions were sent if that address has an account.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send reset instructions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#ff5500]">
              Private beta
            </div>
            <h2 id="auth-title" className="text-2xl font-black text-white">
              {mode === 'signin' ? 'Welcome back' : 'Create your artist account'}
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              {mode === 'signin'
                ? 'Sign in to upload, comment, follow, and build playlists.'
                : 'Sistrum is currently accepting a limited group of early artists.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white"
            aria-label="Close sign in"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-neutral-300">Artist or display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-[#ff5500]"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-neutral-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-[#ff5500]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-neutral-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-[#ff5500]"
            />
          </label>

          {mode === 'signup' && (
            <label className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 accent-[#ff5500]"
              />
              <span>
                I own or control the rights to what I upload and agree to the{' '}
                <button type="button" onClick={onOpenTerms} className="text-[#ff5500] underline">
                  Terms
                </button>{' '}
                and{' '}
                <button type="button" onClick={onOpenPrivacy} className="text-[#ff5500] underline">
                  Privacy Policy
                </button>
                .
              </span>
            </label>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-3 text-xs text-emerald-200">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-4 py-3 text-sm font-black text-white hover:bg-[#ff6611] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'signin' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {mode === 'signin' ? 'Sign in' : 'Create beta account'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
              setMessage('');
            }}
            className="font-bold text-neutral-300 hover:text-white"
          >
            {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}
          </button>
          {mode === 'signin' && (
            <button type="button" onClick={handleReset} className="flex items-center gap-1 text-neutral-500 hover:text-[#ff5500]">
              <KeyRound className="h-3.5 w-3.5" />
              Reset password
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
