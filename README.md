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
│   ├── setup.mjs         # Interactive CLI setup wizard
│   └── config.example.json
├── src/                  # React frontend (Vite)
│   ├── pages/            # License, Setup, Dashboard, TradeLog, Settings
│   ├── lib/              # Bot IPC + config helpers
│   └── styles.css
├── src-tauri/            # Tauri (Rust) desktop shell
└── package.json
```

## Quick Start (Desktop App)

### Prerequisites

1. **Node.js** >= 18 — [download here](https://nodejs.org/)
2. **Rust** — install with one command:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```

### Install & Run

```bash
git clone https://github.com/jtadiar/signalbot.git
cd signalbot

# Install dependencies
npm install
cd bot && npm install && cd ..

# Launch the desktop app
npx tauri dev
```

### Build Installer

```bash
npx tauri build
```

This produces a `.dmg` (macOS) or `.msi` (Windows) in `src-tauri/target/release/bundle/`.

## CLI Mode (Developers)

You can run the bot directly without the desktop app:

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
2. **Setup wizard** — wallet address, private key (stored locally), funding check, Telegram, risk params
3. **Dashboard** — start/stop bot, view position, PnL, signals, and live logs
4. **Trade log** — scrollable history of all opens and closes with PnL
5. **Settings** — tune signal parameters, risk controls, and TP/SL without editing JSON

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

- Private keys are stored locally on your machine (never uploaded)
- All trades execute directly via Hyperliquid API from your device
- No server-side custody of keys or tokens

## License

MIT
