import { type ChangeEvent } from "react";
import { Calendar } from "../components/Icons";

export function DateRangeFilter({
  fromDate,
  toDate,
  onChange,
}: {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <Calendar className="h-4 w-4 text-slate-400" />
        <label className="text-xs font-semibold text-slate-500">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value, toDate)}
          className="border-0 bg-transparent text-sm font-medium text-slate-700 outline-none"
        />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <Calendar className="h-4 w-4 text-slate-400" />
        <label className="text-xs font-semibold text-slate-500">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(fromDate, e.target.value)}
          className="border-0 bg-transparent text-sm font-medium text-slate-700 outline-none"
        />
      </div>
      {(fromDate || toDate) && (
        <button
          onClick={() => onChange("", "")}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function formatDateRange(from: string, to: string): string {
  if (!from && !to) return "All time";
  if (from && !to) return `From ${formatDate(from)}`;
  if (!from && to) return `Until ${formatDate(to)}`;
  return `${formatDate(from)} — ${formatDate(to)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isWithinDateRange(createdAt: number, from: string, to: string): boolean {
  const auditDate = new Date(createdAt);
  auditDate.setHours(0, 0, 0, 0);
  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    if (auditDate < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(0, 0, 0, 0);
    if (auditDate > toDate) return false;
  }
  return true;
}
