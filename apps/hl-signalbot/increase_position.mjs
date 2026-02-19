import fs from 'fs';
import { Hyperliquid } from 'hyperliquid';

const cfg = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url).pathname, 'utf8'));
const pk = fs.readFileSync(cfg.wallet.privateKeyPath, 'utf8').trim();

const sdk = new Hyperliquid({
  privateKey: pk,
  enableWs: false,
  testnet: false,
  walletAddress: cfg.wallet.address,
  disableAssetMapRefresh: true,
});

async function allMids(){
  const res = await fetch('https://api-ui.hyperliquid.xyz/info', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ type:'allMids' }) });
  return await res.json();
}

async function main(){
  const addMargin = Number(process.env.ADD_MARGIN_USD || '73');
  const lev = Number(process.env.LEV || '15');
  const addNotional = addMargin * lev;

  const mids = await allMids();
  const px = Number(mids.BTC || mids['BTC-PERP']);
  if (!px) throw new Error('no mid');

  const ch = await sdk.info.perpetuals.getClearinghouseState(cfg.wallet.address, true);
  const pos = (ch?.assetPositions||[]).map(p=>p.position).find(p=>p.coin===cfg.market.coin);
  const szi = Number(pos?.szi||0);
  if (!szi) throw new Error('no open BTC position');

  const side = szi > 0 ? 'long' : 'short';
  const isBuy = side === 'long';

  let addSz = addNotional / px;
  addSz = Number(addSz.toFixed(5));

  await sdk.exchange.updateLeverage('BTC-PERP', 'cross', lev);
  const slippage = 0.001;
  const resp = await sdk.custom.marketOpen('BTC-PERP', isBuy, addSz, px, slippage);

  console.log(JSON.stringify({ ok:true, side, addMargin, lev, px, addNotional, addSz, resp }, null, 2));
}

main().catch(e=>{ console.error('ERR', e?.message||e); process.exit(1); });
