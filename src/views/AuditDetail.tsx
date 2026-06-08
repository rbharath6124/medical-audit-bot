import type { AuditResult, CodeEntry, CodeSet } from "../types";
import { X, ShieldCheck, Plus, Activity, Alert } from "../components/Icons";
import { formatCostUsd } from "../lib/pricing";

function CodePill({ entry, added }: { entry: CodeEntry; added?: boolean }) {
  const title = [
    entry.description,
    entry.evidence ? `Evidence: ${entry.evidence}` : "",
    entry.sourceType && entry.sourceType !== "unknown" ? `Source: ${entry.sourceType}` : "",
    entry.billableByProvider ? `Provider billable: ${entry.billableByProvider}` : "",
  ].filter(Boolean).join("\n");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold ${
        added
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
      title={title}
    >
      {added && <Plus className="h-3 w-3" />}
      {entry.code}{entry.qty > 1 ? ` (Qty: ${entry.qty})` : entry.qty === 1 ? " (Qty: 1)" : ""}
      {entry.sourceType === "outside-facility" && <span className="text-[10px] uppercase text-slate-500">Outside</span>}
      {entry.sourceType === "referred-lab" && <span className="text-[10px] uppercase text-slate-500">Referred</span>}
    </span>
  );
}

function CodeGroup({ label, entries, addedCodes }: { label: string; entries: CodeEntry[]; addedCodes?: Set<string> }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-bold text-slate-500">{label}</div>
      {entries.length ? (
        <div className="flex flex-wrap gap-2">
          {entries.map((e, i) => <CodePill key={i} entry={e} added={addedCodes?.has(e.code)} />)}
        </div>
      ) : (
        <div className="text-sm text-slate-400">None</div>
      )}
    </div>
  );
}

function flat(set: CodeSet) {
  return [...set.icd10, ...set.em, ...set.cpt, ...set.hcpcs].map((c) => c.code);
}

const sevColor: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-rose-100 text-rose-700",
};

const impactColor: Record<string, string> = {
  upcoding: "bg-rose-100 text-rose-700",
  overbilling: "bg-rose-100 text-rose-700",
  downcoding: "bg-amber-100 text-amber-700",
  underbilling: "bg-amber-100 text-amber-700",
  neutral: "bg-slate-100 text-slate-600",
  unknown: "bg-violet-100 text-violet-700",
};

export function AuditDetail({ audit, onClose }: { audit: AuditResult; onClose: () => void }) {
  const originalCodes = flat(audit.originalCodes);
  const addedCodes = new Set(flat(audit.correctedCodes).filter((c) => !originalCodes.includes(c)));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-3xl overflow-y-auto bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-7 py-5">
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-wider text-slate-400">CHART AUDIT DETAIL</div>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-900" title={audit.fileName}>{audit.fileName}</h2>
            <div className="mt-1 truncate text-xs text-slate-500">
              {audit.patient} • {audit.provider} • {audit.dateOfService}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-7">
          {/* E/M Level */}
          <div className="rounded-2xl border border-indigo-100 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold tracking-wide text-indigo-700">E&M LEVEL DETERMINATION</div>
                <div className="text-xs text-slate-500">Audited Evaluation & Management visit level coding</div>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-bold text-violet-700">
                Audited Level: {audit.auditedEmLevel}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-bold text-slate-400">DOCUMENTED (BILLED) E&M LEVEL</div>
                <div className="mt-1 font-bold text-slate-800">{audit.documentedEmLevel}</div>
              </div>
              <div className="rounded-xl border border-violet-200 p-4">
                <div className="text-xs font-bold text-violet-500">AUDITED (CORRECTED) E&M LEVEL</div>
                <div className="mt-1 font-bold text-violet-700">{audit.auditedEmLevel}</div>
              </div>
            </div>
            {audit.emJustification && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-700">
                  <Activity className="h-4 w-4" /> CLINICAL AUDITOR CODING JUSTIFICATION
                </div>
                <p className="mt-2 text-sm italic leading-relaxed text-slate-600">{audit.emJustification}</p>
              </div>
            )}
          </div>

          {/* Codes comparison */}
          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 font-bold text-slate-800">ORIGINALLY DOCUMENTED CODES IN PDF</div>
              <CodeGroup label="ICD-10 Diagnoses:" entries={audit.originalCodes.icd10} />
              <CodeGroup label="E/M Codes:" entries={audit.originalCodes.em} />
              <CodeGroup label="CPT Procedures:" entries={audit.originalCodes.cpt} />
              <CodeGroup label="HCPCS Codes:" entries={audit.originalCodes.hcpcs} />
            </div>
            <div className="rounded-2xl border-2 border-emerald-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2 font-bold text-emerald-700">
                <ShieldCheck className="h-5 w-5" /> FINAL CORRECTED CODES (SHOULD BE IN PDF)
              </div>
              <CodeGroup label="ICD-10 Diagnoses:" entries={audit.correctedCodes.icd10} addedCodes={addedCodes} />
              <CodeGroup label="E/M Codes:" entries={audit.correctedCodes.em} addedCodes={addedCodes} />
              <CodeGroup label="CPT Procedures:" entries={audit.correctedCodes.cpt} addedCodes={addedCodes} />
              <CodeGroup label="HCPCS Codes:" entries={audit.correctedCodes.hcpcs} addedCodes={addedCodes} />
            </div>
          </div>

          {/* Missing + Metrics */}
          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
              <div className="font-bold text-amber-700">MISSING / SUGGESTED CODES</div>
              <p className="mt-1 text-sm font-medium text-amber-600">
                Medically necessary procedures/services supported by documentation but missing from bill:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {audit.missingCodes.length ? (
                  audit.missingCodes.map((e, i) => <CodePill key={i} entry={e} added />)
                ) : (
                  <span className="text-sm text-slate-400">None identified</span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="font-bold text-slate-700">METRICS</div>
              <div className="mt-4 space-y-3">
                <Metric label="Compliance" value={audit.complianceScore} />
                <Metric label="AI confidence" value={audit.aiConfidence} suffix="%" />
              </div>
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                <div className="font-bold text-slate-700">MODEL & USAGE</div>
                <div className="mt-2 space-y-1">
                  <div>Model: <span className="font-mono">{audit.modelUsed || "-"}</span></div>
                  <div>API calls: {audit.apiCalls || 0}</div>
                  <div>Tokens: input {(audit.inputTokens || 0).toLocaleString()} / output {(audit.outputTokens || 0).toLocaleString()} / thinking {(audit.thinkingTokens || 0).toLocaleString()}</div>
                  <div>Estimated cost: {formatCostUsd(audit.costUsd || 0)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 font-bold text-slate-800">VERIFICATION & DOCUMENT QUALITY</div>
            <div className="space-y-3 text-sm text-slate-600">
              {audit.documentQuality && (
                <p><span className="font-bold text-slate-700">Document quality:</span> {audit.documentQuality}</p>
              )}
              {audit.verificationSummary && (
                <p><span className="font-bold text-slate-700">Verifier:</span> {audit.verificationSummary}</p>
              )}
              {audit.auditWarnings?.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2 font-bold text-amber-700">
                    <Alert className="h-4 w-4" /> Manual review warnings
                  </div>
                  <ul className="space-y-1">
                    {audit.auditWarnings.map((warning, i) => (
                      <li key={i} className="text-amber-800">- {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50 p-4 font-medium text-emerald-700">
                  No unresolved verification warnings.
                </div>
              )}
            </div>
          </div>

          {/* Discrepancies */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2 font-bold text-slate-800">
              <Alert className="h-5 w-5 text-amber-500" /> DISCREPANCIES & RECOMMENDATIONS ({audit.discrepancies.length})
            </div>
            {audit.discrepancies.length ? (
              <div className="space-y-3">
                {audit.discrepancies.map((d, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{d.category}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${impactColor[d.billingImpact || "unknown"] || impactColor.unknown}`}>
                        {d.billingImpact || "unknown"}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${sevColor[d.severity]}`}>{d.severity}</span>
                      <span className="font-mono text-sm font-bold text-slate-700">{d.code}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{d.description}</p>
                    <p className="mt-1 text-sm font-medium text-emerald-700">↳ {d.recommendation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                ✓ No discrepancies found — coding appears fully compliant.
              </div>
            )}
          </div>

          {/* Summary */}
          {audit.summary && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-2 font-bold text-slate-800">AUDITOR SUMMARY</div>
              <p className="text-sm leading-relaxed text-slate-600">{audit.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const color = value >= 80 ? "bg-emerald-100 text-emerald-700" : value >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`rounded-md px-2.5 py-1 text-sm font-bold ${color}`}>{value}{suffix || ""}</span>
    </div>
  );
}
