import { useEffect, useRef, useState } from 'react';
import { connectWalletSession, readWalletAccount, walletConnectConfig } from '../services/walletConnect';
import type EthereumProvider from '@walletconnect/ethereum-provider';

export function WalletConnectPanel() {
  const config = walletConnectConfig();
  const provider = useRef<EthereumProvider | null>(null);
  const mounted = useRef(false);
  const removeListeners = useRef<() => void>(() => {});
  const busyRef = useRef(false);
  const [account, setAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; removeListeners.current(); void provider.current?.disconnect().catch(() => {}); provider.current = null; };
  }, []);
  if (!config) return null;
  async function connect() {
    if (busyRef.current || !config) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (!provider.current) {
        const { default: Provider } = await import('@walletconnect/ethereum-provider');
        const next = await Provider.init({ ...config, showQrModal: true, methods: [], optionalMethods: [], events: ['accountsChanged', 'chainChanged'], metadata: { name: 'NRN Sistrum', description: 'Connect a wallet to Sistrum. No payment is requested.', url: window.location.origin, icons: [new URL('/icons/icon.svg', window.location.origin).href] } });
        if (!mounted.current) { await next.disconnect(); return; }
        provider.current = next;
        const onAccounts = (accounts: unknown) => { if (mounted.current) setAccount(next.chainId === 1 ? readWalletAccount(accounts) : null); };
        const onChain = () => { if (mounted.current) setAccount(next.chainId === 1 ? readWalletAccount(next.accounts) : null); };
        const onDisconnect = () => { if (mounted.current) setAccount(null); };
        next.on('accountsChanged', onAccounts);
        next.on('chainChanged', onChain);
        next.on('disconnect', onDisconnect);
        removeListeners.current = () => { next.removeListener('accountsChanged', onAccounts); next.removeListener('chainChanged', onChain); next.removeListener('disconnect', onDisconnect); };
      }
      const next = provider.current;
      const address = await connectWalletSession(next, () => mounted.current);
      if (mounted.current) {
        setAccount(address);
        if (!address) setError('Select an Ethereum mainnet account in your wallet.');
      }
    } catch { if (mounted.current) setError('Wallet connection was canceled or unavailable. Please try again.'); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function disconnect() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await provider.current?.disconnect(); if (mounted.current) setAccount(null); }
    catch { if (mounted.current) setError('Could not disconnect. End this session from your wallet.'); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  return <section aria-label="WalletConnect" className="rounded-2xl border border-neutral-700 bg-neutral-900 p-5 space-y-3">
    <h2 className="text-lg font-bold">Connect your wallet</h2>
    <p className="text-sm text-neutral-400">Connect an Ethereum wallet through WalletConnect, including compatible Trust Wallet accounts. Connection does not sign you in, send funds, purchase a release, or unlock downloads. Bitcoin purchases use the separate checkout.</p>
    {account && <p className="break-all font-mono text-sm" role="status">Connected: {account}</p>}
    <button type="button" disabled={busy} onClick={account ? disconnect : connect} className="rounded-xl bg-neutral-700 px-5 py-3 font-bold disabled:opacity-50">{busy ? 'Please wait…' : account ? 'Disconnect wallet' : 'Connect with WalletConnect'}</button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
}
