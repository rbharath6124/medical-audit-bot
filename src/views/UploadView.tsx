import { useRef, useState } from "react";
import { useStore } from "../store";
import { UploadCloud, Sparkles, ShieldCheck, FileIcon, X, Check, Spinner, Alert } from "../components/Icons";

function Badge({ children, tint }: { children: React.ReactNode; tint: string }) {
  return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tint}`}>{children}</span>;
}

export function UploadView({ onStarted }: { onStarted: () => void }) {
  const { files, addFiles, removeFile, runAudit, settings, processing } = useStore();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ready = files.filter((f) => f.status === "ready").length;

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    addFiles(Array.from(list));
  };

  const start = async () => {
    onStarted();
    await runAudit();
  };

  return (
    <div className="space-y-5 px-8 py-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Upload Medical Charts</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Drop PDFs for AI-powered CPT/ICD-10/HCPCS/E&M audit. Each chart is parsed{" "}
              <span className="font-bold text-emerald-700">entirely in your browser</span> — PHI never touches our servers.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tint="bg-emerald-100 text-emerald-700">✓ Native PDF understanding</Badge>
              <Badge tint="bg-blue-100 text-blue-700">CPT • ICD-10 • HCPCS</Badge>
              <Badge tint="bg-indigo-100 text-indigo-700">NCCI edit checks</Badge>
              <Badge tint="bg-violet-100 text-violet-700">Batch processing</Badge>
            </div>
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white p-14 text-center transition ${
          drag ? "border-emerald-400 bg-emerald-50/40" : "border-slate-300 hover:border-emerald-300"
        }`}
      >
        <input ref={inputRef} type="file" multiple accept=".pdf,.txt" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50">
          <UploadCloud className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="text-xl font-bold text-slate-800">Drop PDF charts here</div>
        <div className="mt-1 text-sm text-slate-500">or click to browse • PDF or TXT • batch supported</div>
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> HIPAA-safe: processing happens locally before any network call
        </div>
      </div>

      {files.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Uploaded Files ({files.length})</h3>
            <span className="text-sm text-slate-500">{ready} ready</span>
          </div>
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <FileIcon className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">{f.name}</div>
                  <div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div>
                </div>
                {f.status === "parsing" && <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600"><Spinner className="h-4 w-4" /> Reading</span>}
                {f.status === "ready" && <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="h-4 w-4" /> Ready</span>}
                {f.status === "error" && <span className="flex max-w-[200px] shrink-0 items-center gap-1.5 truncate text-xs font-semibold text-rose-600" title={f.error}><Alert className="h-4 w-4 shrink-0" /> <span className="truncate">{f.error}</span></span>}
                <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">Ready to run audit?</h3>
          <p className="text-sm text-slate-500">
            {!settings.apiKey
              ? "Add your Gemini API key in Settings first."
              : ready === 0
              ? "Upload at least one chart to start."
              : `${ready} chart(s) ready for AI audit.`}
          </p>
        </div>
        <button
          disabled={ready === 0 || !settings.apiKey || processing}
          onClick={start}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition enabled:hover:from-emerald-600 enabled:hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {processing ? "Running..." : "Start AI Review"}
        </button>
      </div>
    </div>
  );
}
