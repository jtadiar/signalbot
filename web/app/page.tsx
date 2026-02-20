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
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#0a0e17]/80 border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="font-bold text-lg tracking-tight">SIGNALBOT</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-[var(--text-muted)] hover:text-white transition">Features</a>
            <a href="#pricing" className="text-sm text-[var(--text-muted)] hover:text-white transition">Get Access</a>
            <a href="#faq" className="text-sm text-[var(--text-muted)] hover:text-white transition">FAQ</a>
            <a href="#pricing" className="btn-primary !py-2 !px-5 !text-sm">Get Started</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] mb-8">
            <div className="pulse-dot" />
            <span className="text-sm text-[var(--text-muted)]">Now trading on Hyperliquid</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            <span className="gradient-text">Automated</span><br />
            Hyperliquid Trading
          </h1>

          <p className="text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            A trading bot that runs on your machine. EMA/ATR signals, native TP/SL placement,
            trailing stops, and risk guardrails. Your keys never leave your device.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a href="#pricing" className="btn-primary text-lg">Get Started — Free</a>
            <a href="#features" className="btn-secondary text-lg">See Features</a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-[var(--neon)]">{s.value}</div>
                <div className="text-sm text-[var(--text-muted)]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal Preview */}
      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="terminal-window glow-green">
            <div className="terminal-header">
              <div className="terminal-dot" style={{ background: "#ff5f57" }} />
              <div className="terminal-dot" style={{ background: "#febc2e" }} />
              <div className="terminal-dot" style={{ background: "#28c840" }} />
              <span className="text-xs text-[var(--text-muted)] ml-2">signalbot</span>
            </div>
            <div className="terminal-body">
              <div className="text-[var(--neon)]">$ npx tauri dev</div>
              <br />
              <div className="text-[var(--cyan)]">░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░</div>
              <br />
              <div className="text-[var(--neon)] font-bold text-lg">  SIGNALBOT</div>
              <div className="text-[var(--text-muted)]">  Your Automated Hyperliquid Trader — v1.0.0</div>
              <br />
              <div className="text-[var(--cyan)]">░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░</div>
              <br />
              <div><span className="text-[var(--neon)]">✔</span> Loading strategy engine</div>
              <div><span className="text-[var(--neon)]">✔</span> Connecting to Hyperliquid</div>
              <div><span className="text-[var(--neon)]">✔</span> Syncing funding rates</div>
              <div><span className="text-[var(--neon)]">✔</span> Risk engine armed</div>
              <br />
              <div className="text-[var(--neon)] font-bold">  BOT RUNNING — scanning for signals...</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for serious traders</h2>
            <p className="text-[var(--text-muted)] text-lg max-w-xl mx-auto">
              Everything you need to automate your Hyperliquid perps strategy. Nothing you don&apos;t.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Get Your Key", desc: "Enter your email below. You instantly get a unique license key and full installation instructions." },
              { step: "2", title: "Install & Launch", desc: "Install Node.js and Rust, clone the repo, and run one command to launch the desktop app." },
              { step: "3", title: "Start Trading", desc: "Enter your license key, configure your wallet and risk params, hit Start. The bot trades automatically 24/7." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full border-2 border-[var(--neon)] flex items-center justify-center mx-auto mb-4 text-[var(--neon)] font-bold text-lg">{s.step}</div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-[var(--text-muted)] text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get Access */}
      <section id="pricing" className="py-20 px-6 border-t border-[var(--border)]">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Access</h2>
          <p className="text-[var(--text-muted)] mb-12">Enter your email to get a license key. Free during early access.</p>

          <div className="card glow-green !p-8">
            <div className="text-sm text-[var(--neon)] font-semibold uppercase tracking-wider mb-2">Signalbot License</div>
            <div className="text-5xl font-black mb-1 line-through text-[var(--text-muted)]">$99</div>
            <div className="text-[var(--neon)] font-bold text-xl mb-6">FREE — Early Access</div>

            <ul className="text-left space-y-3 mb-8">
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
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <GetKeyForm />

            <p className="text-xs text-[var(--text-muted)] mt-4">
              License key delivered instantly. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">FAQ</h2>
          <div className="space-y-6">
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
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="font-bold">SIGNALBOT</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--text-muted)]">
            <a href="#pricing" className="hover:text-white transition">Get Access</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <span>Built for Hyperliquid</span>
          </div>
        </div>
      </footer>

      {/* Risk disclaimer */}
      <div className="py-6 px-6 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        Trading perpetual futures involves substantial risk of loss. Past performance does not guarantee future results.
        This software is provided as-is. You are solely responsible for your trading decisions and any resulting gains or losses.
      </div>
    </div>
  );
}
