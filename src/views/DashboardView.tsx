import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useStore } from "../store";
import { Alert, Bolt, Chart, Clock, FileCheck, FileSearch, Shield, Download, Activity } from "../components/Icons";
import { exportAuditsCsv } from "../lib/export";
import { DateRangeFilter, isWithinDateRange, formatDateRange } from "../components/DateFilter";

function Stat({
  icon, value, label, sub, tint,
}: { icon: React.ReactNode; value: string; label: string; sub: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>{icon}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{label}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function DashboardView() {
  const { audits } = useStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Apply date range filter to completed audits
  const dateFiltered = audits.filter(
    (a) => a.status === "completed" && isWithinDateRange(a.createdAt, fromDate, toDate),
  );
  const completed = dateFiltered;

  const stats = useMemo(() => {
    const totalDisc = completed.reduce((s, a) => s + a.discrepancies.length, 0);
    const missing = completed.reduce((s, a) => s + a.missingCodes.length, 0);
    const extra = completed.reduce(
      (s, a) => s + a.discrepancies.filter((d) => d.type === "removed").length, 0);
    const critical = completed.reduce(
      (s, a) => s + a.discrepancies.filter((d) => d.severity === "critical").length, 0);
    const avgCompliance = completed.length
      ? completed.reduce((s, a) => s + a.complianceScore, 0) / completed.length : 0;
    const avgTime = completed.length
      ? completed.reduce((s, a) => s + (a.processingMs || 0), 0) / completed.length / 1000 : 0;
    return { totalDisc, missing, extra, critical, avgCompliance, avgTime };
  }, [completed]);

  const volumeData = useMemo(() => {
    const days: { date: string; processed: number; discrepancies: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const dayAudits = completed.filter((a) => new Date(a.createdAt).toDateString() === key);
      days.push({
        date: label,
        processed: dayAudits.length,
        discrepancies: dayAudits.reduce((s, a) => s + a.discrepancies.length, 0),
      });
    }
    return days;
  }, [completed]);

  const breakdown = useMemo(() => {
    const map: Record<string, number> = {};
    completed.forEach((a) => a.discrepancies.forEach((d) => { map[d.category] = (map[d.category] || 0) + 1; }));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [completed]);

  const severityData = useMemo(() => {
    const map: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    completed.forEach((a) => a.discrepancies.forEach((d) => { map[d.severity]++; }));
    return [
      { name: "Low", value: map.low }, { name: "Medium", value: map.medium },
      { name: "High", value: map.high }, { name: "Critical", value: map.critical },
    ];
  }, [completed]);

  const providers = useMemo(() => {
    const map: Record<string, { total: number; sum: number }> = {};
    completed.forEach((a) => {
      const p = a.provider || "Unknown";
      if (!map[p]) map[p] = { total: 0, sum: 0 };
      map[p].total++; map[p].sum += a.complianceScore;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, compliance: Math.round(v.sum / v.total), charts: v.total }))
      .sort((a, b) => a.compliance - b.compliance).slice(0, 6);
  }, [completed]);

  return (
    <div className="space-y-5 px-8 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Dashboard Overview</h2>
            <p className="text-sm text-slate-500">Real-time metrics and analysis</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeFilter
              fromDate={fromDate}
              toDate={toDate}
              onChange={(from, to) => { setFromDate(from); setToDate(to); }}
            />
            <button
              onClick={() => exportAuditsCsv(completed)}
              disabled={completed.length === 0}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export to Power BI
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs font-medium text-slate-400">
          Showing: {formatDateRange(fromDate, toDate)}
          {completed.length > 0 && ` · ${completed.length} chart${completed.length === 1 ? "" : "s"} processed`}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <Stat icon={<FileCheck className="h-6 w-6 text-emerald-600" />} value={String(completed.length)}
          label="Charts Processed" sub={`${audits.filter(a => a.status === "queued" || a.status === "processing").length} in queue • ${audits.filter(a => a.status === "failed").length} failed`} tint="bg-emerald-50" />
        <Stat icon={<Shield className="h-6 w-6 text-blue-600" />} value={`${stats.avgCompliance.toFixed(1)}%`}
          label="Compliance Score" sub="Average across all audits" tint="bg-blue-50" />
        <Stat icon={<Alert className="h-6 w-6 text-amber-600" />} value={String(stats.totalDisc)}
          label="Total Discrepancies" sub={`${stats.missing} missing • ${stats.extra} extra`} tint="bg-amber-50" />
        <Stat icon={<Bolt className="h-6 w-6 text-rose-600" />} value={String(stats.critical)}
          label="Critical Flags" sub="Require immediate review" tint="bg-rose-50" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <InfoCard icon={<Activity className="h-5 w-5 text-emerald-600" />} title="PIPELINE HEALTH" value="Operational" />
        <InfoCard icon={<Clock className="h-5 w-5 text-blue-600" />} title="AVG PROCESSING TIME"
          value={stats.avgTime ? `${stats.avgTime.toFixed(1)}s` : "—"} />
        <InfoCard icon={<FileSearch className="h-5 w-5 text-violet-600" />} title="MODELS ANALYZED"
          value="CPT • ICD-10 • HCPCS • NCCI" small />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-bold text-slate-900">Processing Volume — Last 14 Days</h3>
          <p className="mb-4 text-sm text-slate-500">Charts processed and discrepancies flagged per day</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="discrepancies" stroke="#f59e0b" strokeWidth={2} name="Discrepancies" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="processed" stroke="#10b981" strokeWidth={2} name="Processed" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-bold text-slate-900">Discrepancy Breakdown</h3>
          <p className="mb-4 text-sm text-slate-500">By category</p>
          {breakdown.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={breakdown} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} width={70} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-bold text-slate-900">Discrepancies by Severity</h3>
          <p className="mb-4 text-sm text-slate-500">Triage view — prioritize critical and high</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={severityData}>
              <defs>
                <linearGradient id="sev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#sev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-bold text-slate-900">Providers — Compliance Ranking</h3>
          <p className="mb-4 text-sm text-slate-500">Lowest compliance first (needs review)</p>
          {providers.length ? (
            <div className="space-y-3">
              {providers.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-40 truncate text-sm font-medium text-slate-700">{p.name}</div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${p.compliance < 60 ? "bg-rose-500" : p.compliance < 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${p.compliance}%` }} />
                  </div>
                  <div className="w-12 text-right text-sm font-bold text-slate-800">{p.compliance}%</div>
                </div>
              ))}
            </div>
          ) : <Empty label="No data yet" />}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, value, small }: { icon: React.ReactNode; title: string; value: string; small?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold tracking-wider text-slate-400">{title}</div>
        <div className={`truncate font-bold text-slate-900 ${small ? "text-sm" : "text-lg"}`}>{value}</div>
      </div>
    </div>
  );
}

function Empty({ label = "Upload charts to see data" }: { label?: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
      <Chart className="h-8 w-8" />
      <span className="text-sm">{label}</span>
    </div>
  );
}


