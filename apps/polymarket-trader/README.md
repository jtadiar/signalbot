# polymarket-trader

Local Polymarket trading worker (API-first). Uses a dedicated low-balance wallet.

## Secrets
Stored outside repo:
- `~/.config/polymarket/trader.env`

## Run
```bash
cd apps/polymarket-trader

# Directional BTC15 worker (existing)
node src/btc15_worker.js

# NEW: Non-directional pair-arb worker (experimental)
node src/btc15_pairarb_worker.js
```

## Pair-arb sizing (per window)
Configure in `~/.config/polymarket/trader.env`:
- `PAIRARB_WINDOW_BUDGET_USDC` (default 10)
- `PAIRARB_SLICE_USDC` (default 2.5)
- `PAIRARB_TARGET_PAIR_COST` (default 0.985)
- `PAIRARB_MAX_ENTRY_PRICE` (default uses `MAX_ENTRY_PRICE`)
