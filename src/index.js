// ElizaOS plugin for the Blockchain IQ x402 API: pay-per-call crypto data in USDC on Base.
// Settings: BLOCKCHAINIQ_PRIVATE_KEY (or AGENT_PRIVATE_KEY), optional BLOCKCHAINIQ_MAX_USD_PER_CALL (default 0.1).
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createBinanceAgenticFetch } from "./binance-signer.js";

const BASE = "https://www.blockchainiq.co/api/x402/v1";
const cache = new WeakMap();

function setting(runtime, key) {
  return runtime?.getSetting?.(key) ?? process.env[key];
}

function payFetchFor(runtime) {
  if (cache.has(runtime)) return cache.get(runtime);
  if (String(setting(runtime, "BLOCKCHAINIQ_SIGNER") ?? "").toLowerCase() === "binance") {
    const f = createBinanceAgenticFetch({ maxUsdPerCall: Number(setting(runtime, "BLOCKCHAINIQ_MAX_USD_PER_CALL") ?? 0.1) });
    cache.set(runtime, f);
    return f;
  }
  const key = setting(runtime, "BLOCKCHAINIQ_PRIVATE_KEY") ?? setting(runtime, "AGENT_PRIVATE_KEY");
  if (!key) throw new Error("BLOCKCHAINIQ_PRIVATE_KEY is not set (use a dedicated wallet with a little USDC on Base).");
  const max = Number(setting(runtime, "BLOCKCHAINIQ_MAX_USD_PER_CALL") ?? 0.1);
  const client = x402Client.fromConfig({
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(privateKeyToAccount(key)) }],
    spendControls: { maxAmountPerPayment: max },
  });
  const f = wrapFetchWithPayment(fetch, client);
  cache.set(runtime, f);
  return f;
}

export async function paidGet(runtime, path) {
  const res = await payFetchFor(runtime)(`${BASE}${path}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`Blockchain IQ ${path}: HTTP ${res.status} ${JSON.stringify(body)}`);
  const h = res.headers.get("payment-response");
  return { data: body.data, settlement: h ? decodePaymentResponseHeader(h) : null };
}

const fmtPct = (v) => (v == null ? "n/a" : `${v > 0 ? "+" : ""}${v}%`);

export const getMarketBrief = {
  name: "BLOCKCHAINIQ_MARKET_BRIEF",
  similes: ["CRYPTO_MARKET_BRIEF", "MARKET_BRIEF", "CHECK_CRYPTO_MARKET"],
  description:
    "Buy the Blockchain IQ market brief ($0.01 USDC via x402): BTC, ETH, SOL, XRP prices and moves, events in the next 48h, and risk flags.",
  validate: async (runtime) => Boolean(setting(runtime, "BLOCKCHAINIQ_SIGNER") === "binance" || (setting(runtime, "BLOCKCHAINIQ_PRIVATE_KEY") ?? setting(runtime, "AGENT_PRIVATE_KEY"))),
  handler: async (runtime, _message, _state, _options, callback) => {
    try {
      const { data, settlement } = await paidGet(runtime, "/brief");
      const coins = (data.coins ?? [])
        .map((c) => `${c.symbol.toUpperCase()} $${c.price} (24h ${fmtPct(c.change24h)}, 7d ${fmtPct(c.change7d)})`)
        .join("; ");
      const flags = (data.flags ?? []).join(" | ") || "none";
      const text = `Market brief as of ${data.asOf}: ${coins}. Risk flags: ${flags}.`;
      await callback?.({ text, actions: ["BLOCKCHAINIQ_MARKET_BRIEF"], source: "blockchainiq" });
      return { success: true, text, data: { brief: data, settlement } };
    } catch (error) {
      await callback?.({ text: `Could not fetch the Blockchain IQ brief: ${error.message}` });
      return { success: false, error };
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "What's the crypto market doing right now?" } },
      { name: "{{agent}}", content: { text: "Pulling the Blockchain IQ market brief.", actions: ["BLOCKCHAINIQ_MARKET_BRIEF"] } },
    ],
  ],
};

export const getEventRisk = {
  name: "BLOCKCHAINIQ_EVENT_RISK",
  similes: ["EVENT_RISK", "ECONOMIC_CALENDAR", "UPCOMING_MARKET_EVENTS"],
  description:
    "Buy Blockchain IQ event risk ($0.05 USDC via x402): market-moving events for the next 7 days (CPI, jobs, FOMC, ECB, BoJ, auctions, crypto milestones) with importance and sources.",
  validate: async (runtime) => Boolean(setting(runtime, "BLOCKCHAINIQ_SIGNER") === "binance" || (setting(runtime, "BLOCKCHAINIQ_PRIVATE_KEY") ?? setting(runtime, "AGENT_PRIVATE_KEY"))),
  handler: async (runtime, _message, _state, options, callback) => {
    try {
      const days = Number(options?.days ?? 7);
      const minImportance = Number(options?.minImportance ?? 2);
      const { data, settlement } = await paidGet(runtime, `/event-risk?days=${days}&minImportance=${minImportance}`);
      const list = (data.events ?? []).map((e) => `${e.date}${e.time ? " " + e.time + " ET" : ""} ${e.title} (importance ${e.importance})`);
      const text = list.length ? `Next ${days} days: ${list.join("; ")}.` : `No events of importance ${minImportance}+ in the next ${days} days.`;
      await callback?.({ text, actions: ["BLOCKCHAINIQ_EVENT_RISK"], source: "blockchainiq" });
      return { success: true, text, data: { eventRisk: data, settlement } };
    } catch (error) {
      await callback?.({ text: `Could not fetch Blockchain IQ event risk: ${error.message}` });
      return { success: false, error };
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "Any big macro events this week before I trade?" } },
      { name: "{{agent}}", content: { text: "Checking the event calendar.", actions: ["BLOCKCHAINIQ_EVENT_RISK"] } },
    ],
  ],
};

export const blockchainIQPlugin = {
  name: "blockchainiq",
  description: "Pay-per-call crypto market data from Blockchain IQ over x402 (USDC on Base).",
  actions: [getMarketBrief, getEventRisk],
};

export default blockchainIQPlugin;
