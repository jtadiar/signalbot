import GetKeyForm from "./components/GetKeyForm";

const features = [
  {
    title: "EMA/ATR Signal Engine",
    desc: "50-period trend filter on 1h candles with 20-period trigger on 15m. ATR-confirmed entries with automatic stop distance calculation.",
    icon: "📊",
  },
  {
    title: "Native TP/SL on Hyperliquid",
    desc: "Take-profit ladder with two configurable levels. Stop-loss placed directly on HL as trigger orders — visible on your chart.",
    icon: "🎯",
  },
  {
    title: "Trailing Stop",
    desc: "After TP2, the stop trails price by a configurable percentage. Lock in profits while letting winners run.",
    icon: "📈",
  },
  {
    title: "Risk Guardrails",
    desc: "Max leverage, daily loss limits, cooldowns after losses, and automatic position sizing. The bot protects your account.",
    icon: "🛡️",
  },
  {
    title: "Telegram Pings",
    desc: "Get instant notifications on every open, close, TP hit, and stop-out. Always know what your bot is doing.",
    icon: "💬",
  },
  {
    title: "Your Keys, Your Machine",
    desc: "Private keys never leave your device. No cloud, no custody, no middlemen. Direct execution via Hyperliquid API.",
    icon: "🔐",
  },
];

const stats = [
  { value: "20s", label: "Signal polling" },
  { value: "2", label: "TP levels" },
  { value: "< 1s", label: "Order execution" },
  { value: "24/7", label: "Always running" },
];

export default function Home() {
  return (
    <div className="grid-bg min-h-screen">
      {/* Floating Nav */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl">
        <div className="bg-black/60 backdrop-blur-2xl rounded-full border border-white/[0.08] px-6 h-14 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="heading-accent text-lg tracking-tight">SIGNALBOT</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/40 absolute left-1/2 -translate-x-1/2">
            <a href="#features" className="hover:text-white transition-colors duration-300">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors duration-300">Get Access</a>
            <a href="#faq" className="hover:text-white transition-colors duration-300">FAQ</a>
          </div>
          <a href="#pricing" className="btn-primary !py-2 !px-5 !text-sm !rounded-full">Get Started</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 relative">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--neon)] opacity-[0.04] blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] mb-10">
            <div className="pulse-dot" />
            <span className="text-sm text-white/40">Now trading on Hyperliquid</span>
          </div>

          <h1 className="heading-accent text-5xl md:text-7xl xl:text-8xl tracking-tight leading-[1.05] mb-8">
            <span className="gradient-text neon-text-glow">Automated</span><br />
            Hyperliquid Trading
          </h1>

          <p className="text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed">
            A trading bot that runs on your machine. EMA/ATR signals, native TP/SL placement,
            trailing stops, and risk guardrails. Your keys never leave your device.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <a href="#pricing" className="btn-primary text-lg">Get Started — Free</a>
            <a href="#features" className="btn-secondary text-lg">See Features</a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-[var(--neon)] neon-text-glow">{s.value}</div>
                <div className="text-sm text-white/30 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal Preview */}
      <section className="pb-24 px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full bg-[var(--neon)] opacity-[0.03] blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto">
          <div className="terminal-window glow-neon">
            <div className="terminal-header">
              <div className="terminal-dot" style={{ background: "#ff5f57" }} />
              <div className="terminal-dot" style={{ background: "#febc2e" }} />
              <div className="terminal-dot" style={{ background: "#28c840" }} />
              <span className="text-xs text-white/20 ml-2">signalbot</span>
            </div>
            <div className="terminal-body">
              <div className="text-[var(--neon)]">$ npx tauri dev</div>
              <br />
              <div className="text-white/20">░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░</div>
              <br />
              <div className="text-[var(--neon)] font-bold text-lg neon-text-glow">&nbsp; SIGNALBOT</div>
              <div className="text-white/30">&nbsp; Your Automated Hyperliquid Trader — v1.0.0</div>
              <br />
              <div className="text-white/20">░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░</div>
              <br />
              <div><span className="text-[var(--neon)]">✔</span> Loading strategy engine</div>
              <div><span className="text-[var(--neon)]">✔</span> Connecting to Hyperliquid</div>
              <div><span className="text-[var(--neon)]">✔</span> Syncing funding rates</div>
              <div><span className="text-[var(--neon)]">✔</span> Risk engine armed</div>
              <br />
              <div className="text-[var(--neon)] font-bold neon-text-glow">&nbsp; BOT RUNNING — scanning for signals...</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="heading-accent text-4xl md:text-5xl mb-6">
              Built for <span className="text-[var(--neon)] neon-text-glow">serious</span> traders
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Everything you need to automate your Hyperliquid perps strategy. Nothing you don&apos;t.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card">
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-white/30 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <h2 className="heading-accent text-4xl md:text-5xl text-center mb-20">
            How it <span className="text-[var(--neon)] neon-text-glow">works</span>
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--neon)]/15 to-transparent" />
            
            {[
              { step: "1", title: "Get Your Key", desc: "Enter your email below. You instantly get a unique license key and full installation instructions." },
              { step: "2", title: "Install & Launch", desc: "Install Node.js and Rust, clone the repo, and run one command to launch the desktop app." },
              { step: "3", title: "Start Trading", desc: "Enter your license key, configure your wallet and risk params, hit Start. The bot trades automatically 24/7." },
            ].map((s) => (
              <div key={s.step} className="text-center relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[var(--neon)] flex items-center justify-center mx-auto mb-6 text-black font-bold text-lg glow-neon-sm">{s.step}</div>
                <h3 className="font-semibold text-lg mb-3">{s.title}</h3>
                <p className="text-white/30 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get Access */}
      <section id="pricing" className="py-24 px-6 border-t border-white/[0.04] relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[var(--neon)] opacity-[0.04] blur-[100px] pointer-events-none" />
        
        <div className="max-w-lg mx-auto text-center relative z-10">
          <h2 className="heading-accent text-4xl md:text-5xl mb-4">
            Get <span className="text-[var(--neon)] neon-text-glow">Access</span>
          </h2>
          <p className="text-white/40 mb-14">Enter your email to get a license key. Free during early access.</p>

          <div className="card glow-neon !p-10 !border-[var(--neon)]/20">
            <div className="text-sm text-[var(--neon)] font-semibold uppercase tracking-wider mb-2">Signalbot License</div>
            <div className="text-5xl font-black mb-1 line-through text-white/20">$99</div>
            <div className="text-[var(--neon)] font-bold text-xl mb-8 neon-text-glow">FREE — Early Access</div>

            <ul className="text-left space-y-3 mb-10">
              {[
                "Unique license key",
                "Full desktop trading app",
                "EMA/ATR signal engine",
                "Configurable TP/SL + trailing stop",
                "Telegram notifications",
                "All future updates",
                "CONFIGURATION.md developer guide",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="text-[var(--neon)] mt-0.5">✓</span>
                  <span className="text-white/60">{item}</span>
                </li>
              ))}
            </ul>

            <GetKeyForm />

            <p className="text-xs text-white/20 mt-4">
              License key delivered instantly. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto">
          <h2 className="heading-accent text-4xl text-center mb-16">FAQ</h2>
          <div className="space-y-4">
            {[
              { q: "Is my private key safe?", a: "Yes. Your private key is stored locally on your machine with restrictive file permissions (owner-only). It is never transmitted, logged, or uploaded anywhere. All trades execute directly from your device to Hyperliquid." },
              { q: "What do I need to run the bot?", a: "Node.js and Rust (both free, quick installs), plus a Hyperliquid account with USDC deposited. After getting your key, you'll see step-by-step install instructions." },
              { q: "Can I customize the trading strategy?", a: "Yes. Every parameter is configurable: TP distances, trailing stop tightness, leverage, risk per trade, signal sensitivity, cooldowns, and more. See the CONFIGURATION.md guide." },
              { q: "Does it work on Mac and Windows?", a: "Yes. The CLI runs on any platform with Node.js — macOS, Windows, and Linux." },
              { q: "Is this free?", a: "Yes, Signalbot is free during early access. Pricing may change in the future — get your key now to lock in free access." },
              { q: "What pairs does it trade?", a: "Currently BTC-PERP on Hyperliquid. Additional pairs may be added in future updates." },
              { q: "How do I get my license key?", a: "Enter your email on this page. You'll instantly get your unique license key and full installation instructions." },
            ].map((faq) => (
              <div key={faq.q} className="card">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-white/30 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="heading-accent text-lg">SIGNALBOT</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-white/25">
            <a href="#pricing" className="hover:text-white transition-colors duration-300">Get Access</a>
            <a href="#faq" className="hover:text-white transition-colors duration-300">FAQ</a>
            <span>Built for Hyperliquid</span>
          </div>
        </div>
      </footer>

      {/* Risk disclaimer */}
      <div className="py-8 px-6 text-center text-xs text-white/15 border-t border-white/[0.04]">
        Trading perpetual futures involves substantial risk of loss. Past performance does not guarantee future results.
        This software is provided as-is. You are solely responsible for your trading decisions and any resulting gains or losses.
      </div>
    </div>
  );
}
