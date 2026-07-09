// Pre-flight for a test purchase: derive the buyer address from
// TEST_BUYER_PRIVATE_KEY in the repo .env and report USDC balances for
// buyer + store on the configured network. Never prints the key.
import { resolve } from "node:path";
import { createPublicClient, http, erc20Abi, getAddress } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

process.loadEnvFile(resolve(process.env.INIT_CWD ?? process.cwd(), ".env"));

const onMainnet = process.env.NETWORK === "base";
const chain = onMainnet ? base : baseSepolia;
const USDC = onMainnet
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7c";

const key = process.env.TEST_BUYER_PRIVATE_KEY ?? "";
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.log("KEY_FORMAT: INVALID — expected 0x + 64 hex chars, got length", key.length);
  process.exit(1);
}
console.log("KEY_FORMAT: ok");

const buyer = privateKeyToAccount(key as `0x${string}`);
const store = getAddress(process.env.PAY_TO_ADDRESS!);
const client = createPublicClient({ chain, transport: http() });

const bal = (who: `0x${string}`) =>
  client.readContract({ address: USDC as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [who] });

const [buyerBal, storeBal] = await Promise.all([bal(buyer.address), bal(store)]);
console.log(`network ${chain.name}`);
console.log(`buyer  ${buyer.address}  USDC: ${(Number(buyerBal) / 1e6).toFixed(2)}`);
console.log(`store  ${store.slice(0, 6)}…${store.slice(-4)}  USDC: ${(Number(storeBal) / 1e6).toFixed(2)}`);
