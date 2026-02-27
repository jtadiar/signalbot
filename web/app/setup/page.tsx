import type { Metadata } from "next";
import TopTips from "../components/TopTips";

export const metadata: Metadata = {
  title: "Setup Guide — SIGNALBOT",
  description: "Step-by-step guide to set up Signalbot: fund your wallet, configure settings, and start trading on Hyperliquid.",
};

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M5 10l3.5 3.5L15 7" stroke="#ff6b00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 3L18 17H2L10 3z" stroke="#ff6b00" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 9v3M10 14.5v.5" stroke="#ff6b00" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const walletSteps = [
  {
    title: "Buy USDC on an exchange",
    desc: "If you don't already have USDC, buy it on Coinbase, Binance, or any exchange that supports withdrawals to Arbitrum.",
  },
  {
    title: "Send USDC to your wallet on Arbitrum",
    desc: "Withdraw USDC to your MetaMask (or any EVM wallet) on the Arbitrum network. Make sure you select Arbitrum as the withdrawal network, not Ethereum mainnet — fees are much lower.",
  },
  {
    title: "Bridge USDC to Hyperliquid",
    desc: 'Go to app.hyperliquid.xyz, connect your wallet, and click "Deposit" in the top-right. Bridge your USDC from Arbitrum into Hyperliquid. Make sure the funds land in your Perps/Trading account (not Spot).',
  },
  {
    title: "Find your wallet address",
    desc: "Your wallet address is the 0x... address shown in MetaMask at the top of the extension, or in the top-right of app.hyperliquid.xyz. Copy it — you'll need it during bot setup.",
  },
  {
    title: "Export your private key",
    desc: 'In MetaMask: click the three dots next to your account name → "Account details" → "Show private key". Enter your MetaMask password to reveal it. Copy the 64-character hex string.',
  },
];


export default function SetupPage() {
  return (
    <div className="grid-bg min-h-screen">
      {/* Nav */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl">
        <div className="bg-black/60 backdrop-blur-2xl rounded-full border border-white/[0.08] px-6 h-14 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <a href="/" className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="heading-accent text-lg tracking-tight">SIGNALBOT</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/40 absolute left-1/2 -translate-x-1/2">
            <a href="/#features" className="hover:text-white transition-colors duration-300">Features</a>
            <a href="/setup" className="text-[var(--neon)] transition-colors duration-300">Setup</a>
            <a href="/#pricing" className="hover:text-white transition-colors duration-300">Get Access</a>
            <a href="/#faq" className="hover:text-white transition-colors duration-300">FAQ</a>
          </div>
          <a href="/#pricing" className="btn-primary !py-2 !px-5 !text-sm !rounded-full">Get Started</a>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-36 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="heading-accent text-4xl md:text-6xl tracking-tight mb-6">
            Setup <span className="text-[var(--neon)] neon-text-glow">Guide</span>
          </h1>
          <p className="text-lg text-white/40 max-w-2xl mx-auto">
            Everything you need from zero to running your own trading bot.
            Follow each section in order.
          </p>
        </div>
      </section>

      {/* Video Tutorials */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="heading-accent text-2xl md:text-3xl mb-10">
            Video <span className="text-[var(--neon)]">Tutorials</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Installing the Desktop App", desc: "Clone, build, and launch Signalbot on your machine." },
              { title: "Configuring Settings", desc: "Walk through every setting: risk, TP/SL, signal params, and more." },
              { title: "Setting Up Telegram", desc: "Create a bot, get your token, and enable trade notifications." },
            ].map((v) => (
              <div key={v.title} className="card">
                <div className="aspect-video rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-[var(--neon)]/10 border border-[var(--neon)]/20 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--neon)">
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  </div>
                </div>
                <h3 className="font-semibold text-sm italic mb-1">{v.title}</h3>
                <p className="text-white/30 text-xs leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Tips */}
      <TopTips />

      {/* Section 1: Fund Your Wallet */}
      <section className="pb-20 px-6 border-t border-white/[0.04] pt-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--neon)] flex items-center justify-center text-black font-bold text-sm">1</div>
            <h2 className="heading-accent text-2xl md:text-3xl">
              Fund Your <span className="text-[var(--neon)]">Wallet</span>
            </h2>
          </div>
          <p className="text-white/40 text-sm mb-10 ml-11">
            Get USDC into Hyperliquid so the bot has funds to trade with.
          </p>

          <div className="space-y-4">
            {walletSteps.map((s, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="mt-0.5 shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--neon)]/10 flex items-center justify-center">
                    <CheckIcon />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Security warning */}
          <div className="mt-6 p-5 rounded-2xl border border-red-500/20 bg-red-500/[0.04]">
            <div className="flex gap-4">
              <div className="mt-0.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <WarningIcon />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1 text-red-400">Never share your private key</h3>
                <p className="text-white/35 text-sm leading-relaxed">
                  Your private key gives full control of your wallet. Never paste it into websites,
                  share it in Discord/Telegram, or send it to anyone. Signalbot stores it locally
                  on your machine with restrictive file permissions — it is never uploaded anywhere.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Install the App */}
      <section className="pb-20 px-6 border-t border-white/[0.04] pt-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--neon)] flex items-center justify-center text-black font-bold text-sm">2</div>
            <h2 className="heading-accent text-2xl md:text-3xl">
              Install the <span className="text-[var(--neon)]">App</span>
            </h2>
          </div>
          <p className="text-white/40 text-sm mb-10 ml-11">
            Download, install, and launch the Signalbot desktop app.
          </p>

          <div className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--neon)]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--neon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M12 8v4M10 10h4" />
              </svg>
            </div>
            <p className="text-white/50 text-sm mb-6">
              The installation guide and your unique license key will be provided after purchase.
            </p>
            <a href="/#pricing" className="btn-primary">Get Access — $29</a>
          </div>
        </div>
      </section>

      {/* Section 3: Configure */}
      <section className="pb-20 px-6 border-t border-white/[0.04] pt-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--neon)] flex items-center justify-center text-black font-bold text-sm">3</div>
            <h2 className="heading-accent text-2xl md:text-3xl">
              Configure & <span className="text-[var(--neon)]">Trade</span>
            </h2>
          </div>
          <p className="text-white/40 text-sm mb-10 ml-11">
            Fine-tune your strategy and let the bot run.
          </p>

          <div className="space-y-4">
            {[
              {
                title: "Set your risk parameters",
                desc: "In the Settings tab, configure max leverage, daily loss limit, risk per trade %, and cooldown periods. Start conservative — you can always increase later.",
              },
              {
                title: "Configure TP/SL levels",
                desc: "Set your take-profit distances (e.g. 2% and 3%), close fractions for each TP, and trailing stop settings. The bot will place these as native trigger orders on Hyperliquid.",
              },
              {
                title: "Set up Telegram notifications (optional)",
                desc: "Go to Settings → Telegram tab. Create a bot via @BotFather, paste the token, add your channel. You'll get pinged on every open, close, and stop-out.",
              },
              {
                title: "Hit Start",
                desc: "Go to the Dashboard and click Start Bot. The bot will begin scanning for EMA/ATR signals on BTC-PERP and trade automatically 24/7. You can stop, restart, or close trades manually at any time.",
              },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="mt-0.5 shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--neon)]/10 flex items-center justify-center">
                    <CheckIcon />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-6">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="heading-accent text-2xl md:text-3xl mb-4">
            Ready to <span className="text-[var(--neon)] neon-text-glow">start</span>?
          </h2>
          <p className="text-white/40 text-sm mb-8">Get your license key and follow the steps above.</p>
          <a href="/#pricing" className="btn-primary text-lg">Get Access — $29</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="heading-accent text-lg">SIGNALBOT</span>
          </a>
          <div className="flex items-center gap-8 text-sm text-white/25">
            <a href="/#pricing" className="hover:text-white transition-colors duration-300">Get Access</a>
            <a href="/setup" className="hover:text-white transition-colors duration-300">Setup</a>
            <a href="/#faq" className="hover:text-white transition-colors duration-300">FAQ</a>
            <span>Built for Hyperliquid</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
