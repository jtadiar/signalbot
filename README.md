# HL Signalbot

Desktop trading bot for Hyperliquid perpetuals. EMA/ATR signal engine with native TP/SL, risk guardrails, and Telegram notifications — all running locally on your machine.

## Architecture

```
signalbot/
├── bot/                  # Node.js trading engine
│   ├── index.mjs         # Main trading loop
│   ├── signal_engine.mjs # EMA/ATR signal computation
│   ├── hl_info.mjs       # Hyperliquid API helpers
│   ├── cli.mjs           # CLI entry point
│   └── setup.mjs         # Interactive CLI setup wizard
├── src/                  # React frontend (Vite)
│   ├── pages/            # License, Setup, Dashboard, TradeLog, Settings
│   ├── lib/              # Bot IPC + config helpers
│   └── styles.css
├── src-tauri/            # Tauri (Rust) desktop shell
├── .github/workflows/    # CI builds for macOS + Windows
└── package.json
```

## Quick Start (Desktop App)

### Prerequisites

**All platforms:**
- [Node.js](https://nodejs.org/) >= 18 (LTS recommended)

**macOS:**
```bash
# Install Xcode Command Line Tools (required for Rust compilation)
xcode-select --install

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

**Windows:**
1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — select "C++ build tools" workload
2. Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11)
3. Install Rust:
   - Download and run [rustup-init.exe](https://win.rustup.rs/)
   - Restart your terminal after installation

### Install & Run

```bash
git clone https://github.com/jtadiar/signalbot.git
cd signalbot

# Install dependencies
npm install
cd bot && npm install && cd ..

# Launch the desktop app (dev mode)
npx tauri dev
```

### Build Installer

```bash
npx tauri build
```

**Output:**
- macOS: `src-tauri/target/release/bundle/dmg/HL Signalbot.dmg`
- Windows: `src-tauri/target/release/bundle/msi/HL Signalbot.msi`

### Troubleshooting

| Error | Fix |
|-------|-----|
| `cargo not found` | Run `source "$HOME/.cargo/env"` or restart terminal |
| `xcrun: error` (macOS) | Run `xcode-select --install` |
| `link.exe not found` (Windows) | Install VS Build Tools with C++ workload |
| `WebView2 not found` (Windows 10) | Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| `Port 5173 in use` | Kill the process: `lsof -ti:5173 \| xargs kill -9` |
| `Node.js not found` (in app) | Install Node.js LTS from nodejs.org and restart |

## CI / Automated Builds

Push a version tag to trigger automated builds:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build for macOS (arm64 + x64) and Windows (x64), then create a GitHub Release with the installers attached.

## CLI Mode (Developers)

Run the bot directly without the desktop app:

```bash
cd bot
npm install
cp config.example.json config.json   # edit with your settings
cp .env.example .env                 # add secrets
npm start
```

Or use the interactive setup wizard:

```bash
cd bot
npm run setup
```

## How It Works

1. **License activation** — enter your key on first launch
2. **Node.js check** — the app verifies Node.js is installed before proceeding
3. **Setup wizard** — wallet address, private key (stored locally with restricted permissions), funding check, Telegram, risk params
4. **Dashboard** — start/stop/restart bot, view position, PnL, signals, health heartbeat, and live logs
5. **Trade log** — scrollable history of all opens and closes with PnL
6. **Settings** — tune signal parameters, risk controls, and TP/SL

## Strategy

- **Trend filter**: 50-period EMA on 1h candles determines bias (long/short)
- **Trigger**: 20-period EMA crossover on 15m candles with ATR confirmation
- **Entry**: taker market order with ATR-based stop distance
- **Take-profit ladder**: 3 staged TPs at 1R, 2R, 3R closing 25% each
- **Runner**: final 25% exits on signal reversal or trailing stop
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

- Private keys are stored locally with restrictive file permissions (600 on Unix)
- Keys are never logged, transmitted, or committed to git
- All trades execute directly via Hyperliquid API from your device
- Config files stored in `~/.config/hl-signalbot/` (macOS/Linux) or `%APPDATA%/hl-signalbot/` (Windows)
- `.env` files get restrictive permissions automatically
- Graceful shutdown (SIGTERM) ensures clean position state on stop

## License

MIT
