# plugin-blockchainiq (ElizaOS)

ElizaOS plugin for the [Blockchain IQ](https://www.blockchainiq.co/agents) x402 API: crypto market data paid per call in USDC on Base. No account, no API key.

| Action | Resource | Price |
|---|---|---|
| `BLOCKCHAINIQ_MARKET_BRIEF` | `/brief` | $0.01 |
| `BLOCKCHAINIQ_EVENT_RISK` | `/event-risk` (options `days`, `minImportance`) | $0.05 |

## Settings
- `BLOCKCHAINIQ_PRIVATE_KEY` (or `AGENT_PRIVATE_KEY`): a dedicated wallet with a little USDC on Base
- `BLOCKCHAINIQ_MAX_USD_PER_CALL`: spend cap per call (default 0.1)

## Add to a character
```js
import blockchainIQPlugin from "@peeranky/plugin-blockchainiq";
export const character = { name: "Trader", plugins: [], /* ... */ };
// agent runtime: plugins: [blockchainIQPlugin]
```

## Paid-call demo
```
npm install
BLOCKCHAINIQ_PRIVATE_KEY=0x... npm run demo
```
Runs the market brief action once and prints the x402 settlement transaction hash.

Settlement is gasless for the payer. Data is market data, not investment advice. MIT license.

## Pay from a Binance Agentic Wallet (no private key)
Sign in the `baw` CLI (`baw auth signin`), then set `BLOCKCHAINIQ_SIGNER=binance`. On each HTTP 402 the integration runs `baw x402-payment preview` and `sign` for the Base USDC option, then replays the request with the `PAYMENT-SIGNATURE` header. Keys stay in Binance's MPC wallet.

## Verified paid call
`BLOCKCHAINIQ_SIGNER=binance node examples/paid-call.js` ran the BLOCKCHAINIQ_MARKET_BRIEF action, which paid `/brief` ($0.01 USDC on Base):
[0x3ad2b8060a313af38cd2dade01c7ec619f3577eae5ef4a7ea09e99b3be801596](https://basescan.org/tx/0x3ad2b8060a313af38cd2dade01c7ec619f3577eae5ef4a7ea09e99b3be801596)
