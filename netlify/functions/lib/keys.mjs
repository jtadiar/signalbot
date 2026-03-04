import { supabase } from './supabase.mjs';
import crypto from 'crypto';

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from(crypto.randomBytes(4))
    .map(b => chars[b % chars.length]).join('');
  return `SB-${segment()}-${segment()}-${segment()}-${segment()}`;
}

export async function createLicenseKey(email, stripePaymentId = null, plan = 'standard') {
  const key = generateKey();

  const { data, error } = await supabase()
    .from('license_keys')
    .insert({
      key,
      email: email.toLowerCase().trim(),
      plan,
      stripe_payment_id: stripePaymentId,
      activated: false,
      max_activations: 2,
      activations: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create license key: ${error.message}`);
  return data;
}

export async function validateKey(key) {
  const normalized = key.trim().toUpperCase();

  const { data, error } = await supabase()
    .from('license_keys')
    .select('*')
    .eq('key', normalized)
    .single();

  if (error || !data) return { valid: false, reason: 'Key not found' };
  if (data.revoked) return { valid: false, reason: 'Key has been revoked' };

  return { valid: true, plan: data.plan, email: data.email };
}

export async function activateKey(key, deviceId) {
  const normalized = key.trim().toUpperCase();

  const { data, error } = await supabase()
    .from('license_keys')
    .select('*')
    .eq('key', normalized)
    .single();

  if (error || !data) return { valid: false, reason: 'Key not found' };
  if (data.revoked) return { valid: false, reason: 'Key has been revoked' };
  if (data.activations >= data.max_activations) {
    return { valid: false, reason: 'Maximum activations reached' };
  }

  const { error: updateError } = await supabase()
    .from('license_keys')
    .update({
      activated: true,
      activations: data.activations + 1,
      last_device_id: deviceId || null,
      activated_at: new Date().toISOString(),
    })
    .eq('key', normalized);

  if (updateError) return { valid: false, reason: 'Activation failed' };

  return { valid: true, plan: data.plan };
}
