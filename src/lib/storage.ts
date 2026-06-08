import type { AuditResult, Settings } from "../types";

const SETTINGS_KEY = "medaudit.settings";
const AUDITS_KEY = "medaudit.audits";

export const defaultSettings: Settings = {
  apiKey: "",
  model: "gemini-2.5-pro",
  concurrency: 4,
  baaAcknowledged: false,
  encryptPhi: true,
  storageFolder: "",
};

// In-memory fallback for sandboxed environments where localStorage is blocked.
const mem: Record<string, string> = {};

function safeGet(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : mem[key] ?? null;
  } catch {
    return mem[key] ?? null;
  }
}

function safeSet(key: string, value: string) {
  mem[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore — value still kept in memory */
  }
}

function safeRemove(key: string) {
  delete mem[key];
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = safeGet(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  safeSet(SETTINGS_KEY, JSON.stringify(s));
}

export function loadAudits(): AuditResult[] {
  try {
    const raw = safeGet(AUDITS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAudits(audits: AuditResult[]) {
  try {
    safeSet(AUDITS_KEY, JSON.stringify(audits));
  } catch {
    safeSet(AUDITS_KEY, JSON.stringify(audits.slice(-200)));
  }
}

export function clearAudits() {
  safeRemove(AUDITS_KEY);
}

export async function selectStorageFolder(): Promise<string | null> {
  return window.medAudit?.selectStorageFolder ? window.medAudit.selectStorageFolder() : null;
}

export async function loadAuditsFromFolder(folder: string): Promise<AuditResult[]> {
  if (!folder || !window.medAudit?.readAudits) return loadAudits();
  try {
    const audits = await window.medAudit.readAudits(folder);
    return Array.isArray(audits) ? audits as AuditResult[] : [];
  } catch {
    return loadAudits();
  }
}

export async function saveAuditsToFolder(folder: string, audits: AuditResult[]) {
  if (!folder || !window.medAudit?.writeAudits) return false;
  try {
    return await window.medAudit.writeAudits(folder, audits);
  } catch {
    return false;
  }
}

export async function clearAuditsInFolder(folder: string) {
  if (!folder || !window.medAudit?.clearAudits) return false;
  try {
    return await window.medAudit.clearAudits(folder);
  } catch {
    return false;
  }
}
