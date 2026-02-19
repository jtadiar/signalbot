# HL Signalbot (for OpenClaw + Hyperliquid)

A single-purpose, OpenClaw-friendly Hyperliquid perp signal-trading bot that:
- polls market data,
- computes a simple EMA/ATR-based signal,
- opens/closes BTC-PERP positions on Hyperliquid,
- places native TP/SL triggers on Hyperliquid, and
- optionally pings a Telegram channel on opens/closes.

This is intended to be run **inside an OpenClaw workspace**, but it is a normal Node.js CLI tool.

> Security note: this bot trades live money. Use small size first, and prefer testnet / paper checks before trusting it.

---

## Quick start

### 1) Clone into your OpenClaw workspace

Typical OpenClaw workspace path:

```bash
cd ~/.openclaw/workspace
# put this repo content in your workspace (fork/clone however you manage your OpenClaw repo)
```

### 2) Install deps (inside the bot folder)

```bash
cd apps/hl-signalbot
npm ci
```

### 3) Configure secrets (recommended via .env)

```bash
cp .env.example .env
$EDITOR .env
```

You can provide the private key either as:
- `HL_PRIVATE_KEY` (direct string), **or**
- `HL_PRIVATE_KEY_PATH` (path to a file containing the key)

Recommended:
- store keys in a file under `~/.config/...` with strict permissions:

```bash
chmod 600 ~/.config/hyperliquid/private_key
```

### 4) Configure strategy settings

Edit `config.json` (or make your own copy and point `CONFIG=/path/to/your.json`).

Key fields:
- `market.coin` (default `BTC`)
- `risk.maxLeverage`
- `risk.lossCooldownMinutes`
- `risk.reentryCooldownSeconds`
- `signal.*` (EMA/ATR settings)
- `exits.tp` and `exits.*` (TP/SL plan)

### 5) Run

```bash
cd apps/hl-signalbot
npm start
```

Or directly:

```bash
node ./cli.mjs --config ./config.json
```

---

## Telegram pings

If enabled, the bot will send messages like:
- `HL SIGNALBOT OPEN | ...`
- `HL SIGNALBOT TP/CLOSE | ...`
- `HL SIGNALBOT STOP/LOSS | ...`

You can configure Telegram either in `config.json` (tokenPath + channel) or via env:
- `TG_TOKEN` or `TG_TOKEN_PATH`
- `TG_CHAT`

---

## Running under OpenClaw

OpenClaw can run long-lived processes in several ways depending on your setup. The simplest is to run the bot on the same machine as your OpenClaw gateway/workspace:

```bash
cd ~/.openclaw/workspace/apps/hl-signalbot
npm start
```

If you want this to be a persistent service, run it under your process manager of choice (tmux, systemd, launchd, etc.) on the OpenClaw host.

---

## Security checklist

- Never commit `.env`, private keys, bot tokens, or `state.json`.
- Prefer `HL_PRIVATE_KEY_PATH` pointing to a `chmod 600` file.
- Consider using a dedicated trading wallet with limited funds.
- Keep `maxDailyLossUsd` conservative.
- Start with smaller leverage/size and gradually increase.

---

## Troubleshooting

- If nothing happens: check `pollMs`, verify the bot can reach `https://api-ui.hyperliquid.xyz/info`.
- If Telegram is silent: verify `TG_CHAT` and token, and that the bot has permission to post.
- If you see repeated identical pings: ensure you’re only running one instance; the bot de-dupes identical messages for 2 minutes, but double-running can still cause odd behavior.

---

## License

Add a license if you intend to distribute publicly.
