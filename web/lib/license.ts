import crypto from "crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "licenses";

export interface LicenseRecord {
  key: string;
  email: string;
  createdAt: string;
  active: boolean;
}

function getDb() {
  return getStore(STORE_NAME);
}

async function loadRecords(): Promise<LicenseRecord[]> {
  try {
    const store = getDb();
    const data = await store.get("all_licenses", { type: "text" });
    if (data) return JSON.parse(data);
  } catch {}
  return [];
}

async function saveRecords(records: LicenseRecord[]): Promise<void> {
  const store = getDb();
  await store.set("all_licenses", JSON.stringify(records));
}

export function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[crypto.randomInt(chars.length)];
    }
    segments.push(seg);
  }
  return `SB-${segments.join("-")}`;
}

export async function createLicense(email: string): Promise<string> {
  const records = await loadRecords();

  const existing = records.find(
    (r) => r.email === email.trim().toLowerCase() && r.active
  );
  if (existing) return existing.key;

  const key = generateKey();
  records.push({
    key,
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    active: true,
  });
  await saveRecords(records);
  return key;
}

export async function validateKey(key: string): Promise<boolean> {
  if (!key || typeof key !== "string") return false;
  const records = await loadRecords();
  return records.some(
    (r) => r.key === key.trim().toUpperCase() && r.active
  );
}
