-- Run this in your Supabase SQL Editor to create the license_keys table

create table if not exists license_keys (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  email text not null,
  plan text default 'standard',
  stripe_payment_id text,
  activated boolean default false,
  activated_at timestamptz,
  max_activations int default 2,
  activations int default 0,
  last_device_id text,
  revoked boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_license_keys_key on license_keys (key);
create index if not exists idx_license_keys_email on license_keys (email);

-- Row-level security: only service role can access (API uses service key)
alter table license_keys enable row level security;

-- No public access policies — all access goes through service role key
