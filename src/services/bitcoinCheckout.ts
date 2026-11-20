export interface BitcoinCheckout { url: string; price: string; supportEmail: string }
export function getBitcoinCheckout(trackId: string, env: Record<string, unknown> = import.meta.env): BitcoinCheckout | null {
  const value = (name: string) => typeof env[name] === 'string' ? (env[name] as string).trim() : '';
  const releaseId = value('VITE_BTCPAY_RELEASE_ID');
  const price = value('VITE_BTCPAY_PRICE_LABEL');
  const supportEmail = value('VITE_BTCPAY_SUPPORT_EMAIL');
  if (!releaseId || releaseId !== trackId || !price || !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(supportEmail)) return null;
  try {
    const url = new URL(value('VITE_BTCPAY_CHECKOUT_URL'));
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.endsWith('.local') || url.hostname.endsWith('.localhost')) return null;
    return { url: url.href, price, supportEmail };
  } catch { return null; }
}
