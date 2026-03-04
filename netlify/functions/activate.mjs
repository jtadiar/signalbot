import { activateKey } from './lib/keys.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return Response.json({ valid: false, reason: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { key, deviceId } = await req.json();
    if (!key) {
      return Response.json({ valid: false, reason: 'Missing key' }, { status: 400, headers: CORS_HEADERS });
    }

    const result = await activateKey(key, deviceId);
    return Response.json(result, { headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ valid: false, reason: 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
};

export const config = { path: '/api/activate' };
