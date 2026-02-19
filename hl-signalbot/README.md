# hl-signalbot (Hyperliquid)

A small, opinionated Hyperliquid perp trading bot template.

- Places **native Hyperliquid trigger orders** for SL/TP (so they show up on-exchange)
- Avoids duplicate exit orders
- Optional Telegram trade pings (no LLM cost)
- Safety: closes position if it cannot confirm protection (SL/TP) after entry

> This is **not financial advice**. Use at your own risk.

## Quickstart

### 1) Install

```bash
cd hl-signalbot
npm install
```

### 2) Create config

```bash
cp config/config.example.json config/config.json
```

Edit `config/config.json`:
- set your wallet address
- point `wallet.privateKeyPath` to your local key file
- (optional) enable Telegram

### 3) Run (paper mode by default)

```bash
node index.mjs
```

To point to a different config file:

```bash
CONFIG=./config/config.json node index.mjs
```

State is stored in `storage/state.json`.

## Secrets

Do **not** commit secrets.

- Hyperliquid key: store locally (example)
  - `~/.config/hyperliquid/private_key` (chmod 600)
- Telegram bot token (optional)
  - `~/.config/hyperpings/bot_token` (chmod 600)

## Telegram (optional)

Set in config:
- `telegram.enabled: true`
- `telegram.channel: "@your_channel"`
- `telegram.tokenPath: "~/.config/hyperpings/bot_token"`

Your bot must be an admin of the channel.

## Notes

- If you manually set SL/TP on a position, the bot will detect existing exits and leave them alone.
- The bot uses an interval loop; overlapping loops are prevented to avoid duplicate entries.

## License

Add a LICENSE in the repo root (recommended: MIT).
