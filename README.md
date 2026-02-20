# HL Signalbot

Desktop trading bot for Hyperliquid perpetuals. EMA/ATR signal engine with native TP/SL, trailing stops, risk guardrails, and Telegram notifications — all running locally on your machine. Your keys never leave your device.

**Website:** [hlsignalbot.netlify.app](https://hlsignalbot.netlify.app)

## Download (Non-Developers)

1. Get a free beta key at [hlsignalbot.netlify.app](https://hlsignalbot.netlify.app)
2. Install [Node.js](https://nodejs.org/) (LTS, free)
3. Download the installer for your OS from the success page
4. **macOS:** open Terminal and run `xattr -cr /Applications/HL\ Signalbot.app` (unsigned app workaround)
5. Open the app, paste your license key, and complete the setup wizard

No GitHub, no terminal, no Rust required.

## Build from Source (Developers)

### Prerequisites

**All platforms:** [Node.js](https://nodejs.org/) >= 18 (LTS)

<details>
<summary><strong>macOS</strong></summary>

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```
</details>

<details>
<summary><strong>Windows</strong></summary>

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — select "C++ build tools" workload
2. Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11)
3. Install Rust: download and run [rustup-init.exe](https://win.rustup.rs/), then restart your terminal
</details>

### Clone, install, and launch

```bash
git clone https://github.com/jtadiar/signalbot.git
cd signalbot
npm install
cd bot && npm install && cd ..
npx tauri dev
```

The app opens and walks you through setup — wallet, private key, funding, Telegram, and risk settings.

### Build a distributable installer

```bash
npx tauri build --bundles dmg    # macOS
npx tauri build --bundles nsis   # Windows
```

## CLI Mode (no desktop app)

If you prefer the terminal and don't need the desktop UI, you only need Node.js:

```bash
git clone https://github.com/jtadiar/signalbot.git
cd signalbot/bot
npm install
node cli.mjs setup
```

The setup wizard walks you through configuration with a styled terminal aesthetic. Then start:

```bash
node cli.mjs
```

No Rust, no Tauri, no desktop app required. Use `--no-banner` to skip the ASCII art header.

See [`bot/CONFIGURATION.md`](bot/CONFIGURATION.md) for a full guide to every setting.

## How It Works

1. **License activation** — enter your key from [hlsignalbot.netlify.app](https://hlsignalbot.netlify.app)
2. **Setup wizard** — wallet address, private key (stored locally), Hyperliquid funding check, Telegram, risk parameters
3. **Dashboard** — start/stop bot, live equity, current position with margin and fees, daily PnL, health heartbeat
4. **Trade log** — history of all opens and closes with PnL
5. **Settings** — TP distances (%), trailing stop, Telegram credentials

## Strategy

- **Trend filter**: 50-period EMA on 1h candles determines bias (long/short)
- **Trigger**: 20-period EMA crossover on 15m candles with ATR confirmation
- **Entry**: taker market order with ATR-based stop distance
- **Take-profit**: 2 configurable TP levels (default 1% and 2%), each closing 25% of position
- **Trailing stop**: after TP2, SL moves to TP1 price and trails by configurable percentage
- **Runner**: remaining ~50% exits on signal reversal or trailing stop hit
- **Stop-loss**: ATR-based, capped by `maxStopPct` and `maxMarginLossPct`

## Risk Controls

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxLeverage` | 10x | Max cross leverage |
| `maxDailyLossUsd` | $200 | Bot halts if daily loss exceeds this |
| `riskPerTradePct` | 3% | Equity risked per trade |
| `marginUsePct` | 75% | Fraction of equity used as margin |
| `lossCooldownMinutes` | 15 | Pause after a losing trade |
| `reentryCooldownSeconds` | 300 | Minimum gap between trades |

## Security

- Private keys stored locally with restrictive file permissions (600)
- Keys are never logged, transmitted, or committed to git
- All trades execute directly via Hyperliquid API from your device
- Data stored in `~/.config/hl-signalbot/` (persists across reinstalls)
- Graceful shutdown ensures clean position state on stop

## Architecture

```
signalbot/
├── bot/                  # Node.js trading engine
│   ├── index.mjs         # Main trading loop
│   ├── signal_engine.mjs # EMA/ATR signal computation
│   ├── hl_info.mjs       # Hyperliquid API helpers
│   ├── cli.mjs           # CLI entry point
│   ├── setup.mjs         # Interactive setup wizard
│   ├── close.mjs         # Manual position close
│   └── ui.mjs            # Terminal styling
├── src/                  # React frontend (Vite)
│   └── pages/            # License, Setup, Dashboard, TradeLog, Settings
├── src-tauri/            # Tauri (Rust) desktop shell
├── web/                  # Landing page (Next.js on Netlify)
├── .github/workflows/    # CI builds for macOS + Windows
└── package.json
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `"HL Signalbot" is damaged` (macOS) | Run `xattr -cr /Applications/HL\ Signalbot.app` |
| `Apple could not verify` (macOS) | System Settings > Privacy & Security > Open Anyway |
| `Node.js not found` (in app) | Install Node.js LTS from nodejs.org and restart the app |
| `cargo not found` | Run `source "$HOME/.cargo/env"` or restart terminal |
| `Port 5173 in use` | Kill: `lsof -ti:5173 \| xargs kill -9` |

## License

MIT
