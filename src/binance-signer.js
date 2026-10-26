// Pays x402 402s through a Binance Agentic Wallet (keys stay in Binance's MPC wallet).
// Needs the `baw` CLI signed in (npm i -g @binance/agentic-wallet; baw auth signin).
import { execFileSync } from "node:child_process";

function baw(args) {
  const out = execFileSync(process.env.BAW_BIN || "baw", [...args, "--json"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const json = JSON.parse(out);
  if (!json.success) throw new Error(`baw ${args[0]} ${args[1] ?? ""} failed: ${out}`);
  return json.data;
}

/** fetch wrapper: on HTTP 402, preview + sign with the Agentic Wallet, then replay once. */
export function createBinanceAgenticFetch({ network = "eip155:8453", maxUsdPerCall = 0.1, log = () => {} } = {}) {
  return async function payFetch(url, init = {}) {
    const first = await fetch(url, init);
    if (first.status !== 402) return first;
    const required = first.headers.get("payment-required");
    if (!required) return first;
    const preview = baw(["x402-payment", "preview", "--paymentRequirements", required]);
    const option = preview.options.find(
      (o) => o.status === "READY_TO_SIGN" && o.originalAccept?.network === network && Number(o.amountUsd) <= maxUsdPerCall
    );
    if (!option) throw new Error(`No signable option on ${network} under $${maxUsdPerCall}: ${JSON.stringify(preview.options.map((o) => [o.index, o.status, o.reasons]))}`);
    log(`Paying ${option.amount} ${option.tokenSymbol} from ${option.userWalletAddress}`);
    const signed = baw(["x402-payment", "sign", "--paymentId", preview.paymentId, "--selectedIndex", String(option.index)]);
    // Wait out validAfter so the facilitator's simulation doesn't revert ("authorization is not yet valid").
    try {
      const auth = JSON.parse(Buffer.from(signed.paymentHeaderValue, "base64").toString("utf8"))?.payload?.authorization;
      const waitMs = (Number(auth?.validAfter ?? 0) + 3) * 1000 - Date.now();
      log(`validAfter=${auth?.validAfter} now=${Math.floor(Date.now() / 1000)}`);
      if (waitMs > 0 && waitMs < 120000) await new Promise((r) => setTimeout(r, waitMs));
    } catch {}
    const headers = new Headers(init.headers || {});
    headers.set(signed.paymentHeaderName, signed.paymentHeaderValue);
    const paid = await fetch(url, { ...init, headers });
    if (paid.status === 402) {
      const why = paid.headers.get("payment-required");
      log(`Payment rejected: ${why ? Buffer.from(why, "base64").toString("utf8") : "no reason given"}`);
    }
    return paid;
  };
}
