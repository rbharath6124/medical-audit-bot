import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { AuditResult, CodeSet } from "../types";
import { AuditDetail } from "./AuditDetail";
import { Search, Download, Chart, Spinner } from "../components/Icons";
import { exportAuditsExcel } from "../lib/export";
import { DateRangeFilter, isWithinDateRange, formatDateRange } from "../components/DateFilter";

function summarizeCodes(set: CodeSet) {
  const all = [...set.icd10, ...set.em, ...set.cpt, ...set.hcpcs];
  return all.map((c) => `${c.code}${c.qty > 1 ? `×${c.qty}` : ""}`).join(", ") || "—";
}

export function ResultsView() {
  const { audits } = useStore();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<AuditResult | null>(null);

  const completed = audits.filter((a) => a.status === "completed");
  const processing = audits.filter((a) => a.status === "processing" || a.status === "queued");

  const dateFiltered = useMemo(() => {
    return completed.filter((a) => isWithinDateRange(a.createdAt, fromDate, toDate));
  }, [completed, fromDate, toDate]);

  const filtered = useMemo(() => {
    return dateFiltered.filter((a) => {
      const q = query.toLowerCase();
      const matchQ = !q || [a.fileName, a.patient, a.provider, a.facility].some((s) => s.toLowerCase().includes(q));
      const matchSev = severity === "all" || a.discrepancies.some((d) => d.severity === severity);
      return matchQ && matchSev;
    });
  }, [dateFiltered, query, severity]);

  const withIssues = dateFiltered.filter((a) => a.discrepancies.length > 0 || (a.auditWarnings?.length || 0) > 0).length;
  const clean = dateFiltered.length - withIssues;
  const upcoding = dateFiltered.reduce((sum, a) => sum + a.discrepancies.filter((d) => d.billingImpact === "upcoding").length, 0);
  const downcoding = dateFiltered.reduce((sum, a) => sum + a.discrepancies.filter((d) => d.billingImpact === "downcoding").length, 0);

  return (
    <div className="space-y-5 px-8 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by patient, file, provider, facility..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={(from, to) => { setFromDate(from); setToDate(to); }}
          />
          <button onClick={() => exportAuditsExcel(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-bold text-white transition hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> Export Detailed Excel
          </button>
        </div>
        <div className="mt-3 text-xs font-medium text-slate-400">
          {formatDateRange(fromDate, toDate)}
          {filtered.length > 0 && ` · ${filtered.length} of ${dateFiltered.length} chart${dateFiltered.length === 1 ? "" : "s"} matching filters`}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Pill tint="bg-slate-100 text-slate-600">{dateFiltered.length} Total charts</Pill>
        <Pill tint="bg-amber-100 text-amber-700">{withIssues} With issues</Pill>
        <Pill tint="bg-rose-100 text-rose-700">{upcoding} Upcoding</Pill>
        <Pill tint="bg-orange-100 text-orange-700">{downcoding} Downcoding</Pill>
        <Pill tint="bg-emerald-100 text-emerald-700">{clean} Clean charts</Pill>
        <Pill tint="bg-blue-100 text-blue-700">{filtered.length} Showing</Pill>
        {processing.length > 0 && <Pill tint="bg-indigo-100 text-indigo-700">{processing.length} Processing</Pill>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold tracking-wider text-slate-500">
              <th className="px-4 py-3">CHART</th>
              <th className="px-4 py-3">PATIENT</th>
              <th className="px-4 py-3">PROVIDER / FACILITY</th>
              <th className="px-4 py-3">DATE</th>
              <th className="px-4 py-3">E&M LEVEL</th>
              <th className="px-4 py-3">CODE SUMMARY</th>
              <th className="px-4 py-3">DISCREPANCIES</th>
              <th className="px-4 py-3">SCORE</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <Chart className="mx-auto mb-3 h-8 w-8" />
                  {completed.length === 0 ? "No audits yet. Upload charts to get started." : "No results match your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const changed = a.documentedEmLevel.split(" ")[0] !== a.auditedEmLevel.split(" ")[0];
                return (
                  <tr key={a.id} onClick={() => setSelected(a)}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/40">
                    <td className="max-w-[180px] truncate px-4 py-3 font-medium text-slate-800">{a.fileName}</td>
                    <td className="px-4 py-3 text-slate-600">{a.patient}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-medium text-slate-700">{a.provider}</div>
                      <div className="text-xs text-slate-400">{a.facility}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.dateOfService}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${changed ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {a.auditedEmLevel.split(" ")[0]}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-500">{summarizeCodes(a.correctedCodes)}</td>
                    <td className="px-4 py-3">
                      {a.discrepancies.length ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{a.discrepancies.length} found</span>
                      ) : (a.auditWarnings?.length || 0) > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Review</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Clean</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${a.complianceScore >= 80 ? "text-emerald-600" : a.complianceScore >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                        {a.complianceScore}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
            {processing.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 bg-blue-50/30">
                <td className="max-w-[180px] truncate px-4 py-3 font-medium text-slate-700">{a.fileName}</td>
                <td colSpan={7} className="px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                    <Spinner className="h-4 w-4" /> {a.status === "queued" ? "Queued..." : "AI auditing..."}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <AuditDetail audit={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Pill({ children, tint }: { children: React.ReactNode; tint: string }) {
  return <span className={`rounded-full px-3 py-1.5 font-semibold ${tint}`}>{children}</span>;
}
