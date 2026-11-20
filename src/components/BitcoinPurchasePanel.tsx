import { getBitcoinCheckout } from '../services/bitcoinCheckout';
export function BitcoinPurchasePanel({ trackId, env }: { trackId: string; env?: Record<string, unknown> }) {
  const checkout = getBitcoinCheckout(trackId, env);
  if (!checkout) return null;
  return (
    <section aria-label="Buy release with Bitcoin" className="rounded-2xl border border-neutral-700 bg-neutral-900 p-5 space-y-3">
      <h2 className="text-lg font-bold text-white">Own this release</h2>
      <p className="text-sm text-neutral-200">{checkout.price}</p>
      <p className="text-sm text-neutral-400">Pay on our hosted checkout using a Bitcoin wallet such as Trust Wallet. Provide your delivery email at checkout. We manually verify that payment is settled before emailing your private download link. Returning here does not confirm payment.</p>
      <a href={checkout.url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-[#ff5500] px-5 py-3 font-bold text-white hover:bg-[#ff6611]">Pay with Bitcoin<span className="sr-only"> (opens in a new tab)</span></a>
      <p className="text-sm text-neutral-400">Questions or delivery help? <a className="underline" href={`mailto:${checkout.supportEmail}`}>{checkout.supportEmail}</a></p>
    </section>
  );
}
