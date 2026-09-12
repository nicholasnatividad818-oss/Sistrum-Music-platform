import { MOCK_TRACKS, CURRENT_USER } from "../data/mockData";
import type { Track } from "../types";
import {
  ARBITER_ADDRESS,
  CHAIN_ID,
  FACTORY_ADDRESS,
  METHOD_GAS,
  PROTOCOL_FEE_BPS,
  TREASURY_ADDRESS,
  blockHashFrom,
  contractForDeal,
  gasCost,
  hexHash,
  roundEth,
  toWei,
  txHashFrom,
  walletFor,
} from "./escrowChain";

export type EscrowStatus = "proposed" | "funded" | "delivered" | "released" | "disputed" | "refunded";
export type LicenseKind = "sync" | "exclusive" | "nonexclusive" | "stems" | "commission" | "sample";
export type Territory = "worldwide" | "us" | "eu" | "digital";
export type DealAction = "fund" | "deliver" | "release" | "dispute" | "refund" | "resolve-release" | "resolve-refund";

export interface SplitShare {
  artistId: string;
  address: string;
  bps: number;
  label: string;
}

export interface ChainLog {
  event: string;
  data: string;
}

export interface ChainTx {
  hash: string;
  from: string;
  to: string;
  method: string;
  valueEth: number;
  valueWei: string;
  gasUsed: number;
  blockNumber: number | null;
  status: "pending" | "success" | "reverted";
  timestamp: number;
  logs: ChainLog[];
  dealId: string;
}

export interface ChainBlock {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  txHashes: string[];
  gasUsed: number;
}

export interface EscrowDeal {
  id: string;
  dealNo: number;
  trackId: string;
  kind: LicenseKind;
  status: EscrowStatus;
  buyerId: string;
  sellerId: string;
  buyerAddress: string;
  sellerAddress: string;
  contractAddress: string;
  amountEth: number;
  protocolFeeBps: number;
  splits: SplitShare[];
  territory: Territory;
  term: string;
  deadlineAt: number;
  notes: string;
  deliveryUri?: string;
  deliveryHash?: string;
  disputeReason?: string;
  createdAt: number;
  fundedAt?: number;
  deliveredAt?: number;
  settledAt?: number;
  txHashes: string[];
}

export interface VaultWallet {
  connected: boolean;
  address: string;
  balanceEth: number;
  label: string;
}

export const LICENSE_KINDS: {
  id: LicenseKind;
  label: string;
  blurb: string;
  suggest: number;
}[] = [
  { id: "sync", label: "Sync license", blurb: "Film, ad, game. Timed cue.", suggest: 0.42 },
  { id: "exclusive", label: "Exclusive master", blurb: "One buyer. Full master.", suggest: 1.2 },
  { id: "nonexclusive", label: "Non-exclusive", blurb: "Stream and catalog use.", suggest: 0.08 },
  { id: "stems", label: "Stem pack", blurb: "Multitracks for remix / score.", suggest: 0.25 },
  { id: "commission", label: "Commission", blurb: "Custom track to brief.", suggest: 0.55 },
  { id: "sample", label: "Sample clearance", blurb: "Replay or interpolation.", suggest: 0.12 },
];

export const TERRITORIES: { id: Territory; label: string }[] = [
  { id: "worldwide", label: "Worldwide" },
  { id: "us", label: "United States" },
  { id: "eu", label: "European Union" },
  { id: "digital", label: "Digital only" },
];

export const TERMS = ["90 days", "1 year", "5 years", "perpetual"] as const;
export const WINDOWS = [3, 7, 14] as const;

export const USER_ADDRESS = walletFor(CURRENT_USER.id);

export const STATUS_META: Record<
  EscrowStatus,
  { label: string; tone: "muted" | "warn" | "primary" | "success" | "danger" }
> = {
  proposed: { label: "Proposed", tone: "muted" },
  funded: { label: "Funded", tone: "warn" },
  delivered: { label: "Delivered", tone: "primary" },
  released: { label: "Released", tone: "success" },
  disputed: { label: "Disputed", tone: "danger" },
  refunded: { label: "Refunded", tone: "muted" },
};

export function kindLabel(kind: LicenseKind): string {
  return LICENSE_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

export function computeSplits(track: Track): SplitShare[] {
  return [
    {
      artistId: track.artistId,
      address: walletFor(track.artistId),
      bps: 10000,
      label: track.artist,
    },
  ];
}

export function payouts(deal: EscrowDeal): { label: string; address: string; eth: number }[] {
  const fee = roundEth((deal.amountEth * deal.protocolFeeBps) / 10000);
  const rest = roundEth(deal.amountEth - fee);
  return [
    { label: "Protocol", address: TREASURY_ADDRESS, eth: fee },
    ...deal.splits.map((s) => ({
      label: s.label,
      address: s.address,
      eth: roundEth((rest * s.bps) / 10000),
    })),
  ];
}

export function netToSeller(deal: EscrowDeal): number {
  const fee = (deal.amountEth * deal.protocolFeeBps) / 10000;
  return roundEth(deal.amountEth - fee);
}

const ALLOWED: Record<EscrowStatus, DealAction[]> = {
  proposed: ["fund", "refund"],
  funded: ["deliver", "dispute", "refund"],
  delivered: ["release", "dispute"],
  disputed: ["resolve-release", "resolve-refund"],
  released: [],
  refunded: [],
};

export function canAct(status: EscrowStatus, action: DealAction): boolean {
  return ALLOWED[status].includes(action);
}

export interface CreateDealInput {
  trackId: string;
  kind: LicenseKind;
  amountEth: number;
  territory: Territory;
  term: string;
  windowDays: number;
  notes: string;
}

function mintTx(opts: {
  seed: string;
  from: string;
  to: string;
  method: string;
  valueEth: number;
  dealId: string;
  logs: ChainLog[];
  timestamp: number;
  mined: boolean;
  blockNumber?: number;
}): ChainTx {
  const gasUsed = METHOD_GAS[opts.method] ?? 65000;
  return {
    hash: txHashFrom(opts.seed),
    from: opts.from,
    to: opts.to,
    method: opts.method,
    valueEth: opts.valueEth,
    valueWei: toWei(opts.valueEth),
    gasUsed,
    blockNumber: opts.mined ? (opts.blockNumber ?? 0) : null,
    status: opts.mined ? "success" : "pending",
    timestamp: opts.timestamp,
    logs: opts.logs,
    dealId: opts.dealId,
  };
}

function seedDeal(opts: {
  id: string;
  dealNo: number;
  trackId: string;
  kind: LicenseKind;
  status: EscrowStatus;
  amountEth: number;
  territory: Territory;
  term: string;
  notes: string;
  createdAgoMs: number;
  windowDays: number;
  deliveryUri?: string;
  disputeReason?: string;
}): { deal: EscrowDeal; txs: ChainTx[] } {
  const track = MOCK_TRACKS.find((t) => t.id === opts.trackId)!;
  const now = Date.now();
  const createdAt = now - opts.createdAgoMs;
  const contract = contractForDeal(opts.id);
  const buyerAddress = USER_ADDRESS;
  const sellerAddress = walletFor(track.artistId);
  const splits = computeSplits(track);
  const txs: ChainTx[] = [];
  const txHashes: string[] = [];

  const create = mintTx({
    seed: `${opts.id}:create`,
    from: buyerAddress,
    to: FACTORY_ADDRESS,
    method: "createDeal",
    valueEth: 0,
    dealId: opts.id,
    logs: [
      { event: "DealCreated", data: `dealId=${opts.dealNo} clone=${contract}` },
      { event: "TermsSet", data: `${opts.kind} ${opts.amountEth}ETH ${opts.territory}` },
    ],
    timestamp: createdAt,
    mined: true,
    blockNumber: 1_842_110 + opts.dealNo * 17,
  });
  txs.push(create);
  txHashes.push(create.hash);

  let fundedAt: number | undefined;
  let deliveredAt: number | undefined;
  let settledAt: number | undefined;
  let deliveryHash: string | undefined;

  if (opts.status !== "proposed") {
    fundedAt = createdAt + 1000 * 60 * 18;
    const fund = mintTx({
      seed: `${opts.id}:fund`,
      from: buyerAddress,
      to: contract,
      method: "fund",
      valueEth: opts.amountEth,
      dealId: opts.id,
      logs: [{ event: "Funded", data: `value=${toWei(opts.amountEth)} wei` }],
      timestamp: fundedAt,
      mined: true,
      blockNumber: create.blockNumber! + 4,
    });
    txs.push(fund);
    txHashes.push(fund.hash);
  }

  if (opts.status === "delivered" || opts.status === "released" || opts.status === "disputed") {
    deliveredAt = (fundedAt ?? createdAt) + 1000 * 60 * 60 * 26;
    deliveryHash = "0x" + hexHash(`${opts.id}:stems`, 32);
    const deliver = mintTx({
      seed: `${opts.id}:deliver`,
      from: sellerAddress,
      to: contract,
      method: "deliver",
      valueEth: 0,
      dealId: opts.id,
      logs: [{ event: "Delivered", data: `uri=${opts.deliveryUri ?? "ipfs://stems"} hash=${deliveryHash.slice(0, 18)}` }],
      timestamp: deliveredAt,
      mined: true,
      blockNumber: (txs.at(-1)?.blockNumber ?? 0) + 9,
    });
    txs.push(deliver);
    txHashes.push(deliver.hash);
  }

  if (opts.status === "released") {
    settledAt = (deliveredAt ?? createdAt) + 1000 * 60 * 40;
    const release = mintTx({
      seed: `${opts.id}:release`,
      from: buyerAddress,
      to: contract,
      method: "release",
      valueEth: 0,
      dealId: opts.id,
      logs: [
        { event: "Released", data: `gross=${opts.amountEth}` },
        { event: "FeePaid", data: `to=${TREASURY_ADDRESS}` },
        ...splits.map((s) => ({ event: "SplitPaid", data: `${s.label} ${s.bps}bps` })),
      ],
      timestamp: settledAt,
      mined: true,
      blockNumber: (txs.at(-1)?.blockNumber ?? 0) + 2,
    });
    txs.push(release);
    txHashes.push(release.hash);
  }

  if (opts.status === "disputed") {
    const disputedAt = (deliveredAt ?? createdAt) + 1000 * 60 * 90;
    const dispute = mintTx({
      seed: `${opts.id}:dispute`,
      from: buyerAddress,
      to: contract,
      method: "dispute",
      valueEth: 0,
      dealId: opts.id,
      logs: [{ event: "Disputed", data: opts.disputeReason ?? "quality" }],
      timestamp: disputedAt,
      mined: true,
      blockNumber: (txs.at(-1)?.blockNumber ?? 0) + 3,
    });
    txs.push(dispute);
    txHashes.push(dispute.hash);
  }

  if (opts.status === "refunded") {
    settledAt = (fundedAt ?? createdAt) + 1000 * 60 * 200;
    const refund = mintTx({
      seed: `${opts.id}:refund`,
      from: buyerAddress,
      to: contract,
      method: "refund",
      valueEth: 0,
      dealId: opts.id,
      logs: [{ event: "Refunded", data: `to=${buyerAddress}` }],
      timestamp: settledAt,
      mined: true,
      blockNumber: (txs.at(-1)?.blockNumber ?? 0) + 6,
    });
    txs.push(refund);
    txHashes.push(refund.hash);
  }

  const deal: EscrowDeal = {
    id: opts.id,
    dealNo: opts.dealNo,
    trackId: opts.trackId,
    kind: opts.kind,
    status: opts.status,
    buyerId: CURRENT_USER.id,
    sellerId: track.artistId,
    buyerAddress,
    sellerAddress,
    contractAddress: contract,
    amountEth: opts.amountEth,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    splits,
    territory: opts.territory,
    term: opts.term,
    deadlineAt: createdAt + opts.windowDays * 86400000,
    notes: opts.notes,
    deliveryUri: opts.deliveryUri,
    deliveryHash,
    disputeReason: opts.disputeReason,
    createdAt,
    fundedAt,
    deliveredAt,
    settledAt,
    txHashes,
  };

  return { deal, txs };
}

function buildSeed() {
  const parts = [
    seedDeal({
      id: "deal-1",
      dealNo: 1042,
      trackId: "track-1",
      kind: "sync",
      status: "funded",
      amountEth: 0.42,
      territory: "worldwide",
      term: "1 year",
      notes: "Trailer cue for a night-drive short. Ninety seconds, picture lock next week.",
      createdAgoMs: 1000 * 60 * 60 * 36,
      windowDays: 7,
    }),
    seedDeal({
      id: "deal-2",
      dealNo: 1048,
      trackId: "track-5",
      kind: "stems",
      status: "delivered",
      amountEth: 1.05,
      territory: "worldwide",
      term: "perpetual",
      notes: "VIP dub stems for a game score. 48k/24, dry + printed.",
      createdAgoMs: 1000 * 60 * 60 * 80,
      windowDays: 14,
      deliveryUri: "ipfs://bafybeigdyrstems/katana-vip",
    }),
    seedDeal({
      id: "deal-3",
      dealNo: 1011,
      trackId: "track-2",
      kind: "nonexclusive",
      status: "released",
      amountEth: 0.08,
      territory: "digital",
      term: "5 years",
      notes: "Background bed for a study-app session playlist.",
      createdAgoMs: 1000 * 60 * 60 * 24 * 12,
      windowDays: 7,
      deliveryUri: "ipfs://bafybeigdyrstems/cranes-master",
    }),
    seedDeal({
      id: "deal-4",
      dealNo: 1033,
      trackId: "track-3",
      kind: "sync",
      status: "disputed",
      amountEth: 0.65,
      territory: "eu",
      term: "1 year",
      notes: "Sunset terrace montage. Picture-locked 2:14.",
      createdAgoMs: 1000 * 60 * 60 * 24 * 6,
      windowDays: 7,
      deliveryUri: "ipfs://bafybeigdyrstems/solar-flare",
      disputeReason: "Delivered WAV is 44.1/16. Contract specified 48k/24 stems.",
    }),
    seedDeal({
      id: "deal-5",
      dealNo: 1055,
      trackId: "track-4",
      kind: "commission",
      status: "proposed",
      amountEth: 0.28,
      territory: "worldwide",
      term: "perpetual",
      notes: "Eight-minute zero-gravity bed, no percussion, northern-lights drone.",
      createdAgoMs: 1000 * 60 * 50,
      windowDays: 14,
    }),
  ];

  const deals = parts.map((p) => p.deal);
  const txs = parts.flatMap((p) => p.txs).sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0));
  const latest = Math.max(...txs.map((t) => t.blockNumber ?? 0), 1_842_200);
  const blocks: ChainBlock[] = [];
  let parent = blockHashFrom("genesis");
  for (let n = latest - 5; n <= latest; n++) {
    const inBlock = txs.filter((t) => t.blockNumber === n);
    const hash = blockHashFrom(`${n}:${parent}`);
    blocks.push({
      number: n,
      hash,
      parentHash: parent,
      timestamp: Date.now() - (latest - n) * 12000,
      txHashes: inBlock.map((t) => t.hash),
      gasUsed: inBlock.reduce((s, t) => s + t.gasUsed, 0) || 21_000,
    });
    parent = hash;
  }

  const locked = deals
    .filter((d) => d.status === "funded" || d.status === "delivered" || d.status === "disputed")
    .reduce((s, d) => s + d.amountEth, 0);

  const wallet: VaultWallet = {
    connected: true,
    address: USER_ADDRESS,
    balanceEth: roundEth(3.184 - locked - 0.08),
    label: "Alex Rivera",
  };

  return { deals, txs, blocks, wallet, blockNumber: latest, blockHash: blocks.at(-1)?.hash ?? parent };
}

const SEED = buildSeed();
export const SEED_DEALS = SEED.deals;
export const SEED_TXS = SEED.txs;
export const SEED_BLOCKS = SEED.blocks;
export const SEED_WALLET = SEED.wallet;
export const SEED_BLOCK_NUMBER = SEED.blockNumber;
export const SEED_BLOCK_HASH = SEED.blockHash;

export function nextDealNo(deals: EscrowDeal[]): number {
  return deals.reduce((m, d) => Math.max(m, d.dealNo), 1000) + 1;
}

export function bytecodeHash(deal: EscrowDeal): string {
  return "0x" + hexHash(`runtime:${deal.contractAddress}:${deal.kind}`, 32);
}

export function explorerUrl(hash: string): string {
  return `sistrum://l2/${CHAIN_ID}/tx/${hash}`;
}

export { FACTORY_ADDRESS, TREASURY_ADDRESS, ARBITER_ADDRESS, gasCost };
