/** Public Reown/WalletConnect project ID, never a wallet credential. */
export function walletConnectConfig(env: Record<string, unknown> = import.meta.env) {
  const projectId = env.VITE_WALLETCONNECT_PROJECT_ID;
  if (typeof projectId !== 'string' || !/^[a-f0-9]{32}$/i.test(projectId.trim())) return null;
  return { projectId: projectId.trim(), chains: [1] as [number] };
}
export function readWalletAccount(accounts: unknown): string | null {
  return Array.isArray(accounts) && typeof accounts[0] === 'string' && /^0x[a-f0-9]{40}$/i.test(accounts[0]) ? accounts[0] : null;
}

/** Close a session approved after the view that requested it has gone away. */
export async function connectWalletSession(provider: {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  chainId: number;
  accounts: string[];
}, isActive: () => boolean): Promise<string | null> {
  await provider.connect();
  if (!isActive()) { await provider.disconnect(); return null; }
  return provider.chainId === 1 ? readWalletAccount(provider.accounts) : null;
}
