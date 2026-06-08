import { useStore } from "../store";
import { Bell, Refresh } from "./Icons";

export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  const { connected, refresh, refreshing } = useStore();
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-6 pb-2">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold leading-tight text-slate-900">{title}</h1>
        <p className="truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
            connected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
          {connected ? "Gemini Connected" : "Not Connected"}
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-60"
          title="Refresh data"
        >
          <Refresh className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
          AU
        </div>
      </div>
    </div>
  );
}
