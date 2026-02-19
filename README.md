# Signalbot (OpenClaw + Hyperliquid)

This repo contains a single OpenClaw-friendly trading bot for Hyperliquid.

- Bot code + docs live in: `apps/hl-signalbot/`
- Start here: `apps/hl-signalbot/README.md`
- Product Requirements Document (PRD): `apps/hl-signalbot/PRD.md`

## Quick start

```bash
cd apps/hl-signalbot
npm ci
cp .env.example .env
# edit .env with your wallet/private key + optional telegram
npm start
```

> Security: never commit your `.env` or private key.
