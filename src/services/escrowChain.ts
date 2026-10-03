const FNV = 0x01000193;

export const CHAIN_ID = 1984;
export const CHAIN_NAME = "Sistrum L2";
export const PROTOCOL_FEE_BPS = 250;
export const GAS_PRICE_ETH = 2e-9;

export function hexHash(input: string, byteLen = 32): string {
  const bytes = new Uint8Array(byteLen);
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, FNV) >>> 0;
    h2 = Math.imul(h2 ^ (c + i * 17), 16777619) >>> 0;
    const mix = Math.imul(h1 ^ (h2 >>> 13), 2246822519) >>> 0;
    bytes[i % byteLen] ^= mix & 0xff;
    bytes[(i + 7) % byteLen] ^= (mix >>> 8) & 0xff;
    bytes[(i + 13) % byteLen] ^= (mix >>> 16) & 0xff;
    bytes[(i + 19) % byteLen] ^= (mix >>> 24) & 0xff;
  }
  for (let p = 0; p < 4; p++) {
    for (let i = 0; i < byteLen; i++) {
      h1 = Math.imul(h1 ^ bytes[i] ^ p, FNV) >>> 0;
      bytes[i] = (bytes[i] ^ (h1 >>> ((i % 4) * 8))) & 0xff;
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function toChecksum(addr: string): string {
  const lower = addr.replace(/^0x/i, "").toLowerCase().padStart(40, "0").slice(0, 40);
  const hash = hexHash(lower, 32);
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

export function addressFrom(seed: string): string {
  return toChecksum("0x" + hexHash(`addr:${seed}`, 20));
}

export function txHashFrom(seed: string): string {
  return "0x" + hexHash(`tx:${seed}`, 32);
}

export function blockHashFrom(seed: string): string {
  return "0x" + hexHash(`block:${seed}`, 32);
}

export const FACTORY_ADDRESS = addressFrom("sistrum-escrow-factory-v1");
export const TREASURY_ADDRESS = addressFrom("sistrum-treasury");
export const ARBITER_ADDRESS = addressFrom("sistrum-arbiter");

export function contractForDeal(dealId: string): string {
  return addressFrom(`clone:${FACTORY_ADDRESS}:${dealId}`);
}

export function walletFor(artistId: string): string {
  return addressFrom(`artist:${artistId}`);
}

export function roundEth(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

export function formatEth(n: number, digits = 4): string {
  const v = roundEth(n);
  return `${v.toFixed(digits)} ETH`;
}

export function toWei(eth: number): string {
  const scaled = Math.round(roundEth(eth) * 1e8);
  const negative = scaled < 0;
  const abs = Math.abs(scaled).toString();
  const wei = abs + "0".repeat(10);
  const trimmed = wei.replace(/^0+(?=\d)/, "");
  return negative ? "-" + trimmed : trimmed;
}

export function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function gasCost(gasUsed: number): number {
  return roundEth(gasUsed * GAS_PRICE_ETH);
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 21) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function timeUntil(ts: number): string {
  const s = ts - Date.now();
  if (s <= 0) return "Expired";
  const d = Math.floor(s / 86400000);
  if (d >= 2) return `${d}d left`;
  const h = Math.max(1, Math.floor(s / 3600000));
  if (h >= 24) return `${Math.round(h / 24)}d left`;
  return `${h}h left`;
}

export const METHOD_GAS: Record<string, number> = {
  createDeal: 142000,
  fund: 84000,
  deliver: 62000,
  release: 118000,
  dispute: 48000,
  refund: 71000,
  resolve: 96000,
};
