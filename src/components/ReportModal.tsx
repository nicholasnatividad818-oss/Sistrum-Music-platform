import { FormEvent, useState } from 'react';
import { Flag, Loader2, X } from 'lucide-react';
import type { Track } from '../types';

type Reason = 'copyright' | 'harassment' | 'spam' | 'other';

interface ReportModalProps {
  track: Track | null;
  onClose: () => void;
  onSubmit: (reason: Reason, details: string) => Promise<void>;
}

export function ReportModal({ track, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState<Reason>('copyright');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!track) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(reason, details);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit this report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#ff5500]">
              <Flag className="h-4 w-4" /> Report
            </div>
            <h2 className="text-xl font-black text-white">{track.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white" aria-label="Close report">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-neutral-300">Reason</span>
          <select value={reason} onChange={(event) => setReason(event.target.value as Reason)} className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white">
            <option value="copyright">Copyright</option>
            <option value="harassment">Harassment or safety</option>
            <option value="spam">Spam or deceptive activity</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-bold text-neutral-300">Details</span>
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={5} maxLength={2000} required placeholder="Describe the issue clearly…" className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-[#ff5500]" />
        </label>
        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200">{error}</div>}
        <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit report
        </button>
      </form>
    </div>
  );
}
