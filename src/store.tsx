import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuditResult, Settings, UploadedFile } from "./types";
import {
  clearAudits,
  clearAuditsInFolder,
  loadAudits,
  loadAuditsFromFolder,
  loadSettings,
  saveAudits,
  saveAuditsToFolder,
  saveSettings,
} from "./lib/storage";
import { readFilePayload } from "./lib/pdf";
import { auditChart } from "./lib/gemini";

export interface SessionMetrics {
  apiCalls: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  totalProcessingMs: number;
  completedCount: number;
  failedCount: number;
  sessionStartedAt: number | null;
}

interface Store {
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;
  audits: AuditResult[];
  files: UploadedFile[];
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  runAudit: () => Promise<void>;
  processing: boolean;
  progress: { done: number; total: number };
  queuePaused: boolean;
  pauseQueue: () => void;
  resumeQueue: () => void;
  cancelQueue: () => void;
  cancelAudit: (id: string) => void;
  retryAudit: (id: string) => void;
  retryFailedAudits: () => void;
  metrics: SessionMetrics;
  clearAllAudits: () => void;
  clearSessionMetrics: () => void;
  connected: boolean;
  refresh: () => void;
  refreshing: boolean;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const initialMetrics: SessionMetrics = {
  apiCalls: 0,
  totalCostUsd: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalThinkingTokens: 0,
  totalProcessingMs: 0,
  completedCount: 0,
  failedCount: 0,
  sessionStartedAt: null,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [audits, setAudits] = useState<AuditResult[]>(() => loadAudits());
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [queuePaused, setQueuePaused] = useState(false);
  const [metrics, setMetrics] = useState<SessionMetrics>(initialMetrics);
  const [refreshing, setRefreshing] = useState(false);
  const filesRef = useRef(files);
  const loadedStorageFolderRef = useRef(settings.storageFolder ? null : "");
  const processingRef = useRef(processing);
  const pauseRef = useRef(false);
  const pausePromiseRef = useRef<Promise<void> | null>(null);
  const pauseResolveRef = useRef<(() => void) | null>(null);
  const cancelRequestedRef = useRef(false);
  const retryPayloadsRef = useRef<Record<string, { base64: string; mimeType: string; text?: string; isPdf: boolean }>>({});
  filesRef.current = files;

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    let cancelled = false;
    const folder = settings.storageFolder.trim();

    if (!folder) {
      loadedStorageFolderRef.current = "";
      setAudits(loadAudits());
      return;
    }

    loadedStorageFolderRef.current = null;
    loadAuditsFromFolder(folder).then((folderAudits) => {
      if (cancelled) return;
      loadedStorageFolderRef.current = folder;
      setAudits(folderAudits);
    });

    return () => {
      cancelled = true;
    };
  }, [settings.storageFolder]);

  useEffect(() => {
    const folder = settings.storageFolder.trim();
    saveAudits(audits);
    if (folder && loadedStorageFolderRef.current === folder) {
      void saveAuditsToFolder(folder, audits);
    }
  }, [audits, settings.storageFolder]);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  const getPendingFile = (audit: AuditResult): UploadedFile | null => {
    const fileFromCurrent = filesRef.current.find((f) => f.id === audit.id);
    if (fileFromCurrent) return fileFromCurrent;

    const stored = retryPayloadsRef.current[audit.id];
    if (!stored) return null;

    return {
      id: audit.id,
      name: audit.fileName,
      size: 0,
      base64: stored.base64,
      mimeType: stored.mimeType,
      isPdf: stored.isPdf,
      text: stored.text,
      status: "ready",
    };
  };

  const waitForResume = async () => {
    if (!pauseRef.current) return;
    if (!pausePromiseRef.current) {
      pausePromiseRef.current = new Promise<void>((resolve) => {
        pauseResolveRef.current = resolve;
      });
    }
    await pausePromiseRef.current;
  };

  const updateSettings = (s: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...s }));

  const addFiles = async (incoming: File[]) => {
    const newFiles: UploadedFile[] = incoming.map((f) => ({
      id: uid(),
      name: f.name,
      size: f.size,
      base64: "",
      mimeType: "",
      isPdf: false,
      status: "parsing" as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    await Promise.all(
      newFiles.map(async (nf, idx) => {
        try {
          const payload = await readFilePayload(incoming[idx]);
          setFiles((prev) =>
            prev.map((p) =>
              p.id === nf.id
                ? {
                    ...p,
                    base64: payload.base64,
                    mimeType: payload.mimeType,
                    isPdf: payload.isPdf,
                    text: payload.text,
                    status: "ready",
                  }
                : p,
            ),
          );
        } catch (e: any) {
          setFiles((prev) =>
            prev.map((p) => (p.id === nf.id ? { ...p, status: "error", error: e?.message || "Read failed" } : p)),
          );
        }
      }),
    );
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearFiles = () => setFiles([]);

  const processQueueItems = async (queueItems: { id: string; file: UploadedFile }[], auditSettings: Settings) => {
    if (!queueItems.length) return;
    setProcessing(true);
    processingRef.current = true;
    cancelRequestedRef.current = false;
    setProgress({ done: 0, total: queueItems.length });

    const total = queueItems.length;
    const concurrency = Math.max(1, Math.min(10, auditSettings.concurrency));
    let done = 0;

    const worker = async () => {
      while (queueItems.length) {
        if (cancelRequestedRef.current) break;
        if (pauseRef.current) await waitForResume();

        const item = queueItems.shift();
        if (!item) break;

        const { id, file } = item;
        setAudits((prev) =>
          prev.map((a) => (a.id === id && a.status !== "cancelled" ? { ...a, status: "processing" } : a)),
        );

        const start = performance.now();
        let lastError: Error | null = null;
        const maxRetries = 1;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (cancelRequestedRef.current) break;
          try {
            const { audit, usage } = await auditChart(
              {
                fileName: file.name,
                isPdf: file.isPdf,
                base64: file.base64,
                mimeType: file.mimeType,
                text: file.text,
              },
              auditSettings,
            );
            const ms = Math.round(performance.now() - start);

            setAudits((prev) =>
              prev.map((a) =>
                a.id === id && a.status !== "cancelled"
                  ? {
                      ...a,
                      ...audit,
                      modelUsed: usage.model,
                      apiCalls: usage.apiCalls,
                      inputTokens: usage.inputTokens,
                      outputTokens: usage.outputTokens,
                      thinkingTokens: usage.thinkingTokens,
                      costUsd: usage.costUsd,
                      status: "completed",
                      processingMs: ms,
                    }
                  : a,
              ),
            );
            setMetrics((m) => ({
              apiCalls: m.apiCalls + usage.apiCalls,
              totalCostUsd: +(m.totalCostUsd + usage.costUsd).toFixed(6),
              totalInputTokens: m.totalInputTokens + usage.inputTokens,
              totalOutputTokens: m.totalOutputTokens + usage.outputTokens,
              totalThinkingTokens: m.totalThinkingTokens + usage.thinkingTokens,
              totalProcessingMs: m.totalProcessingMs + ms,
              completedCount: m.completedCount + 1,
              failedCount: m.failedCount,
              sessionStartedAt: m.sessionStartedAt,
            }));
            delete retryPayloadsRef.current[id];
            lastError = null;
            break;
          } catch (e: any) {
            lastError = e;
            const isRetryable =
              e?.message?.includes("JSON") ||
              e?.message?.includes("network") ||
              e?.message?.includes("500") ||
              e?.message?.includes("429") ||
              e?.message?.includes("rate limit");
            if (!isRetryable || attempt === maxRetries) break;
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        if (!cancelRequestedRef.current && lastError) {
          const msg = lastError?.message || "Audit failed";
          setAudits((prev) =>
            prev.map((a) =>
              a.id === id && a.status !== "cancelled" ? { ...a, status: "failed", error: msg } : a,
            ),
          );
          setMetrics((m) => ({
            ...m,
            failedCount: m.failedCount + 1,
          }));
        }

        done++;
        setProgress({ done, total });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setProcessing(false);
    processingRef.current = false;
    setQueuePaused(false);
    cancelRequestedRef.current = false;
    if (!pauseRef.current) {
      setFiles([]);
    }
  };

  const processPendingQueue = async () => {
    if (processingRef.current || pauseRef.current) return;

    const queueItems = audits
      .filter((a) => a.status === "queued")
      .map((a) => {
        const file = getPendingFile(a);
        if (!file) return null;
        return { id: a.id, file };
      })
      .filter((item): item is { id: string; file: UploadedFile } => Boolean(item));

    if (!queueItems.length) return;
    await processQueueItems(queueItems, settings);
  };

  const runAudit = async () => {
    const auditSettings = { ...settings };
    const ready = filesRef.current.filter((f) => f.status === "ready" && (f.base64 || f.text));
    if (!ready.length || !auditSettings.apiKey) return;

    const queued: AuditResult[] = ready.map((f) => {
      retryPayloadsRef.current[f.id] = {
        base64: f.base64,
        mimeType: f.mimeType,
        text: f.text,
        isPdf: f.isPdf,
      };
      return {
        id: f.id,
        fileName: f.name,
        patient: "",
        patientId: "",
        provider: "",
        facility: "",
        dateOfService: "",
        encounterNumber: "",
        insurancePayer: "",
        clinicLocation: "",
        documentedEmLevel: "—",
        auditedEmLevel: "—",
        emJustification: "",
        mdm: {
          problemsLevel: "",
          problemsEvidence: "",
          dataLevel: "",
          dataEvidence: "",
          riskLevel: "",
          riskEvidence: "",
          finalMdmLevel: "",
          twoOfThreeJustification: "",
        },
        problemList: [],
        originalCodes: { icd10: [], em: [], cpt: [], hcpcs: [] },
        correctedCodes: { icd10: [], em: [], cpt: [], hcpcs: [] },
        missingCodes: [],
        discrepancies: [],
        complianceScore: 0,
        aiConfidence: 0,
        summary: "",
        status: "queued",
        createdAt: Date.now(),
      };
    });

    setAudits((prev) => [...queued, ...prev]);
    setMetrics((m) => ({ ...m, sessionStartedAt: m.sessionStartedAt || Date.now() }));

    await processQueueItems(
      ready.map((file) => ({ id: file.id, file })),
      auditSettings,
    );
  };

  const clearAllAudits = () => {
    clearAudits();
    const folder = settings.storageFolder.trim();
    if (folder) void clearAuditsInFolder(folder);
    setAudits([]);
  };

  const clearSessionMetrics = () => setMetrics(initialMetrics);

  const pauseQueue = () => {
    if (!processingRef.current || pauseRef.current) return;
    pauseRef.current = true;
    setQueuePaused(true);
    pausePromiseRef.current = new Promise<void>((resolve) => {
      pauseResolveRef.current = resolve;
    });
  };

  const resumeQueue = () => {
    if (!pauseRef.current) return;
    pauseRef.current = false;
    setQueuePaused(false);
    pauseResolveRef.current?.();
    pauseResolveRef.current = null;
    pausePromiseRef.current = null;
    if (!processingRef.current) {
      void processPendingQueue();
    }
  };

  const cancelQueue = () => {
    cancelRequestedRef.current = true;
    if (pauseRef.current) {
      pauseRef.current = false;
      setQueuePaused(false);
      pauseResolveRef.current?.();
      pauseResolveRef.current = null;
      pausePromiseRef.current = null;
    }
    setAudits((prev) =>
      prev.map((a) =>
        a.status === "queued" || a.status === "processing"
          ? { ...a, status: "cancelled", error: "Cancelled by user" }
          : a,
      ),
    );
  };

  const cancelAudit = (id: string) => {
    cancelRequestedRef.current = true;
    setAudits((prev) =>
      prev.map((a) =>
        a.id === id && (a.status === "queued" || a.status === "processing")
          ? { ...a, status: "cancelled", error: "Cancelled by user" }
          : a,
      ),
    );
  };

  const retryAudit = (id: string) => {
    const audit = audits.find((a) => a.id === id && (a.status === "failed" || a.status === "cancelled"));
    if (!audit) return;
    const file = getPendingFile(audit);
    if (!file) {
      setAudits((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, error: "Cannot retry: original file data unavailable" } : a,
        ),
      );
      return;
    }

    setAudits((prev) => prev.map((a) => (a.id === id ? { ...a, status: "queued", error: undefined } : a)));

    if (!processingRef.current && !pauseRef.current) {
      void processQueueItems([{ id, file }], settings);
    }
  };

  const retryFailedAudits = () => {
    const queueItems: { id: string; file: UploadedFile }[] = [];
    setAudits((prev) =>
      prev.map((a) => {
        if (a.status !== "failed" && a.status !== "cancelled") return a;
        const file = getPendingFile(a);
        if (file) queueItems.push({ id: a.id, file });
        return { ...a, status: "queued", error: undefined };
      }),
    );

    if (queueItems.length > 0 && !processingRef.current && !pauseRef.current) {
      void processQueueItems(queueItems, settings);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    // Reload audits & settings from storage (picks up any external changes
    // and re-syncs in-memory state), then briefly show the spinner.
    const folder = settings.storageFolder.trim();
    if (folder) {
      void loadAuditsFromFolder(folder).then((folderAudits) => setAudits(folderAudits));
    } else {
      setAudits(loadAudits());
    }
    setSettings(loadSettings());
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <Ctx.Provider
      value={{
        settings,
        updateSettings,
        audits,
        files,
        addFiles,
        removeFile,
        clearFiles,
        runAudit,
        processing,
        progress,
        queuePaused,
        pauseQueue,
        resumeQueue,
        cancelQueue,
        cancelAudit,
        retryAudit,
        retryFailedAudits,
        metrics,
        clearAllAudits,
        clearSessionMetrics,
        connected: !!settings.apiKey,
        refresh,
        refreshing,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
