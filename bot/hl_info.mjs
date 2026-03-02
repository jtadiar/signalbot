import https from 'https';

const HL_TIMEOUT_MS = 15_000;

function postJson(url, body){
  return new Promise((resolve, reject)=>{
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname,
      headers: {
        'content-type': 'application/json',
        'content-length': data.length,
      },
      timeout: HL_TIMEOUT_MS,
    }, (res)=>{
      let buf='';
      res.on('data', c=>buf+=c);
      res.on('end', ()=>{
        try { resolve(JSON.parse(buf)); } catch(e){ reject(new Error('bad json')); }
      });
    });
    req.setTimeout(HL_TIMEOUT_MS, () => {
      req.destroy(new Error(`HL API timeout after ${HL_TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export async function candleSnapshot({ coin, interval, startTime, endTime }){
  // HL info endpoint
  const body = {
    type: 'candleSnapshot',
    req: {
      coin,
      interval,
      startTime,
      endTime,
    }
  };
  return await postJson('https://api.hyperliquid.xyz/info', body);
}

export async function allMids(){
  return await postJson('https://api.hyperliquid.xyz/info', { type: 'allMids' });
}

export async function spotClearinghouseState(user){
  return await postJson('https://api.hyperliquid.xyz/info', { type: 'spotClearinghouseState', user });
}
