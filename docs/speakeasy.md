# Instinct Ink speakeasy

The public page is the shop. Sistrum is the room behind it.

## Door

The first S in Instinct, the only S in the wordmark, opens the app. It is set as type: same face, same size, text cursor, no underline. Shop, Originals, About, and the product tiles go to instinctinkidentity.com.

## Behavior

- First visit shows the storefront: Retro Camera Tee, Iguana Sombrero Crewneck, Wolf & Leopard Towel, Black Tiger Leggings.
- Pressing that S sets `sessionStorage` key `sistrum-door` to `open` and mounts the existing Sistrum app.
- A refresh in the same tab stays inside. A new tab starts at the shop.

## Code

- `src/components/SpeakeasyGate.tsx`
- Wrapped in `src/main.tsx`
- Commit `bfd4d5b`

Palette matches the shop: `#000000`, `#ffffff`, `#262626`, `#ececec`.
