# WalletConnect and Bitcoin release pilot

## WalletConnect
Create a project in the official Reown dashboard and set the public project ID as `VITE_WALLETCONNECT_PROJECT_ID` in the deployment host. Allow the exact production and development origins there. Rebuild after configuration changes. The track detail panel uses the official WalletConnect Ethereum provider, loads it only on interaction, and offers a QR connection. Ethereum mainnet is the sole supported chain. Compatible Trust Wallet EVM accounts can connect. No signatures, transfers, wallet login, or download authorization are implemented; connection alone is not authentication or payment. Existing Vault demo balances and escrow remain separate and are not connected to real funds.

Real-device acceptance: open a release, connect via QR with a supported wallet, reject once and retry, confirm the displayed Ethereum account, change accounts, change chains, return to Ethereum, disconnect in-app and from the wallet, and verify UI state updates. Inspect the wallet approval: there must be no transaction or signing request. Repeat on mobile. These network/device checks need a real Reown project and wallet; unit tests do not establish their success.

## Hosted Bitcoin checkout
Create a BTCPay store on a host you trust. Connect a receiving wallet through the host's supported process. A Trust Wallet public receiving address alone is not a full BTCPay wallet integration; confirm the host's supported wallet/derivation setup. Never give Sistrum a seed phrase or private key. Do not substitute an Ethereum address for Bitcoin.

Create a fixed-price checkout for one actual release, collect the buyer delivery email, and configure:
- `VITE_BTCPAY_RELEASE_ID`: exact real catalog track ID, not a guessed mock ID.
- `VITE_BTCPAY_CHECKOUT_URL`: public HTTPS hosted checkout URL.
- `VITE_BTCPAY_PRICE_LABEL`: matches the configured checkout price and currency.
- `VITE_BTCPAY_SUPPORT_EMAIL`: monitored delivery/support inbox.

No checkout is displayed until all fields validate. No API key is needed for this hosted-link pilot. Build-time VITE values are public. Do not put paid audio URLs or secrets in them. Rebuild and deploy after edits.

Keep the purchased master in private storage, separate from publicly playable previews. Verify the invoice is Settled in BTCPay, confirm release, amount/currency and delivery email, then email an expiring signed download link. Never fulfill from a browser redirect, screenshot, wallet connection or unconfirmed transaction. Review refunds and customer delivery terms before launch. Test one small payment and private delivery end-to-end before promoting the release. Do not claim live payments work without this check.

## Validation and deployment
Run `npm ci`, `npm run check`. Push the reviewed feature branch and deploy through the repository's existing host after setting public configuration. Docker/Cloud Build also need these VITE values forwarded into the build; runtime environment changes cannot change an already-built static bundle. The Vercel project is not authenticated by a GitHub push alone. This change does not deploy or operate BTCPay. No wallet sponsorship or official partnership is implied.
