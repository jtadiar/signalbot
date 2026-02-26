import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  decodeEventLog,
  type Hex,
  type Address,
} from "viem";
import { mainnet, base, arbitrum, polygon } from "viem/chains";
import { createLicense } from "@/lib/license";
import { getStore } from "@netlify/blobs";

const RECIPIENT: Address = "0x438b4CBA3aBEfb8Ea1588948187534E5f339cbE0";
const MIN_AMOUNT = BigInt(29_000_000);

const CHAINS: Record<number, typeof mainnet> = {
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [polygon.id]: polygon,
};

const VALID_TOKENS: Record<number, Set<string>> = {
  [mainnet.id]: new Set([
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0xdac17f958d2ee523a2206206994597c13d831ec7",
  ]),
  [base.id]: new Set([
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "0xfde4c96c990497560a68c38ea4e790d2dd1b592a",
  ]),
  [arbitrum.id]: new Set([
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  ]),
  [polygon.id]: new Set([
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  ]),
};

const TRANSFER_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

async function isTxUsed(txHash: string): Promise<boolean> {
  try {
    const store = getStore("used_tx_hashes");
    const val = await store.get(txHash, { type: "text" });
    return !!val;
  } catch {
    return false;
  }
}

async function markTxUsed(txHash: string, email: string): Promise<void> {
  const store = getStore("used_tx_hashes");
  await store.set(txHash, JSON.stringify({ email, ts: new Date().toISOString() }));
}

export async function POST(req: NextRequest) {
  try {
    const { email, txHash, chainId } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }
    if (!txHash || typeof txHash !== "string") {
      return NextResponse.json({ error: "Transaction hash required." }, { status: 400 });
    }
    const numChainId = Number(chainId);
    const chain = CHAINS[numChainId];
    if (!chain) {
      return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
    }

    if (await isTxUsed(txHash)) {
      return NextResponse.json({ error: "This transaction has already been used." }, { status: 400 });
    }

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed on-chain." }, { status: 400 });
    }

    const validTokens = VALID_TOKENS[numChainId];
    let verified = false;

    for (const log of receipt.logs) {
      const tokenAddr = log.address.toLowerCase();
      if (!validTokens.has(tokenAddr)) continue;

      try {
        const decoded = decodeEventLog({
          abi: TRANSFER_EVENT_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== "Transfer") continue;

        const to = (decoded.args.to as string).toLowerCase();
        const value = decoded.args.value as bigint;

        if (to === RECIPIENT.toLowerCase() && value >= MIN_AMOUNT) {
          verified = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Payment not found. Ensure you sent at least $29 USDC/USDT to the correct address." },
        { status: 400 }
      );
    }

    await markTxUsed(txHash, email.trim().toLowerCase());
    const key = await createLicense(email.trim().toLowerCase());

    return NextResponse.json({ key });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
