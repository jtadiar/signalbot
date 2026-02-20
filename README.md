# HL Signalbot

Desktop trading bot for Hyperliquid perpetuals. EMA/ATR signal engine with native TP/SL, trailing stops, risk guardrails, and Telegram notifications — all running locally on your machine. Your keys never leave your device.

## Quick Start

### 1. Install prerequisites

**All platforms:** [Node.js](https://nodejs.org/) >= 18 (LTS recommended)

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

### 2. Clone, install, and launch

```bash
git clone https://github.com/jtadiar/signalbot.git
cd signalbot
npm install
cd bot && npm install && cd ..
npx tauri dev
```

That's it. The app opens and walks you through setup — wallet, private key, funding, Telegram, and risk settings.

### 3. Build a distributable installer

```bash
npx tauri build
```

- macOS: `src-tauri/target/release/bundle/dmg/HL Signalbot.dmg`
- Windows: `src-tauri/target/release/bundle/msi/HL Signalbot.msi`

## CLI Mode (no desktop app)

If you prefer the terminal, the setup wizard has a degen-styled interactive flow:

```bash
node ./bot/cli.mjs setup
```

Then start the bot:

```bash
node ./bot/cli.mjs --config ./bot/config.json
```

Use `--no-banner` to skip the ASCII art header.

## How It Works

1. **Setup wizard** — wallet address, private key (stored locally, owner-only permissions), Hyperliquid funding check, Telegram pings, risk parameters
2. **Dashboard** — start/stop/restart bot, live equity, current position with margin and fees, daily PnL, health heartbeat
3. **Trade log** — history of all opens and closes with PnL, win/loss tracking
4. **Settings** — configure TP distances (%), trailing stop tightness, Telegram credentials

## Strategy

- **Trend filter**: 50-period EMA on 1h candles determines bias (long/short)
- **Trigger**: 20-period EMA crossover on 15m candles with ATR confirmation
- **Entry**: taker market order with ATR-based stop distance
- **Take-profit**: 2 configurable TP levels (default 1% and 2% from entry), each closing 25% of the position
- **Trailing stop**: after TP2, SL moves to TP1 price and trails by a configurable percentage
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
- Secrets stored in `~/.config/hl-signalbot/` (macOS/Linux) or `%APPDATA%/hl-signalbot/` (Windows)
- Graceful shutdown (SIGTERM) ensures clean position state on stop

## Architecture

```
signalbot/
├── bot/                  # Node.js trading engine
│   ├── index.mjs         # Main trading loop
│   ├── signal_engine.mjs # EMA/ATR signal computation
│   ├── hl_info.mjs       # Hyperliquid API helpers
│   ├── cli.mjs           # CLI entry point
│   ├── setup.mjs         # Interactive setup wizard
│   └── ui.mjs            # Terminal styling (banner, colors, spinners)
├── src/                  # React frontend (Vite)
│   ├── pages/            # Setup, Dashboard, TradeLog, Settings
│   ├── lib/              # Bot IPC + config helpers
│   └── styles.css
├── src-tauri/            # Tauri (Rust) desktop shell
├── .github/workflows/    # CI builds for macOS + Windows
└── package.json
```

## CI / Automated Builds

Push a version tag to trigger automated builds:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions builds for macOS (arm64 + x64) and Windows (x64), then creates a GitHub Release with installers attached.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `cargo not found` | Run `source "$HOME/.cargo/env"` or restart terminal |
| `xcrun: error` (macOS) | Run `xcode-select --install` |
| `link.exe not found` (Windows) | Install VS Build Tools with C++ workload |
| `WebView2 not found` (Windows 10) | Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| `Port 5173 in use` | Kill the process: `lsof -ti:5173 \| xargs kill -9` |
| `Node.js not found` (in app) | Install Node.js LTS from nodejs.org and restart |

## License

MIT
