import { useState } from "react";
import { useStore } from "../store";
import { testConnection } from "../lib/gemini";
import { describePrice } from "../lib/pricing";
import { loadAuditsFromFolder, saveAuditsToFolder, selectStorageFolder } from "../lib/storage";
import { ShieldCheck, Key, Eye, Bolt, Shield, Folder, Database, Trash, Check, Spinner, Alert } from "../components/Icons";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function SettingsView() {
  const { settings, updateSettings, audits, clearAllAudits } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(settings.apiKey);
  const [saved, setSaved] = useState(false);
  const [folderStatus, setFolderStatus] = useState("");
  const [testing, setTesting] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  const saveKey = () => {
    const trimmed = keyInput.trim();
    updateSettings({ apiKey: trimmed });
    setKeyInput(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const test = async () => {
    setTesting("testing");
    const ok = await testConnection({ ...settings, apiKey: keyInput.trim() });
    setTesting(ok ? "ok" : "fail");
    setTimeout(() => setTesting("idle"), 3000);
  };

  const browseStorageFolder = async () => {
    const folder = await selectStorageFolder();
    if (!folder) return;
    const existingAudits = await loadAuditsFromFolder(folder);
    if (existingAudits.length === 0 && audits.length > 0) {
      await saveAuditsToFolder(folder, audits);
    }
    updateSettings({ storageFolder: folder });
    setFolderStatus("Storage folder selected. Audit history will load and save from this folder.");
    setTimeout(() => setFolderStatus(""), 4000);
  };

  return (
    <div className="space-y-5 px-8 py-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-teal-50/30 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">HIPAA Compliance Architecture</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              This tool is designed with HIPAA in mind. Files are read locally first, then chart content is sent directly
              to the Gemini API key you configure for AI review.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {["Local file reading before API review",
                "Your own Google Gemini API key",
                "Use a Google Cloud account with a signed BAA for HIPAA workflows",
                "Optional local/network folder database for audit history"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-900"><Key className="h-5 w-5 text-slate-400" /> Gemini API Key</div>
        <p className="mt-1 text-sm text-slate-500">
          Your API key is stored locally in your browser. It is sent directly to Google and never to any other server.
          Get a key at <span className="font-semibold text-emerald-600">aistudio.google.com/apikey</span>.
        </p>
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"} value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 font-mono text-sm outline-none focus:border-emerald-400"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <Eye className="h-5 w-5" />
            </button>
          </div>
          <button onClick={test} disabled={!keyInput || testing === "testing"}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {testing === "testing" ? <Spinner className="h-4 w-4" /> : null} Test
          </button>
          <button onClick={saveKey} className="shrink-0 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">
            Save Key
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {settings.apiKey ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Check className="h-4 w-4" /> Key configured • ending in ...{settings.apiKey.slice(-4)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <Alert className="h-4 w-4" /> Not configured — paste your key and click Save Key
            </span>
          )}
          {keyInput.trim() && keyInput.trim() !== settings.apiKey && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              Unsaved changes — click Save Key
            </span>
          )}
        </div>
        {saved && <span className="mt-2 inline-block text-xs font-semibold text-emerald-600">✓ Saved!</span>}
        {testing === "ok" && <span className="ml-2 text-xs font-semibold text-emerald-600">✓ Connection successful</span>}
        {testing === "fail" && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><Alert className="h-3 w-3" /> Connection failed</span>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Bolt className="h-5 w-5 text-slate-400" /> Processing Configuration</div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-slate-700">AI Model</label>
            <select value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400">
              <option value="gemini-2.5-pro">Gemini 2.5 Pro - Highest accuracy - Default</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash - Good accuracy, lower cost</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite - Lowest cost</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash - Legacy model</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Uses a 2-pass audit: evidence-based draft review, then independent verification/correction.
              Current price basis: {describePrice(settings.model)}
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700">Concurrency ({settings.concurrency} parallel)</label>
            <input type="range" min={1} max={10} value={settings.concurrency}
              onChange={(e) => updateSettings({ concurrency: Number(e.target.value) })}
              className="mt-4 w-full accent-emerald-500" />
            <p className="mt-2 text-xs text-slate-500">Higher = faster batch, but uses more API rate limit. For thousands of charts, use 5–10.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Shield className="h-5 w-5 text-slate-400" /> HIPAA Configuration</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
            <div className="min-w-0">
              <div className="font-bold text-slate-800">I acknowledge BAA requirement</div>
              <div className="text-sm text-slate-500">For HIPAA-covered entities, you must execute a Business Associate Agreement with Google Cloud.</div>
            </div>
            <Toggle on={settings.baaAcknowledged} onChange={(v) => updateSettings({ baaAcknowledged: v })} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
            <div className="min-w-0">
              <div className="font-bold text-slate-800">Encrypt PHI in local storage</div>
              <div className="text-sm text-slate-500">Obfuscates cached chart text. True encryption requires a backend vault (e.g., Cloud KMS).</div>
            </div>
            <Toggle on={settings.encryptPhi} onChange={(v) => updateSettings({ encryptPhi: v })} />
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Alert className="mt-0.5 h-4 w-4 shrink-0" />
          <span><b>Important:</b> This is a client-side tool. For production HIPAA environments, deploy behind your organization's SSO, use a Google Cloud account with BAA, and route API calls through a compliant proxy.</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><Folder className="h-5 w-5 text-slate-400" /> Storage Folder</div>
        <p className="text-sm text-slate-500">Choose a local or network folder to store your audit database. If empty, the app falls back to browser storage.</p>
        <div className="mt-4 flex gap-3">
          <input value={settings.storageFolder} onChange={(e) => updateSettings({ storageFolder: e.target.value })}
            placeholder="e.g. C:\Users\Shared\MedAuditDB"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400" />
          <button onClick={browseStorageFolder} className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Browse</button>
        </div>
        {folderStatus && <div className="mt-2 text-xs font-semibold text-emerald-600">{folderStatus}</div>}
        {settings.storageFolder && (
          <div className="mt-2 text-xs text-slate-500">
            Database file: <span className="font-mono">{settings.storageFolder}\medaudit-db.json</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><Database className="h-5 w-5 text-slate-400" /> Local Data</div>
        <p className="text-sm text-slate-500">
          {settings.storageFolder
            ? `Audit data is saved to the selected folder database. Clearing will remove ${audits.length} stored review(s).`
            : `Audit data lives in browser storage. Clearing will remove ${audits.length} stored review(s).`}
        </p>
        <button onClick={() => { if (confirm("Clear all audits?")) clearAllAudits(); }}
          className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100">
          <Trash className="h-4 w-4" /> Clear All Reviews
        </button>
      </div>
    </div>
  );
}


