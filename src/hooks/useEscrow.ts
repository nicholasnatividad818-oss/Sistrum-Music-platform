import { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { CURRENT_USER } from '../data/mockData';
import {
  ARBITER_ADDRESS,
  blockHashFrom,
  contractForDeal,
  FACTORY_ADDRESS,
  gasCost,
  hexHash,
  METHOD_GAS,
  PROTOCOL_FEE_BPS,
  roundEth,
  toWei,
  TREASURY_ADDRESS,
  txHashFrom,
  walletFor,
} from '../services/escrowChain';
import {
  canAct,
  computeSplits,
  nextDealNo,
  SEED_BLOCK_HASH,
  SEED_BLOCK_NUMBER,
  SEED_BLOCKS,
  SEED_DEALS,
  SEED_TXS,
  SEED_WALLET,
  USER_ADDRESS,
  type ChainBlock,
  type ChainLog,
  type ChainTx,
  type CreateDealInput,
  type DealAction,
  type EscrowDeal,
  type EscrowStatus,
  type VaultWallet,
} from '../services/escrow';

const STORAGE_KEY = 'sistrum_escrow_v1';

function logsFor(action: DealAction, deal: EscrowDeal, extra?: { reason?: string; uri?: string }): ChainLog[] {
  switch (action) {
    case 'fund':
      return [{ event: 'Funded', data: `value=${toWei(deal.amountEth)} wei` }];
    case 'deliver':
      return [{ event: 'Delivered', data: `uri=${extra?.uri ?? 'ipfs://delivery'}` }];
    case 'release':
      return [
        { event: 'Released', data: `gross=${deal.amountEth}` },
        { event: 'FeePaid', data: `to=${TREASURY_ADDRESS}` },
        ...deal.splits.map((s) => ({ event: 'SplitPaid', data: `${s.label} ${s.bps}bps` })),
      ];
    case 'dispute':
      return [{ event: 'Disputed', data: extra?.reason ?? 'dispute' }];
    case 'refund':
    case 'resolve-refund':
      return [{ event: 'Refunded', data: `to=${deal.buyerAddress}` }];
    case 'resolve-release':
      return [
        { event: 'Resolved', data: 'for seller' },
        { event: 'Released', data: `gross=${deal.amountEth}` },
      ];
    default:
      return [];
  }
}

function methodFor(action: DealAction): string {
  if (action === 'resolve-release' || action === 'resolve-refund') return 'resolve';
  return action;
}

function nextStatus(action: DealAction): EscrowStatus {
  switch (action) {
    case 'fund':
      return 'funded';
    case 'deliver':
      return 'delivered';
    case 'release':
    case 'resolve-release':
      return 'released';
    case 'dispute':
      return 'disputed';
    case 'refund':
    case 'resolve-refund':
      return 'refunded';
  }
}

function signerFor(action: DealAction, deal: EscrowDeal, user: string): string {
  if (action === 'fund' || action === 'release' || action === 'refund') return user;
  if (action === 'deliver') return deal.sellerAddress;
  if (action === 'dispute') return user;
  return ARBITER_ADDRESS;
}

function loadSeed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        deals: parsed.deals ?? SEED_DEALS,
        txs: parsed.txs ?? SEED_TXS,
        blocks: parsed.blocks ?? SEED_BLOCKS,
        wallet: parsed.wallet ?? SEED_WALLET,
        blockNumber: parsed.blockNumber ?? SEED_BLOCK_NUMBER,
        blockHash: parsed.blockHash ?? SEED_BLOCK_HASH,
      };
    }
  } catch {
    /* keep seeds */
  }
  return {
    deals: SEED_DEALS,
    txs: SEED_TXS,
    blocks: SEED_BLOCKS,
    wallet: SEED_WALLET,
    blockNumber: SEED_BLOCK_NUMBER,
    blockHash: SEED_BLOCK_HASH,
  };
}

export function useEscrow(tracks: Track[]) {
  const boot = useRef(loadSeed());
  const [deals, setDeals] = useState<EscrowDeal[]>(boot.current.deals);
  const [txs, setTxs] = useState<ChainTx[]>(boot.current.txs);
  const [blocks, setBlocks] = useState<ChainBlock[]>(boot.current.blocks);
  const [wallet, setWallet] = useState<VaultWallet>(boot.current.wallet);
  const [blockNumber, setBlockNumber] = useState(boot.current.blockNumber);
  const [blockHash, setBlockHash] = useState(boot.current.blockHash);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [licenseOpen, setLicenseOpenState] = useState(false);
  const [licenseTrackId, setLicenseTrackId] = useState<string | null>(null);

  const persistRef = useRef({ deals, txs, blocks, wallet, blockNumber, blockHash });
  persistRef.current = { deals, txs, blocks, wallet, blockNumber, blockHash };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistRef.current));
    } catch {
      /* ignore */
    }
  }, [deals, txs, blocks, wallet, blockNumber, blockHash]);

  const confirmTx = useCallback((hash: string) => {
    setTxs((prev) => {
      const tx = prev.find((t) => t.hash === hash);
      if (!tx || tx.status !== 'pending') return prev;
      setBlockNumber((n) => {
        const number = n + 1;
        setBlockHash((parent) => {
          const hashBlock = blockHashFrom(`${number}:${parent}:${hash}`);
          setBlocks((b) => [
            ...b.slice(-18),
            {
              number,
              hash: hashBlock,
              parentHash: parent,
              timestamp: Date.now(),
              txHashes: [hash],
              gasUsed: tx.gasUsed,
            },
          ]);
          return hashBlock;
        });
        setNotice(`${tx.method} confirmed in block ${number.toLocaleString()}`);
        return number;
      });
      return prev.map((t) => (t.hash === hash ? { ...t, status: 'success' as const, blockNumber: t.blockNumber } : t));
    });
    setTxs((prev) =>
      prev.map((t) =>
        t.hash === hash && t.status === 'pending'
          ? { ...t, status: 'success', blockNumber: persistRef.current.blockNumber + 1 }
          : t,
      ),
    );
  }, []);

  const mineLater = useCallback(
    (hash: string) => {
      window.setTimeout(() => confirmTx(hash), 720 + Math.floor(Math.random() * 880));
    },
    [confirmTx],
  );

  useEffect(() => {
    for (const tx of boot.current.txs) {
      if (tx.status === 'pending') mineLater(tx.hash);
    }
  }, [mineLater]);

  const setLicenseOpen = (open: boolean, trackId?: string | null) => {
    setLicenseOpenState(open);
    setLicenseTrackId(open ? (trackId ?? licenseTrackId) : null);
  };

  const createDeal = (input: CreateDealInput): EscrowDeal | { error: string } => {
    if (!wallet.connected) return { error: 'Connect a wallet first.' };
    const track = tracks.find((t) => t.id === input.trackId);
    if (!track) return { error: 'Track not found.' };
    if (track.artistId === CURRENT_USER.id) return { error: 'You already hold this master.' };
    if (!(input.amountEth > 0)) return { error: 'Amount must be greater than zero.' };
    const gas = gasCost(METHOD_GAS.createDeal);
    if (wallet.balanceEth < gas) return { error: 'Insufficient ETH for gas.' };

    const id = `deal-${Date.now()}`;
    const now = Date.now();
    const contract = contractForDeal(id);
    const hash = txHashFrom(`${id}:create:${now}`);
    const deal: EscrowDeal = {
      id,
      dealNo: nextDealNo(deals),
      trackId: track.id,
      kind: input.kind,
      status: 'proposed',
      buyerId: CURRENT_USER.id,
      sellerId: track.artistId,
      buyerAddress: wallet.address,
      sellerAddress: walletFor(track.artistId),
      contractAddress: contract,
      amountEth: roundEth(input.amountEth),
      protocolFeeBps: PROTOCOL_FEE_BPS,
      splits: computeSplits(track),
      territory: input.territory,
      term: input.term,
      deadlineAt: now + input.windowDays * 86400000,
      notes: input.notes.trim(),
      createdAt: now,
      txHashes: [hash],
    };
    const tx: ChainTx = {
      hash,
      from: wallet.address,
      to: FACTORY_ADDRESS,
      method: 'createDeal',
      valueEth: 0,
      valueWei: '0',
      gasUsed: METHOD_GAS.createDeal,
      blockNumber: null,
      status: 'pending',
      timestamp: now,
      logs: [
        { event: 'DealCreated', data: `dealId=${deal.dealNo} clone=${contract}` },
        { event: 'TermsSet', data: `${deal.kind} ${deal.amountEth}ETH ${deal.territory}` },
      ],
      dealId: id,
    };
    setDeals((d) => [deal, ...d]);
    setTxs((t) => [tx, ...t]);
    setWallet((w) => ({ ...w, balanceEth: roundEth(w.balanceEth - gas) }));
    setLicenseOpenState(false);
    setLicenseTrackId(null);
    setSelectedDealId(id);
    setNotice('Deploying SistrumEscrow clone…');
    mineLater(hash);
    return deal;
  };

  const actOnDeal = (dealId: string, action: DealAction, extra?: { reason?: string; uri?: string }): { error?: string } => {
    if (!wallet.connected) return { error: 'Connect a wallet first.' };
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return { error: 'Deal not found.' };
    if (txs.some((t) => t.dealId === dealId && t.status === 'pending')) {
      return { error: 'A transaction is still in the mempool.' };
    }
    if (!canAct(deal.status, action)) return { error: 'That action is not valid in this state.' };

    const method = methodFor(action);
    const gas = gasCost(METHOD_GAS[method] ?? 65000);
    const value = action === 'fund' ? deal.amountEth : 0;
    const from = signerFor(action, deal, wallet.address);
    const debit = roundEth(value + (from === wallet.address ? gas : 0));
    if (from === wallet.address && wallet.balanceEth < debit) {
      return { error: `Need ${debit.toFixed(4)} ETH including gas.` };
    }

    const now = Date.now();
    const hash = txHashFrom(`${dealId}:${action}:${now}`);
    const tx: ChainTx = {
      hash,
      from,
      to: deal.contractAddress,
      method,
      valueEth: value,
      valueWei: toWei(value),
      gasUsed: METHOD_GAS[method] ?? 65000,
      blockNumber: null,
      status: 'pending',
      timestamp: now,
      logs: logsFor(action, deal, extra),
      dealId,
    };
    const status = nextStatus(action);
    const patched: EscrowDeal = {
      ...deal,
      status,
      txHashes: [...deal.txHashes, hash],
      fundedAt: action === 'fund' ? now : deal.fundedAt,
      deliveredAt: action === 'deliver' ? now : deal.deliveredAt,
      settledAt: status === 'released' || status === 'refunded' ? now : deal.settledAt,
      deliveryUri: action === 'deliver' ? extra?.uri ?? `ipfs://bafy${deal.id.slice(-8)}` : deal.deliveryUri,
      deliveryHash: action === 'deliver' ? '0x' + hexHash(`${dealId}:stems:${now}`, 32) : deal.deliveryHash,
      disputeReason: action === 'dispute' ? extra?.reason ?? deal.disputeReason : deal.disputeReason,
    };

    let balance = wallet.balanceEth;
    if (from === wallet.address) balance = roundEth(balance - debit);
    if (
      (action === 'refund' || action === 'resolve-refund') &&
      deal.buyerAddress === wallet.address &&
      deal.status !== 'proposed'
    ) {
      balance = roundEth(balance + deal.amountEth);
    }

    setDeals((d) => d.map((x) => (x.id === dealId ? patched : x)));
    setTxs((t) => [tx, ...t]);
    setWallet((w) => ({ ...w, balanceEth: balance }));
    setNotice(
      action === 'fund'
        ? 'Locking funds in escrow…'
        : action === 'deliver'
          ? 'Artist submitting delivery hash…'
          : action === 'release'
            ? 'Releasing splits on-chain…'
            : action === 'dispute'
              ? 'Opening a dispute with the arbiter…'
              : 'Writing to SistrumEscrow…',
    );
    mineLater(hash);
    return {};
  };

  return {
    deals,
    txs,
    blocks,
    wallet,
    blockNumber,
    notice,
    selectedDealId,
    licenseOpen,
    licenseTrackId,
    setSelectedDealId,
    setLicenseOpen,
    clearNotice: () => setNotice(null),
    connectWallet: () => {
      setWallet((w) => ({ ...w, connected: true, address: w.address || USER_ADDRESS }));
      setNotice('Wallet connected on Sistrum L2');
    },
    disconnectWallet: () => {
      setWallet((w) => ({ ...w, connected: false }));
      setNotice('Wallet disconnected');
    },
    faucet: () => {
      setWallet((w) => ({ ...w, connected: true, balanceEth: roundEth(w.balanceEth + 1) }));
      setNotice('Faucet sent 1.0000 ETH');
    },
    createDeal,
    actOnDeal,
  };
}
