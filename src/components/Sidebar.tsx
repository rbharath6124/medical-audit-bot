import { Activity, Dashboard, Upload, Queue, Results, Settings, ShieldCheck } from "./Icons";

export type View = "dashboard" | "upload" | "queue" | "results" | "settings";

const items: { id: View; label: string; Icon: typeof Dashboard }[] = [
  { id: "dashboard", label: "Dashboard", Icon: Dashboard },
  { id: "upload", label: "Upload Charts", Icon: Upload },
  { id: "queue", label: "Processing Queue", Icon: Queue },
  { id: "results", label: "Audit Results", Icon: Results },
  { id: "settings", label: "Settings & HIPAA", Icon: Settings },
];

export function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="text-lg font-bold leading-tight text-slate-900">MedAudit Pro</div>
          <div className="text-[11px] font-semibold tracking-wider text-emerald-600">CHART REVIEW SUITE</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> HIPAA Ready
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">
          BAA acknowledged • Client-side processing • Encryption on
        </p>
      </div>
    </aside>
  );
}
