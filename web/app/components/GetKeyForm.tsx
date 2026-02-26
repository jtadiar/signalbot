"use client";

import { useState, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import {
  RECIPIENT,
  PRICE_RAW,
  PRICE_DISPLAY,
  TOKEN_ADDRESSES,
  SUPPORTED_CHAINS,
  ERC20_ABI,
} from "@/lib/wagmi";

type Token = "usdc" | "usdt";
type Step = "email" | "connect" | "pay" | "confirming" | "verifying";

export default function GetKeyForm() {
  const [email, setEmail] = useState("");
  const [selectedChainId, setSelectedChainId] = useState(SUPPORTED_CHAINS[0].id);
  const [selectedToken, setSelectedToken] = useState<Token>("usdc");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: isSending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const handleEmailSubmit = useCallback(() => {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setError("");
    setStep("connect");
  }, [email]);

  const handleProceedToPay = useCallback(() => {
    if (!isConnected) {
      setError("Connect your wallet first.");
      return;
    }
    setError("");
    setStep("pay");
  }, [isConnected]);

  const handlePay = useCallback(async () => {
    setError("");
    try {
      if (chain?.id !== selectedChainId) {
        await switchChainAsync({ chainId: selectedChainId });
      }

      const tokens = TOKEN_ADDRESSES[selectedChainId];
      const tokenAddress = selectedToken === "usdc" ? tokens.usdc : tokens.usdt;

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [RECIPIENT, PRICE_RAW],
      });

      setTxHash(hash);
      setStep("confirming");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setError("Transaction cancelled.");
      } else if (msg.includes("insufficient")) {
        setError("Insufficient balance. Make sure you have enough tokens and gas.");
      } else {
        setError(msg.length > 100 ? "Transaction failed. Please try again." : msg);
      }
    }
  }, [chain, selectedChainId, selectedToken, switchChainAsync, writeContractAsync]);

  const handleVerify = useCallback(async () => {
    if (!txHash) return;
    setStep("verifying");
    setError("");

    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          txHash,
          chainId: selectedChainId,
        }),
      });
      const data = await res.json();
      if (data.key) {
        window.location.href = `/success?key=${encodeURIComponent(data.key)}`;
      } else {
        setError(data.error || "Verification failed.");
        setStep("confirming");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("confirming");
    }
  }, [txHash, email, selectedChainId]);

  if (isConfirmed && step === "confirming") {
    handleVerify();
  }

  const chainName =
    SUPPORTED_CHAINS.find((c) => c.id === selectedChainId)?.name ?? "";

  return (
    <div className="space-y-4">
      {/* Step 1: Email */}
      {step === "email" && (
        <>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
            className="w-full px-4 py-3.5 rounded-full bg-black border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-[var(--neon)]/50 focus:shadow-[0_0_20px_rgba(255,107,0,0.1)] transition-all text-center"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={handleEmailSubmit}
            className="btn-primary w-full justify-center text-lg"
          >
            Continue
          </button>
        </>
      )}

      {/* Step 2: Connect Wallet */}
      {step === "connect" && (
        <div className="space-y-4">
          <p className="text-white/40 text-sm text-center">
            Connect your wallet to pay {PRICE_DISPLAY}
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
          {isConnected && (
            <button
              onClick={handleProceedToPay}
              className="btn-primary w-full justify-center text-lg"
            >
              Continue to Payment
            </button>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={() => { setStep("email"); setError(""); }}
            className="w-full text-center text-sm text-white/25 hover:text-white/50 transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {/* Step 3: Pay */}
      {step === "pay" && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--neon)] mb-1">{PRICE_DISPLAY}</div>
            <p className="text-white/40 text-sm">One-time payment</p>
          </div>

          {/* Chain selector */}
          <div>
            <label className="block text-xs text-white/30 uppercase tracking-wider mb-2 text-center">
              Network
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_CHAINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChainId(c.id)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                    selectedChainId === c.id
                      ? "border-[var(--neon)]/40 bg-[var(--neon)]/10 text-[var(--neon)]"
                      : "border-white/[0.08] text-white/40 hover:border-white/20"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Token selector */}
          <div>
            <label className="block text-xs text-white/30 uppercase tracking-wider mb-2 text-center">
              Token
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["usdc", "usdt"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedToken(t)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                    selectedToken === t
                      ? "border-[var(--neon)]/40 bg-[var(--neon)]/10 text-[var(--neon)]"
                      : "border-white/[0.08] text-white/40 hover:border-white/20"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet preview */}
          {address && (
            <div className="text-center text-xs text-white/20">
              Paying from{" "}
              <span className="font-mono text-white/40">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>{" "}
              on {chainName}
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            onClick={handlePay}
            disabled={isSending}
            className="btn-primary w-full justify-center text-lg"
          >
            {isSending ? "Confirm in Wallet..." : `Pay ${PRICE_DISPLAY} ${selectedToken.toUpperCase()}`}
          </button>

          <button
            onClick={() => { setStep("connect"); setError(""); }}
            className="w-full text-center text-sm text-white/25 hover:text-white/50 transition-colors"
          >
            Back
          </button>
        </div>
      )}

      {/* Step 4: Confirming / Verifying */}
      {(step === "confirming" || step === "verifying") && (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-white/10 border-t-[var(--neon)] animate-spin" />
          </div>
          <div>
            <p className="text-white font-semibold">
              {step === "confirming"
                ? "Waiting for confirmation..."
                : "Verifying payment..."}
            </p>
            <p className="text-white/30 text-sm mt-1">
              {step === "confirming"
                ? "Your transaction is being confirmed on-chain."
                : "Checking the blockchain and generating your license key."}
            </p>
          </div>
          {txHash && (
            <p className="text-xs text-white/20 font-mono break-all">
              tx: {txHash}
            </p>
          )}
          {error && (
            <>
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={handleVerify}
                className="btn-primary w-full justify-center"
              >
                Retry Verification
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
