# HL Signalbot

> Automated Hyperliquid BTC-PERP signal trading bot with EMA/ATR strategy, native TP/SL orders, and Telegram notifications.

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

**HL Signalbot** is a single-purpose trading bot that runs locally on your machine. It monitors BTC-PERP on [Hyperliquid](https://hyperliquid.xyz), enters positions based on a deterministic EMA/ATR signal, places native take-profit and stop-loss trigger orders, and optionally pings a Telegram channel on every trade event.

Your private key stays on your device. The bot never uploads secrets anywhere.

---

## How the Strategy Works

The signal engine uses two timeframes and three indicators:

| Indicator | Timeframe | Purpose |
|-----------|-----------|---------|
| EMA 50 | 1h | Trend filter -- is price above (bullish) or below (bearish)? |
| EMA 20 | 15m | Trigger -- detects pullback-then-reclaim pattern |
| ATR 14 | 15m | Volatility -- sizes the stop-loss dynamically |

**Entry logic:**
1. **Trend:** Price is above the 1h EMA 50 (long bias) or below it (short bias).
2. **Trigger:** The previous 15m candle closed on the wrong side of the 15m EMA 20, and the current candle reclaims it.
3. **Stop sizing:** Stop distance = ATR x multiplier (default 1.5), capped at `maxStopPct`.

**Exit logic:**
- **Take-profit ladder:** Three R-multiple targets (1R, 2R, 3R), each closing 25% of the position.
- **Breakeven trail:** After TP1 is hit, the stop-loss moves to breakeven.
- **Stop-loss:** ATR-sized, placed as a native Hyperliquid trigger order.
- **Runner exit:** Optionally closes on an opposite signal.

All TP/SL orders are placed as **native Hyperliquid trigger orders** so they appear in the Hyperliquid UI and execute even if the bot goes offline.

---

## Quick Start

```bash
git clone https://github.com/jtadiar/signalbot.git hl-signalbot
cd hl-signalbot
npm ci
npm run setup
npm start
```

The `setup` command walks you through wallet, private key, Telegram, and risk configuration interactively.

---

## Manual Configuration

If you prefer to configure manually instead of using the setup wizard:

### 1. Create `.env`

```bash
cp .env.example .env
```

Edit `.env`:

```bash
HL_WALLET_ADDRESS=0xYOUR_WALLET_ADDRESS
HL_PRIVATE_KEY_PATH=~/.config/hl-signalbot/private_key
# or: HL_PRIVATE_KEY=your_hex_key

TG_ENABLED=true
TG_CHAT=@your_channel
TG_TOKEN_PATH=~/.config/hl-signalbot/tg_token
# or: TG_TOKEN=123456:ABCDEF
```

### 2. Create `config.json`

```bash
cp config.example.json config.json
```

Edit `config.json` to set your wallet address and tune parameters.

### 3. Store secrets securely

```bash
mkdir -p ~/.config/hl-signalbot
echo "YOUR_PRIVATE_KEY_HEX" > ~/.config/hl-signalbot/private_key
chmod 600 ~/.config/hl-signalbot/private_key
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HL_WALLET_ADDRESS` | Yes | Your Hyperliquid wallet address (0x...) |
| `HL_PRIVATE_KEY` | One of these | Private key as hex string |
| `HL_PRIVATE_KEY_PATH` | One of these | Path to file containing private key |
| `TG_ENABLED` | No | Enable Telegram pings (`true`/`false`) |
| `TG_CHAT` | No | Telegram chat ID or `@channel` username |
| `TG_TOKEN` | No | Telegram bot token |
| `TG_TOKEN_PATH` | No | Path to file containing Telegram bot token |
| `CONFIG` | No | Override path to config.json |
| `TRADE_LOG` | No | Override path for trade event JSONL log (default: `./trades.jsonl`) |

---

## Config Reference

All fields in `config.json` / `config.example.json`:

### `market`

| Field | Default | Description |
|-------|---------|-------------|
| `coin` | `"BTC"` | Trading pair (used as `{coin}-PERP`) |

### `signal`

| Field | Default | Description |
|-------|---------|-------------|
| `pollMs` | `20000` | Main loop interval in milliseconds |
| `emaTrendPeriod` | `50` | EMA period for 1h trend filter |
| `emaTriggerPeriod` | `20` | EMA period for 15m entry trigger |
| `atrPeriod` | `14` | ATR lookback period (15m) |
| `atrMult` | `1.5` | ATR multiplier for stop distance |
| `maxStopPct` | `0.035` | Maximum stop distance as a fraction of price |

### `risk`

| Field | Default | Description |
|-------|---------|-------------|
| `maxLeverage` | `10` | Maximum leverage (cross margin) |
| `maxDailyLossUsd` | `200` | Halt trading if daily PnL drops below this |
| `riskPerTradePct` | `0.03` | Fraction of equity risked per trade |
| `marginUsePct` | `0.75` | Fraction of equity used as margin (if set, overrides risk-based sizing) |
| `cooldownSeconds` | `10` | Minimum seconds between loop iterations |
| `minHoldSeconds` | `120` | Minimum hold time before exit |
| `reentryCooldownSeconds` | `300` | Cooldown after any exit before re-entering |
| `lossCooldownMinutes` | `15` | Cooldown after a losing trade |
| `atrMinPct` | `0.002` | Minimum ATR as fraction of price to generate a signal |

### `exits`

| Field | Default | Description |
|-------|---------|-------------|
| `stopLossPct` | `0.10` | Hard stop-loss cap as fraction of entry |
| `maxMarginLossPct` | `0.03` | Max loss as fraction of margin used |
| `trailToBreakevenOnTp1` | `true` | Move stop to breakeven after TP1 hit |
| `trailStopToTp1OnTp2` | `true` | After TP2 hit, move stop to the TP1 price (locks profit on the runner) |
| `trailingAfterTp2` | enabled | After TP2, start trailing the stop for the remaining runner |
| `tp` | 2-level ladder | Array of `{rMultiple, closeFrac}` objects (e.g. TP1 closes 25%, TP2 closes 25%, leaving ~50% runner) |
| `tpMinUsd` | `[10, 25, 60]` | Minimum USD profit per TP level (extra entries are ignored if you only have 2 TPs) |
| `runnerCloseFrac` | `0.25` | Fraction of position for runner exit (if using runner exit mode) |
| `runnerExit` | `"signal"` | Exit method for remaining position (`"signal"` or `null`) |

### `display`

| Field | Default | Description |
|-------|---------|-------------|
| `timezone` | `"UTC"` | IANA timezone for timestamp formatting in Telegram pings |

### `telegram`

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `false` | Enable/disable Telegram notifications |
| `channel` | `"@your_channel"` | Chat ID or @channel username |
| `tokenPath` | | Path to file containing bot token |

---

## Telegram Setup

1. **Create a bot:** Open Telegram, chat with [@BotFather](https://t.me/BotFather), run `/newbot`, and save the token.
2. **Create a channel:** Create a Telegram channel and add your bot as an admin with posting permissions.
3. **Configure:** Run `npm run setup` or manually set `TG_ENABLED=true`, `TG_CHAT`, and `TG_TOKEN` / `TG_TOKEN_PATH` in `.env`.

The bot sends messages for:
- **OPEN** -- entry side, size, price, stop-loss, take-profit levels
- **TP/CLOSE** -- partial or full close with net PnL
- **STOP/LOSS** -- stop-loss hit with net PnL

For private channels without a @username, use the numeric chat ID (starts with `-100`). You can get it via [@RawDataBot](https://t.me/RawDataBot) or similar.

---

## Funding Your Hyperliquid Account

The bot trades perpetual futures and needs USDC margin on Hyperliquid.

1. **Use the same wallet** that the bot is configured with.
2. **Get USDC** on Arbitrum (Hyperliquid's settlement chain).
3. **Deposit to Hyperliquid** via the [Hyperliquid bridge](https://app.hyperliquid.xyz/portfolio) or directly from Arbitrum.
4. **Transfer to trading** -- ensure USDC is in your perps/trading account (not just spot).
5. **Verify** -- your USDC balance should appear when you run `npm run setup` or start the bot.

The bot will not trade if your USDC balance is zero.

---

## Risk Controls

These guardrails are enabled by default:

| Control | What it does |
|---------|-------------|
| **Daily loss halt** | Stops trading and closes all positions if daily PnL exceeds `maxDailyLossUsd` |
| **Mandatory TP/SL** | Closes the position immediately if native TP/SL orders cannot be placed |
| **Leverage cap** | Position size is capped by `maxLeverage` |
| **Loss cooldown** | Pauses for `lossCooldownMinutes` after a losing trade |
| **Reentry cooldown** | Pauses for `reentryCooldownSeconds` after any exit |
| **Error backoff** | Exponential backoff (5s to 120s) on consecutive errors |
| **Process lock** | Prevents overlapping main loops (no double entries) |

---

## Running as a Service

For always-on operation:

**tmux / screen:**
```bash
tmux new -s signalbot
npm start
# Ctrl+B then D to detach
```

**systemd (Linux):**
```ini
[Unit]
Description=HL Signalbot
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/hl-signalbot
ExecStart=/usr/bin/node cli.mjs --config ./config.json
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**launchd (macOS):** Create a plist in `~/Library/LaunchAgents/` pointing to the node binary and script.

---

## Security Checklist

- Never commit `.env`, private keys, or bot tokens (they are in `.gitignore`).
- Prefer `*_PATH` variables and `chmod 600` on secret files.
- Use a dedicated trading wallet with limited funds.
- Keep `maxDailyLossUsd` conservative.
- Do not run multiple bot instances against the same wallet.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot does nothing | Check Node.js >= 18, verify `.env` values, test `curl -X POST https://api-ui.hyperliquid.xyz/info -H 'content-type: application/json' -d '{"type":"allMids"}'` |
| Telegram silent | Confirm `TG_ENABLED=true`, bot is admin in channel, `TG_CHAT` is correct |
| Duplicate trades | Ensure only one instance is running |
| `HALT` in logs | Daily loss limit hit. Reset by deleting `state.json` (the bot will resume next day) |
| No USDC balance | Fund your Hyperliquid account -- see "Funding Your Hyperliquid Account" above |

---

## License

[MIT](LICENSE)
