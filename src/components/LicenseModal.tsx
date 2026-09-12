import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Track } from '../types';
import { CURRENT_USER } from '../data/mockData';
import { formatEth, PROTOCOL_FEE_BPS } from '../services/escrowChain';
import {
  LICENSE_KINDS,
  TERMS,
  TERRITORIES,
  WINDOWS,
  computeSplits,
  type CreateDealInput,
  type EscrowDeal,
  type LicenseKind,
  type Territory,
} from '../services/escrow';

interface Props {
  isOpen: boolean;
  tracks: Track[];
  preselectedTrackId: string | null;
  balanceEth: number;
  onClose: () => void;
  onCreate: (input: CreateDealInput) => EscrowDeal | { error: string };
}

export function LicenseModal({ isOpen, tracks, preselectedTrackId, balanceEth, onClose, onCreate }: Props) {
  const licensable = tracks.filter((t) => t.artistId !== CURRENT_USER.id);
  const [picked, setPicked] = useState<string | null>(null);
  const [kind, setKind] = useState<LicenseKind>('sync');
  const [amount, setAmount] = useState('0.42');
  const [territory, setTerritory] = useState<Territory>('worldwide');
  const [term, setTerm] = useState('1 year');
  const [windowDays, setWindowDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeId = preselectedTrackId ?? picked ?? licensable[0]?.id ?? null;
  const track = tracks.find((t) => t.id === activeId);
  const splits = useMemo(() => (track ? computeSplits(track) : []), [track]);
  const amountEth = Number(amount) || 0;
  const fee = (amountEth * PROTOCOL_FEE_BPS) / 10000;

  if (!isOpen) return null;

  function applyKind(next: LicenseKind) {
    setKind(next);
    setAmount(String(LICENSE_KINDS.find((k) => k.id === next)?.suggest ?? 0.2));
  }

  function submit() {
    if (!activeId) return;
    const result = onCreate({
      trackId: activeId,
      kind,
      amountEth: Number(amount),
      territory,
      term,
      windowDays,
      notes,
    });
    if ('error' in result) setError(result.error);
    else setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Close" />
      <div className="relative w-full md:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl md:rounded-3xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#ff5500] font-bold">SistrumEscrow</p>
            <h2 className="text-lg font-black">New license deal</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-800" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!preselectedTrackId && (
          <label className="block mb-4">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">Track</span>
            <select
              value={activeId ?? ''}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-3 text-sm outline-none focus:border-[#ff5500]"
            >
              {licensable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} — {t.artist}
                </option>
              ))}
            </select>
          </label>
        )}

        {track && (
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 mb-4">
            <img src={track.coverArt} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div className="min-w-0">
              <div className="font-bold truncate">{track.title}</div>
              <div className="text-xs text-neutral-400">{track.artist}</div>
            </div>
          </div>
        )}

        <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">License type</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {LICENSE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => applyKind(k.id)}
              className={`text-left rounded-xl border p-3 ${
                kind === k.id ? 'border-[#ff5500] bg-[#ff5500]/10' : 'border-neutral-800 bg-neutral-950'
              }`}
            >
              <div className="text-sm font-bold">{k.label}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{k.blurb}</div>
            </button>
          ))}
        </div>

        <label className="block mb-4">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">Amount (ETH)</span>
          <input
            type="number"
            min="0.001"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-3 text-sm font-mono outline-none focus:border-[#ff5500]"
          />
          <span className="mt-1 block text-[11px] text-neutral-500">Wallet {formatEth(balanceEth)}</span>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label>
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">Territory</span>
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value as Territory)}
              className="mt-1 w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-3 text-sm outline-none focus:border-[#ff5500]"
            >
              {TERRITORIES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">Term</span>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-3 text-sm outline-none focus:border-[#ff5500]"
            >
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2 mb-4">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindowDays(d)}
              className={`h-10 flex-1 rounded-xl border text-xs font-bold ${
                windowDays === d ? 'bg-[#ff5500] text-white border-[#ff5500]' : 'border-neutral-800 text-neutral-400'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How the music will be used…"
          className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#ff5500] resize-none mb-4"
        />

        {track && amountEth > 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 mb-4 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">Protocol fee 2.5%</span>
              <span className="font-mono">{formatEth(fee)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-neutral-500">Net to rights holders</span>
              <span className="font-mono">{formatEth(amountEth - fee)}</span>
            </div>
            {splits.map((sp) => (
              <div key={sp.artistId} className="flex justify-between mt-1 text-neutral-500">
                <span>{sp.label}</span>
                <span className="font-mono">{(sp.bps / 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button onClick={submit} disabled={!track} className="w-full h-12 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] text-white text-sm font-bold disabled:opacity-40">
          Deploy escrow
        </button>
      </div>
    </div>
  );
}
