import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, base, arbitrum, polygon } from "wagmi/chains";
import type { Address } from "viem";

export const config = getDefaultConfig({
  appName: "Signalbot",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "PLACEHOLDER",
  chains: [mainnet, base, arbitrum, polygon],
  ssr: true,
});

export const RECIPIENT: Address =
  "0x438b4CBA3aBEfb8Ea1588948187534E5f339cbE0";

export const PRICE_RAW = BigInt(29_000_000); // 29 USDC/USDT (6 decimals)
export const PRICE_DISPLAY = "$29";

export const TOKEN_ADDRESSES: Record<
  number,
  { usdc: Address; usdt: Address }
> = {
  [mainnet.id]: {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  [base.id]: {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdt: "0xfde4C96c990497560A68c38eA4e790d2dD1b592A",
  },
  [arbitrum.id]: {
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  [polygon.id]: {
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
};

export const SUPPORTED_CHAINS = [
  { id: mainnet.id, name: "Ethereum" },
  { id: base.id, name: "Base" },
  { id: arbitrum.id, name: "Arbitrum" },
  { id: polygon.id, name: "Polygon" },
];

export const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
