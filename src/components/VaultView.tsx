import { useMemo, useState } from 'react';
import { Plus, Shield, Wallet } from 'lucide-react';
import { Track } from '../types';
import { CHAIN_NAME, FACTORY_ADDRESS, formatEth, shortAddr, timeAgo } from '../services/escrowChain';
import { kindLabel, type ChainTx, type EscrowDeal, type EscrowStatus, type VaultWallet } from '../services/escrow';

const FILTERS: { id: 'open' | 'locked' | 'settled' | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'locked', label: 'Locked' },
  { id: 'settled', label: 'Settled' },
  { id: 'all', label: 'All' },
];

const TONE: Record<string, string> = {
  proposed: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  funded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  delivered: 'bg-[#ff5500]/15 text-[#ff5500] border-[#ff5500]/30',
  released: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  disputed: 'bg-red-500/15 text-red-400 border-red-500/30',
  refunded: 'bg-neutral-800 text-neutral-400 border-neutral-700',
};

function matches(status: EscrowStatus, filter: (typeof FILTERS)[number]['id']) {
  if (filter === 'all') return true;
  if (filter === 'open') return status === 'proposed' || status === 'delivered' || status === 'disputed';
  if (filter === 'locked') return status === 'funded' || status === 'delivered' || status === 'disputed';
  return status === 'released' || status === 'refunded';
}

interface Props {
  tracks: Track[];
  deals: EscrowDeal[];
  txs: ChainTx[];
  wallet: VaultWallet;
  blockNumber: number;
  onOpenDeal: (id: string) => void;
  onOpenLicense: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onFaucet: () => void;
}

export function VaultView({
  tracks,
  deals,
  txs,
  wallet,
  blockNumber,
  onOpenDeal,
  onOpenLicense,
  onConnect,
  onDisconnect,
  onFaucet,
}: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('open');
  const pending = txs.filter((t) => t.status === 'pending').length;
  const locked = deals
    .filter((d) => d.status === 'funded' || d.status === 'delivered' || d.status === 'disputed')
    .reduce((s, d) => s + d.amountEth, 0);
  const released = deals.filter((d) => d.status === 'released').reduce((s, d) => s + d.amountEth, 0);
  const list = useMemo(() => deals.filter((d) => matches(d.status, filter)), [deals, filter]);

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#ff5500] grid place-items-center shadow-lg shadow-[#ff5500]/30">
                <Shield className="w-5 h-5 text-white" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#ff5500] font-bold">On-chain escrow</p>
                <h1 className="text-2xl font-black tracking-tight">Vault</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-neutral-400 max-w-xl">
              Lock ETH against a license, stem pack, or commission. The artist delivers. You release — or the
              arbiter does. Splits pay out in the same transaction.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onOpenLicense}
                disabled={!wallet.connected}
                className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6611] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New license
              </button>
              {wallet.connected ? (
                <button onClick={onDisconnect} className="px-4 py-2 rounded-xl bg-neutral-800 text-xs font-bold">
                  Disconnect
                </button>
              ) : (
                <button onClick={onConnect} className="px-4 py-2 rounded-xl bg-neutral-800 text-xs font-bold">
                  Connect wallet
                </button>
              )}
              <button onClick={onFaucet} className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-bold">
                Faucet +1 ETH
              </button>
            </div>
          </div>
          <div className="w-full md:w-72 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Wallet className="w-3.5 h-3.5" />
              {wallet.connected ? 'Connected' : 'Disconnected'}
              {pending > 0 && <span className="ml-auto text-amber-400">{pending} pending</span>}
            </div>
            <div className="mt-2 font-mono text-sm truncate">{shortAddr(wallet.address)}</div>
            <div className="mt-3 text-2xl font-black tabular-nums">{formatEth(wallet.balanceEth)}</div>
            <p className="mt-1 text-[11px] text-neutral-500">
              {CHAIN_NAME} · block {blockNumber.toLocaleString()}
            </p>
            <p className="mt-3 text-[11px] font-mono text-neutral-500 truncate">Escrow {shortAddr(FACTORY_ADDRESS)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Locked TVL', value: formatEth(locked) },
          { label: 'Released', value: formatEth(released) },
          {
            label: 'Open deals',
            value: String(deals.filter((d) => !['released', 'refunded'].includes(d.status)).length),
          },
          { label: 'All deals', value: String(deals.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold">{s.label}</div>
            <div className="mt-1 text-lg font-black tabular-nums">{s.value}</div>
          </div>
        ))}
      </section>

      <div className="flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-9 px-3 rounded-full text-xs font-bold shrink-0 border ${
              filter === f.id
                ? 'bg-[#ff5500] text-white border-[#ff5500]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-10 text-center">
          <Shield className="w-6 h-6 text-neutral-500 mx-auto" />
          <p className="mt-3 text-sm text-neutral-400">No deals in this state.</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map((deal) => {
          const track = tracks.find((t) => t.id === deal.trackId);
          const waiting = txs.some((t) => t.dealId === deal.id && t.status === 'pending');
          return (
            <button
              key={deal.id}
              type="button"
              onClick={() => onOpenDeal(deal.id)}
              className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 transition-colors"
            >
              <div className="flex gap-3">
                {track && (
                  <img src={track.coverArt} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-6 items-center px-2 rounded-full text-[10px] font-bold uppercase tracking-wider border ${TONE[deal.status]}`}>
                      {deal.status}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-neutral-500">{kindLabel(deal.kind)}</span>
                    {waiting && <span className="text-[11px] text-amber-400">Mining</span>}
                  </div>
                  <div className="mt-1 font-bold truncate">{track?.title ?? 'Unknown track'}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    {track?.artist ?? 'Artist'} · #{deal.dealNo} · {timeAgo(deal.createdAt)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm tabular-nums">{formatEth(deal.amountEth)}</div>
                  <div className="text-[11px] font-mono text-neutral-500">{shortAddr(deal.contractAddress)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
