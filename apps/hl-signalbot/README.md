# HL Signalbot (OpenClaw + Hyperliquid)

A single-purpose, OpenClaw-friendly Hyperliquid perp signal-trading bot.

It:
- polls market data (Hyperliquid info API)
- computes a deterministic signal (EMA trend/trigger + ATR stop sizing)
- opens/closes a Hyperliquid perp position (default: `BTC-PERP`)
- places **native** Hyperliquid TP/SL trigger orders (so they appear in the HL UI)
- optionally sends **Telegram pings** (OPEN / TP-CLOSE / STOP-LOSS)

> ⚠️ Trades live money. Start small. Use a dedicated wallet with limited funds.

---

## Who this is for

- You want a bot you can run inside your own **OpenClaw workspace** (or just on any machine with Node.js).
- You want a bot with **transparent logic** (no LLMs required).

---

## Prerequisites

- **Node.js 18+** (recommended: latest LTS)
- `git`
- A **Hyperliquid** wallet + private key
- (Optional) A **Telegram bot token** if you want channel pings

---

## Install (clone + dependencies)

### Option A — run inside your OpenClaw workspace (recommended)

```bash
cd ~/.openclaw/workspace

git clone -b signalbot-only https://github.com/jtadiar/signalbot.git
cd signalbot/apps/hl-signalbot
npm ci
```

### Option B — run anywhere (normal Node project)

```bash
git clone -b signalbot-only https://github.com/jtadiar/signalbot.git
cd signalbot/apps/hl-signalbot
npm ci
```

---

## Configure (wallet + private key)

This bot is designed so users do **not** need to edit tracked files for secrets.

### 1) Create your `.env`

```bash
cd apps/hl-signalbot
cp .env.example .env
```

### 2) Add your wallet address

In `.env`:

```bash
HL_WALLET_ADDRESS=0xYOUR_WALLET
```

### 3) Add your private key (recommended: file path)

**Recommended**: store the key in a local file and point the bot to it.

1) Create a key file (example path):

```bash
mkdir -p ~/.config/hyperliquid
$EDITOR ~/.config/hyperliquid/private_key
chmod 600 ~/.config/hyperliquid/private_key
```

2) In `.env`:

```bash
HL_PRIVATE_KEY_PATH=~/.config/hyperliquid/private_key
```

**Alternative** (works, but less safe):

```bash
HL_PRIVATE_KEY=YOUR_PRIVATE_KEY_HEX
```

### Secret precedence

The bot loads the private key in this order:
1. `HL_PRIVATE_KEY`
2. `HL_PRIVATE_KEY_PATH`
3. `wallet.privateKeyPath` inside `config.json`

---

## Configure strategy (risk / TP / SL)

Default config is in `config.json`. Most users only need to tune:

- `risk.maxLeverage`
- `risk.maxDailyLossUsd`
- `risk.lossCooldownMinutes`
- `risk.reentryCooldownSeconds`
- `signal.*` (EMA/ATR parameters)
- `exits.tp` (TP ladder)

Edit:

```bash
$EDITOR config.json
```

> Tip: if you want multiple configs, copy it (e.g. `config.local.json`) and run with `--config`.

---

## Telegram pings (step-by-step)

You have two choices:
- **Public channel** (easiest): use `@channelusername`
- **Private channel**: use the numeric `chat_id` (starts with `-100...`)

### 1) Create a Telegram bot (BotFather)

1. Open Telegram and chat with **@BotFather**
2. Run: `/newbot`
3. Follow prompts → you’ll receive a token like:
   `123456789:AA...`

### 2) Create a channel and add the bot

1. Create a Telegram **channel**
2. Add your bot to the channel
3. Promote it to **Admin** (needs permission to post)

### 3) Set the Telegram env vars

In your `.env`:

```bash
TG_ENABLED=true
TG_CHAT=@your_channel_username
TG_TOKEN=123456789:AA...
```

**More secure**: store the token in a file:

```bash
mkdir -p ~/.config/hyperpings
$EDITOR ~/.config/hyperpings/bot_token
chmod 600 ~/.config/hyperpings/bot_token
```

Then in `.env`:

```bash
TG_ENABLED=true
TG_CHAT=@your_channel_username
TG_TOKEN_PATH=~/.config/hyperpings/bot_token
```

### Private channel `chat_id` (if you don’t have a @username)

If your channel is private, you usually need a numeric `chat_id`.
Common approaches:
- temporarily make the channel public to get a username, then switch back, **or**
- use a helper like `@RawDataBot` / `@getmyid_bot` (third-party) to read the chat id, **or**
- write a small script to call Telegram’s `getUpdates` once the bot has received a message.

Once you have it:

```bash
TG_CHAT=-1001234567890
```

### What gets pinged

When enabled, the bot sends messages like:
- `HL SIGNALBOT OPEN | ...`
- `HL SIGNALBOT TP/CLOSE | ... | Net 1.67 USDC | ...`
- `HL SIGNALBOT STOP/LOSS | ...`

---

## Run

### Start (recommended)

```bash
npm start
```

### Run with an explicit config path

```bash
node ./cli.mjs --config ./config.json
```

### Help

```bash
node ./cli.mjs --help
```

---

## Running as a service (optional)

If you want it always-on, run it under a process manager:
- `tmux`
- `systemd` (Linux)
- `launchd` (macOS)

---

## Security checklist

- Never commit `.env`, private keys, or bot tokens.
- Prefer `*_PATH` vars + `chmod 600` on secret files.
- Use a dedicated trading wallet with limited funds.
- Keep `maxDailyLossUsd` conservative.
- Don’t run multiple instances against the same wallet.

---

## Troubleshooting

- **Bot does nothing:** check Node version, confirm `.env` values, and verify you can reach `https://api-ui.hyperliquid.xyz/info`.
- **Telegram silent:** confirm `TG_ENABLED=true`, the bot is admin in the channel, and `TG_CHAT` is correct.
- **Weird duplicate behavior:** ensure only one instance is running.
