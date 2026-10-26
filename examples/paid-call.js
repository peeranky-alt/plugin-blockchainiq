// Runs the plugin's BLOCKCHAINIQ_MARKET_BRIEF action once ($0.01) and prints the settlement tx hash.
// Run: BLOCKCHAINIQ_PRIVATE_KEY=0x... node examples/paid-call.js
// Or pay from a Binance Agentic Wallet: BLOCKCHAINIQ_SIGNER=binance node examples/paid-call.js
import plugin from "../src/index.js";

const runtime = { getSetting: (k) => process.env[k] }; // minimal stand-in for an ElizaOS IAgentRuntime
const action = plugin.actions.find((a) => a.name === "BLOCKCHAINIQ_MARKET_BRIEF");
if (!(await action.validate(runtime))) throw new Error("Set BLOCKCHAINIQ_PRIVATE_KEY or BLOCKCHAINIQ_SIGNER=binance");
const result = await action.handler(runtime, { content: { text: "market brief" } }, undefined, {}, async (c) => {
  console.log("agent says:", c.text);
  return [];
});
if (!result.success) process.exit(1);
console.log("settlement:", JSON.stringify(result.data.settlement, null, 2));
if (result.data.settlement?.transaction) console.log(`https://basescan.org/tx/${result.data.settlement.transaction}`);
