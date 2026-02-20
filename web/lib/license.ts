import crypto from "crypto";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "licenses.json");

export interface LicenseRecord {
  key: string;
  email: string;
  stripeSessionId: string;
  createdAt: string;
  active: boolean;
}

function ensureDb(): LicenseRecord[] {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function saveDb(records: LicenseRecord[]) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2));
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

export function createLicense(email: string, stripeSessionId: string): string {
  const records = ensureDb();

  const existing = records.find((r) => r.stripeSessionId === stripeSessionId);
  if (existing) return existing.key;

  const key = generateKey();
  records.push({
    key,
    email,
    stripeSessionId,
    createdAt: new Date().toISOString(),
    active: true,
  });
  saveDb(records);
  return key;
}

export function validateKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const records = ensureDb();
  return records.some((r) => r.key === key.trim().toUpperCase() && r.active);
}
