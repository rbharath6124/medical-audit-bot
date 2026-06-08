import { useStore } from "../store";
import { Clock, Spinner, Check, X, Gauge, Dollar, Chart, Activity, Alert, FileIcon } from "../components/Icons";
import { formatCostUsd } from "../lib/pricing";

function MiniStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-500">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-slate-400" title={sub}>{sub}</div>}
    </div>
  );
}

export function QueueView() {
  const { audits, progress, processing, queuePaused, pauseQueue, resumeQueue, cancelQueue, cancelAudit, retryAudit, retryFailedAudits, metrics } = useStore();

  const queued = audits.filter((a) => a.status === "queued").length;
  const active = audits.filter((a) => a.status === "processing").length;
  const completed = audits.filter((a) => a.status === "completed").length;
  const failed = audits.filter((a) => a.status === "failed").length;
  const totalDisc = audits.reduce((s, a) => s + a.discrepancies.length, 0);

  const avgMs =
    metrics.completedCount > 0
      ? metrics.totalProcessingMs / metrics.completedCount
      : 0;

  // Throughput = charts per minute (based on completed only while processing, or total session)
  const elapsedMinutes = metrics.sessionStartedAt
    ? (Date.now() - metrics.sessionStartedAt) / 60000
    : 0;
  const throughput = elapsedMinutes > 0 ? metrics.completedCount / elapsedMinutes : 0;

  // ETA for queued items
  const remaining = queued + active;
  const etaMinutes = throughput > 0 && remaining > 0 ? remaining / throughput : 0;
  const etaStr =
    !metrics.sessionStartedAt || remaining === 0
      ? "—"
      : etaMinutes < 1
      ? "< 1 min"
      : `${Math.ceil(etaMinutes)} min`;

  const avgSeconds = (avgMs / 1000).toFixed(1);
  const errorRate = audits.length > 0 ? Math.round((failed / audits.length) * 100) : 0;

  const recent = audits.slice(0, 50);

  return (
    <div className="space-y-5 px-8 py-6">
      {/* Progress bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Clock className="h-5 w-5 text-slate-400" />
          {processing
            ? `Processing ${progress.done}/${progress.total}`
            : audits.length
            ? "Idle"
            : "No jobs"}
        </div>
        <div className="mb-3 text-sm text-slate-500">
          {progress.done} of {progress.total} processed • avg {avgMs ? `${avgSeconds}s` : "—"} / chart
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {queuePaused && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Paused</span>}
          <span>{processing ? "Processing queue" : "Queue idle"}</span>
          <span>• {queued} queued • {active} active</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={queuePaused ? resumeQueue : pauseQueue}
            disabled={!processing && !queuePaused}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-300 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {queuePaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={cancelQueue}
            disabled={!queued && !active}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition enabled:hover:border-rose-300 enabled:hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={retryFailedAudits}
            disabled={audits.filter((a) => a.status === "failed" || a.status === "cancelled").length === 0}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-300 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry failed
          </button>
        </div>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-6 gap-4">
        <MiniStat icon={<Clock className="h-4 w-4" />} label="QUEUED" value={String(queued)} />
        <MiniStat icon={<Spinner className={active ? "h-4 w-4" : "h-4 w-4 [animation:none]"} />} label="ACTIVE" value={String(active)} />
        <MiniStat icon={<Check className="h-4 w-4 text-emerald-500" />} label="COMPLETED" value={String(completed)} />
        <MiniStat icon={<X className="h-4 w-4 text-rose-500" />} label="FAILED" value={String(failed)} />
        <MiniStat icon={<Gauge className="h-4 w-4 text-blue-500" />} label="THROUGHPUT" value={throughput.toFixed(1)} sub="charts / min" />
        <MiniStat icon={<Clock className="h-4 w-4 text-violet-500" />} label="ETA" value={etaStr} sub="for remaining queue" />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MiniStat
          icon={<Dollar className="h-4 w-4 text-emerald-500" />}
          label="SESSION API COST"
          value={formatCostUsd(metrics.totalCostUsd)}
          sub={`${metrics.apiCalls} API call${metrics.apiCalls === 1 ? "" : "s"}`}
        />
        <MiniStat
          icon={<Chart className="h-4 w-4 text-amber-500" />}
          label="TOTAL DISCREPANCIES"
          value={String(totalDisc)}
        />
        <MiniStat
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
          label="PIPELINE HEALTH"
          value={errorRate > 30 ? "Degraded" : errorRate > 0 ? "Degraded" : "Operational"}
          sub={`${errorRate}% error rate`}
        />
        <MiniStat
          icon={<Alert className="h-4 w-4 text-rose-500" />}
          label="TOKEN USAGE"
          value={((metrics.totalInputTokens + metrics.totalOutputTokens + metrics.totalThinkingTokens) / 1000).toFixed(0) + "K"}
          sub={`In ${metrics.totalInputTokens.toLocaleString()} · Out ${metrics.totalOutputTokens.toLocaleString()} · Think ${metrics.totalThinkingTokens.toLocaleString()}`}
        />
      </div>

      {/* Job queue list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Job Queue</h3>
          <span className="text-xs text-slate-400">Live status — updated in real time</span>
        </div>
        <p className="mb-4 text-sm text-slate-500">Most recent {recent.length} job(s)</p>
        {recent.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-3 text-slate-400">
            <FileIcon className="h-10 w-10" />
            <div className="text-lg font-semibold">Queue is empty</div>
            <div className="text-sm">Upload charts to populate the processing queue.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <div key={a.id} className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <FileIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{a.fileName}</div>
                  </div>
                  {a.status === "queued" && <Tag tint="bg-slate-200 text-slate-600">Queued</Tag>}
                  {a.status === "processing" && <Tag tint="bg-blue-100 text-blue-700"><Spinner className="h-3 w-3" /> Processing</Tag>}
                  {a.status === "completed" && <Tag tint="bg-emerald-100 text-emerald-700"><Check className="h-3 w-3" /> Done · {(a.processingMs! / 1000).toFixed(1)}s</Tag>}
                  {a.status === "failed" && <Tag tint="bg-rose-100 text-rose-700"><X className="h-3 w-3" /> Failed</Tag>}
                  {a.status === "cancelled" && <Tag tint="bg-amber-100 text-amber-700">Cancelled</Tag>}
                  {(a.status === "queued" || a.status === "processing") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelAudit(a.id);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  )}
                  {(a.status === "failed" || a.status === "cancelled") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        retryAudit(a.id);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Retry
                    </button>
                  )}
                </div>
                {a.status === "failed" && a.error && (
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    <b>Error:</b> {a.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ children, tint }: { children: React.ReactNode; tint: string }) {
  return <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tint}`}>{children}</span>;
}
