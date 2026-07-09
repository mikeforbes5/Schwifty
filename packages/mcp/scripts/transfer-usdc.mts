// Transfer testnet USDC from the TEST_BUYER_PRIVATE_KEY wallet to any address.
// Usage: npx tsx packages/mcp/scripts/transfer-usdc.mts --to 0xRECIPIENT --amount 2.50
// Needs a little Base Sepolia ETH in the sending wallet for gas.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { createPublicClient, createWalletClient, http, erc20Abi, getAddress, formatEther } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

process.loadEnvFile(resolve(process.env.INIT_CWD ?? process.cwd(), ".env"));

const { values } = parseArgs({ options: {
  to: { type: "string" },
  amount: { type: "string" },
} });
if (!values.to || !values.amount) {
  console.log("Usage: npx tsx packages/mcp/scripts/transfer-usdc.mts --to 0xRECIPIENT --amount 2.50");
  process.exit(1);
}

const onMainnet = process.env.NETWORK === "base";
if (onMainnet) {
  console.log("Refusing to run: NETWORK=base (mainnet). This tool is for testnet only.");
  process.exit(1);
}
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const key = process.env.TEST_BUYER_PRIVATE_KEY ?? "";
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.log("TEST_BUYER_PRIVATE_KEY missing or malformed in .env (expected 0x + 64 hex chars)");
  process.exit(1);
}

const account = privateKeyToAccount(key as `0x${string}`);
const to = getAddress(values.to);
const units = BigInt(Math.round(Number(values.amount) * 1e6));

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });

const [usdcBal, ethBal] = await Promise.all([
  publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  publicClient.getBalance({ address: account.address }),
]);
console.log(`from ${account.address}`);
console.log(`  USDC: ${(Number(usdcBal) / 1e6).toFixed(2)} | gas ETH: ${formatEther(ethBal)}`);

if (usdcBal < units) {
  console.log(`Insufficient USDC: have ${(Number(usdcBal) / 1e6).toFixed(2)}, sending ${values.amount}`);
  process.exit(1);
}
if (ethBal === 0n) {
  console.log("No Base Sepolia ETH for gas. Get some free from the Coinbase Developer Platform or Alchemy faucet, then retry.");
  process.exit(1);
}

const hash = await wallet.writeContract({
  address: USDC, abi: erc20Abi, functionName: "transfer", args: [to, units],
});
console.log(`sent ${values.amount} USDC → ${to}`);
console.log(`tx: https://sepolia.basescan.org/tx/${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`status: ${receipt.status}`);
