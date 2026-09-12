import { useState } from 'react';
import { ArrowLeft, Check, Copy, Scale, Shield } from 'lucide-react';
import { Artist, Track } from '../types';
import {
  ARBITER_ADDRESS,
  CHAIN_ID,
  CHAIN_NAME,
  formatEth,
  shortAddr,
  timeAgo,
  timeUntil,
  toWei,
} from '../services/escrowChain';
import { bytecodeHash, kindLabel, payouts, type ChainTx, type DealAction, type EscrowDeal } from '../services/escrow';
import { CURRENT_USER } from '../data/mockData';

const STEPS = [
  { id: 'proposed', label: 'Proposed' },
  { id: 'funded', label: 'Funded' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'released', label: 'Released' },
];

function stepIndex(status: string) {
  if (status === 'refunded') return -1;
  if (status === 'disputed') return 2;
  return Math.max(0, STEPS.findIndex((s) => s.id === status));
}

function Copyable({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 hover:text-white"
      title={value}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {label ?? shortAddr(value)}
    </button>
  );
}

interface Props {
  deal: EscrowDeal;
  track?: Track;
  seller?: Artist;
  txs: ChainTx[];
  walletConnected: boolean;
  onBack: () => void;
  onOpenTrack: (track: Track) => void;
  onAct: (action: DealAction, extra?: { reason?: string; uri?: string }) => { error?: string };
}

export function DealView({ deal, track, seller, txs, walletConnected, onBack, onOpenTrack, onAct }: Props) {
  const [reason, setReason] = useState('Deliverable does not match the brief.');
  const [error, setError] = useState<string | null>(null);
  const pending = txs.some((t) => t.dealId === deal.id && t.status === 'pending');
  const dealTxs = txs.filter((t) => t.dealId === deal.id);
  const idx = stepIndex(deal.status);
  const pay = payouts(deal);

  function run(action: DealAction, extra?: { reason?: string; uri?: string }) {
    setError(onAct(action, extra).error ?? null);
  }

  return (
    <div className="space-y-6 pb-24">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" />
        Vault
      </button>

      <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-5 md:p-7">
        <div className="flex flex-col md:flex-row gap-5">
          {track && (
            <button type="button" onClick={() => onOpenTrack(track)} className="shrink-0">
              <img src={track.coverArt} alt="" className="w-full md:w-40 aspect-square rounded-2xl object-cover" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 items-center px-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#ff5500]/30 text-[#ff5500] bg-[#ff5500]/15">
                {deal.status}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-neutral-500">{kindLabel(deal.kind)}</span>
              <span className="text-[11px] font-mono text-neutral-500">#{deal.dealNo}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight">{track?.title ?? 'License'}</h1>
            {seller && <p className="mt-2 text-sm text-neutral-400">{seller.name}</p>}
            <p className="mt-3 text-sm text-neutral-400">{deal.notes || 'No brief attached.'}</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Locked</div>
                <div className="mt-0.5 font-mono">{formatEth(deal.amountEth)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Territory</div>
                <div className="mt-0.5 capitalize">{deal.territory}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Term</div>
                <div className="mt-0.5">{deal.term}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Window</div>
                <div className="mt-0.5">{timeUntil(deal.deadlineAt)}</div>
              </div>
            </div>
          </div>
        </div>
        <ol className="mt-6 grid grid-cols-4 gap-2">
          {STEPS.map((step, i) => {
            const on = deal.status === 'refunded' ? false : i <= idx;
            return (
              <li key={step.id}>
                <div className={`h-1 rounded-full ${on ? 'bg-[#ff5500]' : 'bg-neutral-800'}`} />
                <div className="mt-2 text-[10px] uppercase tracking-wider text-neutral-500">{step.label}</div>
              </li>
            );
          })}
        </ol>
        {deal.status === 'disputed' && (
          <p className="mt-3 text-xs text-red-400 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5" />
            Frozen with the arbiter. {deal.disputeReason}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-bold mb-3">Actions</h2>
        {pending && <p className="mb-3 text-xs text-amber-400">Transaction in mempool — waiting on the next block.</p>}
        <div className="flex flex-wrap gap-2">
          {deal.status === 'proposed' && (
            <>
              <button disabled={pending || !walletConnected} onClick={() => run('fund')} className="px-4 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold disabled:opacity-40">
                Fund {formatEth(deal.amountEth)}
              </button>
              <button disabled={pending} onClick={() => run('refund')} className="px-4 py-2 rounded-xl text-neutral-400 text-xs font-bold">
                Cancel proposal
              </button>
            </>
          )}
          {deal.status === 'funded' && (
            <>
              <button disabled={pending} onClick={() => run('deliver', { uri: `ipfs://bafy${deal.id.slice(-6)}` })} className="px-4 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold disabled:opacity-40">
                Simulate artist delivery
              </button>
              <button disabled={pending} onClick={() => run('refund')} className="px-4 py-2 rounded-xl bg-neutral-800 text-xs font-bold disabled:opacity-40">
                Refund buyer
              </button>
              <button disabled={pending} onClick={() => run('dispute', { reason })} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40">
                Dispute
              </button>
            </>
          )}
          {deal.status === 'delivered' && (
            <>
              <button disabled={pending || !walletConnected} onClick={() => run('release')} className="px-4 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold disabled:opacity-40">
                Release funds
              </button>
              <button disabled={pending} onClick={() => run('dispute', { reason })} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40">
                Dispute delivery
              </button>
            </>
          )}
          {deal.status === 'disputed' && (
            <>
              <button disabled={pending} onClick={() => run('resolve-release')} className="px-4 py-2 rounded-xl bg-[#ff5500] text-white text-xs font-bold disabled:opacity-40">
                Arbiter: pay artist
              </button>
              <button disabled={pending} onClick={() => run('resolve-refund')} className="px-4 py-2 rounded-xl bg-neutral-800 text-xs font-bold disabled:opacity-40">
                Arbiter: refund buyer
              </button>
            </>
          )}
        </div>
        {(deal.status === 'funded' || deal.status === 'delivered') && (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-4 w-full h-11 rounded-xl bg-neutral-950 border border-neutral-800 px-3 text-sm outline-none focus:border-[#ff5500]"
          />
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-bold mb-3">Payout on release</h2>
        <div className="space-y-2">
          {pay.map((p) => (
            <div key={p.address + p.label} className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="truncate">{p.label}</div>
                <Copyable value={p.address} />
              </div>
              <div className="font-mono tabular-nums shrink-0">{formatEth(p.eth)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-bold mb-3">Contract</h2>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-neutral-800">
            <span className="text-neutral-500">Clone</span>
            <Copyable value={deal.contractAddress} />
          </div>
          <div className="flex justify-between py-1.5 border-b border-neutral-800">
            <span className="text-neutral-500">Chain</span>
            <span className="font-mono">{CHAIN_NAME} · {CHAIN_ID}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-neutral-800">
            <span className="text-neutral-500">Amount</span>
            <span className="font-mono">{toWei(deal.amountEth)} wei</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-neutral-800">
            <span className="text-neutral-500">Bytecode</span>
            <Copyable value={bytecodeHash(deal)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-bold mb-3">Transactions</h2>
        <ul className="space-y-2">
          {dealTxs.map((tx) => (
            <li key={tx.hash} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono">{tx.method}</span>
                    <span className={`text-[10px] uppercase ${tx.status === 'pending' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {tx.status}
                    </span>
                  </div>
                  <Copyable value={tx.hash} />
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {tx.blockNumber ? `block ${tx.blockNumber.toLocaleString()}` : 'mempool'} · gas {tx.gasUsed.toLocaleString()}
                  </div>
                </div>
                <span className="text-[11px] text-neutral-500">{timeAgo(tx.timestamp)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-neutral-500 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5" />
        Sistrum L2 preview network. Buyer {CURRENT_USER.name}.
      </p>
    </div>
  );
}
