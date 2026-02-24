# Configuration Guide

All bot settings live in a single JSON file:

```
~/.config/hl-signalbot/config.json
```

This file is created by the setup wizard. You can edit it directly — the bot reads it on startup. Restart the bot after making changes.

A template with defaults is at `bot/config.example.json`.

---

## Wallet

```json
"wallet": {
  "address": "0x...",
  "privateKeyPath": "~/.config/hl-signalbot/private_key"
}
```

| Field | Description |
|-------|-------------|
| `address` | Your Hyperliquid wallet address (0x + 40 hex chars) |
| `privateKeyPath` | Path to your private key file. The setup wizard writes this automatically. You can also set `HL_PRIVATE_KEY` as an env variable instead. |

---

## Market

```json
"market": {
  "coin": "BTC"
}
```

| Field | Description |
|-------|-------------|
| `coin` | Trading pair. Currently only `BTC` (trades BTC-PERP). |

---

## Signal Engine

These control when the bot enters trades.

```json
"signal": {
  "pollMs": 20000,
  "timeframe": { "trend": "1h", "trigger": "15m" },
  "emaTrendPeriod": 50,
  "emaTriggerPeriod": 20,
  "atrPeriod": 14,
  "atrMult": 1.5,
  "maxStopPct": 0.035,
  "maxEmaDistPct": 0.02,
  "stochFilter": { "enabled": true, "overbought": 80, "oversold": 20 },
  "confirmCandles": 1
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `pollMs` | 20000 | How often the bot checks for signals (ms). 20s = 3 checks/min. |
| `timeframe.trend` | `"1h"` | Candle interval for the trend EMA (determines long/short bias). |
| `timeframe.trigger` | `"15m"` | Candle interval for the entry trigger EMA. |
| `emaTrendPeriod` | 50 | EMA period on the trend timeframe. Higher = smoother, slower to flip. |
| `emaTriggerPeriod` | 20 | EMA period on the trigger timeframe. Lower = more sensitive entries. |
| `atrPeriod` | 14 | ATR lookback period. Used for stop distance and entry confirmation. |
| `atrMult` | 1.5 | ATR multiplier for entry confirmation. Price must move > atrMult * ATR from the trigger EMA. |
| `maxStopPct` | 0.035 | Maximum stop distance as a fraction of entry price (3.5%). If ATR suggests a wider stop, it gets capped here. |

### Signal Filters

These filters help avoid late or exhausted entries.

| Field | Default | Description |
|-------|---------|-------------|
| `maxEmaDistPct` | 0.02 | Skip signals when price is more than this % from the 1h EMA50. Prevents entering extended moves. 0 = disabled. |
| `stochFilter.enabled` | true | Enable Stochastic RSI filter on 15m candles. |
| `stochFilter.overbought` | 80 | Skip long entries when Stoch RSI is above this (overbought). |
| `stochFilter.oversold` | 20 | Skip short entries when Stoch RSI is below this (oversold, bounce likely). |
| `confirmCandles` | 1 | Number of consecutive 15m candles on the wrong side of EMA20 before a reclaim counts. 2 = stricter, fewer fakeouts. |

---

## Risk Controls

These protect your account.

```json
"risk": {
  "maxLeverage": 10,
  "maxDailyLossUsd": 200,
  "cooldownSeconds": 10,
  "riskPerTradePct": 0.03,
  "marginUsePct": 0.75,
  "minHoldSeconds": 120,
  "reentryCooldownSeconds": 300,
  "lossCooldownMinutes": 15,
  "atrMinPct": 0.002
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `maxLeverage` | 10 | Maximum cross leverage the bot will use. |
| `maxDailyLossUsd` | 200 | Bot halts for the day if cumulative losses exceed this. |
| `cooldownSeconds` | 10 | Minimum seconds between any two actions. |
| `riskPerTradePct` | 0.03 | Fraction of equity risked per trade (3%). Determines position size. |
| `marginUsePct` | 0.75 | Max fraction of equity used as margin (75%). |
| `minHoldSeconds` | 120 | Minimum time to hold a position before the bot can exit (prevents whipsaws). |
| `reentryCooldownSeconds` | 300 | Wait time after any exit before entering a new trade (5 min). |
| `lossCooldownMinutes` | 15 | Extra cooldown after a losing trade. |
| `atrMinPct` | 0.002 | Minimum ATR as a fraction of price (0.2%). Filters out low-volatility entries. |

---

## Exits (TP / SL / Trailing)

This is where you control profit-taking and stop-loss behavior.

```json
"exits": {
  "stopLossPct": 0.10,
  "maxMarginLossPct": 0.03,
  "trailToBreakevenOnTp1": true,
  "trailStopToTp1OnTp2": true,
  "trailingAfterTp2": {
    "enabled": true,
    "kind": "pct",
    "trailPct": 0.005,
    "minUpdateSeconds": 20
  },
  "tp": [
    { "pct": 0.01, "closeFrac": 0.25 },
    { "pct": 0.02, "closeFrac": 0.25 }
  ],
  "runnerExit": "signal"
}
```

### Stop-Loss

| Field | Default | Description |
|-------|---------|-------------|
| `stopLossPct` | 0.10 | Hard stop-loss as a fraction of margin (10%). |
| `maxMarginLossPct` | 0.03 | Max margin loss before force-closing (3%). Acts as a safety net. |

### Take-Profit Levels

The `tp` array defines your take-profit ladder. Each level has:

| Field | Description |
|-------|-------------|
| `pct` | Distance from entry price as a percentage. `0.01` = 1%, `0.02` = 2%. |
| `closeFrac` | Fraction of the position to close at this level. `0.25` = 25%. |

**Default behavior:**
- TP1 at 1% from entry → close 25%
- TP2 at 2% from entry → close 25%
- Remaining 50% is the "runner" — exits on signal reversal or trailing stop

**Example: tighter TPs for scalping**

```json
"tp": [
  { "pct": 0.005, "closeFrac": 0.50 },
  { "pct": 0.01, "closeFrac": 0.50 }
]
```

This closes 50% at 0.5% profit and the rest at 1%.

**Example: wider TPs for swing trading**

```json
"tp": [
  { "pct": 0.03, "closeFrac": 0.25 },
  { "pct": 0.06, "closeFrac": 0.25 }
]
```

### Stop Movement

| Field | Default | Description |
|-------|---------|-------------|
| `trailToBreakevenOnTp1` | true | After TP1 hits, move SL to breakeven (entry price). |
| `trailStopToTp1OnTp2` | true | After TP2 hits, move SL up to the TP1 price. |

### Trailing Stop (after TP2)

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | true | Enable trailing stop on the runner after TP2 fills. |
| `kind` | `"pct"` | Trailing type. Only `"pct"` (percentage) is supported. |
| `trailPct` | 0.005 | Trail distance as a fraction of price (0.5%). |
| `minUpdateSeconds` | 20 | Minimum seconds between stop updates (prevents API spam). |

**Trailing tightness presets:**

| Preset | `trailPct` | Behavior |
|--------|-----------|----------|
| Tight | 0.0025 | 0.25% — captures more profit, may stop out on bounces |
| Medium | 0.005 | 0.50% — balanced (default) |
| Loose | 0.008 | 0.80% — more room to run, more giveback on reversals |

### Runner Exit

| Field | Default | Description |
|-------|---------|-------------|
| `runnerExit` | `"signal"` | How the remaining position exits after TPs. `"signal"` = exit on signal reversal. |

---

## Telegram

```json
"telegram": {
  "enabled": true,
  "channel": "@your_channel",
  "tokenPath": "~/.config/hl-signalbot/tg_token"
}
```

| Field | Description |
|-------|-------------|
| `enabled` | `true` to send Telegram pings on open/close. |
| `channel` | Your Telegram channel (@username or numeric chat ID). |
| `tokenPath` | Path to the file containing your bot token from @BotFather. |

You can also set these as env variables: `TG_ENABLED`, `TG_CHAT`, `TG_TOKEN` or `TG_TOKEN_PATH`.

---

## Execution

```json
"execution": {
  "orderType": "taker"
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `orderType` | `"taker"` | Order type for entries. `"taker"` = market order (immediate fill). |

---

## Quick Reference: Common Tweaks

**More conservative (smaller positions, tighter risk):**
```json
"risk": { "riskPerTradePct": 0.01, "maxLeverage": 5, "maxDailyLossUsd": 50 }
```

**More aggressive (larger positions, wider targets):**
```json
"risk": { "riskPerTradePct": 0.05, "maxLeverage": 15, "maxDailyLossUsd": 500 }
```

**Disable trailing stop (close everything at TP levels):**
```json
"exits": {
  "trailingAfterTp2": { "enabled": false },
  "tp": [
    { "pct": 0.01, "closeFrac": 0.50 },
    { "pct": 0.02, "closeFrac": 0.50 }
  ]
}
```

**Faster signal checking:**
```json
"signal": { "pollMs": 10000 }
```
