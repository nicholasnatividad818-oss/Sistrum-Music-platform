import { useState } from 'react';
import { signIn, signUp } from '../services/auth';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'sign-up') {
        const result = await signUp(email.trim(), password, displayName.trim() || email.split('@')[0]);
        if (!result.session) {
          setNotice('Check your email to confirm the account, then sign in.');
        } else {
          onClose();
        }
      } else {
        await signIn(email.trim(), password);
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(
        /failed to fetch|network|load failed/i.test(message)
          ? 'Could not reach Supabase. Check the project URL, then try again.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-400 mb-4">
          An account stores your uploads and turns on Sistrum Pro.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === 'sign-up' && (
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Artist name"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#ff5500]"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#ff5500]"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#ff5500]"
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          {notice && <p className="text-xs text-emerald-300">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] disabled:opacity-50 text-white text-sm font-bold"
          >
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 text-xs text-neutral-400 hover:text-white"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
